import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { KhanzaService } from '../../infra/database/khanza.service';
import { NotificationService } from '../notification/notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AppointmentSyncService {
    private readonly logger = new Logger(AppointmentSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly khanzaService: KhanzaService,
        private readonly notificationService: NotificationService
    ) { }

    /**
     * Cron Job: Sync appointments every 10 minutes
     * Only syncs active doctors to save resources
     */
    // @Cron(CronExpression.EVERY_10_MINUTES)
    async handleCronSync() {
        this.logger.log('⏰ [AUTO_SYNC] Starting scheduled appointment sync...');
        try {
            // 1. First, process potential reschedules (checking all active local appointments)
            // This detects if a patient was moved to a different date (which changes no_rawat)
            await this.processReschedules();

            // 2. Then, run the standard daily sync to ensure data consistency
            const datesToSync = [
                new Date().toISOString().split('T')[0],
                new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
            ];

            const doctors = await this.prisma.doctor.findMany({
                where: { isActive: true, kd_dokter: { not: null } },
                select: { kd_dokter: true }
            });

            let totalSynced = 0;
            for (const date of datesToSync) {
                for (const doc of doctors) {
                    if (doc.kd_dokter) {
                        try {
                            const count = await this.syncRegistrations(doc.kd_dokter, date);
                            totalSynced += count || 0;
                        } catch (e) { }
                    }
                }
            }
            this.logger.log(`✅ [AUTO_SYNC] Completed. Synced ${totalSynced} appointments.`);
        } catch (error) {
            this.logger.error('❌ [AUTO_SYNC] Global sync failed', error);
        }
    }

    /**
     * Check for appointments that have been moved (rescheduled) or cancelled in Khanza
     * This handles the case where no_rawat changes due to date change
     */
    async processReschedules() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get all locally scheduled appointments from today onwards
        const activeAppointments = await this.prisma.appointment.findMany({
            where: {
                status: 'scheduled',
                appointmentDate: { gte: today }
            },
            include: { doctor: true }
        });

        this.logger.log(`🔍 [RESCHEDULE_CHECK] Checking ${activeAppointments.length} active appointments...`);

        for (const appt of activeAppointments) {
            if (!appt.doctor.kd_dokter) continue;

            const khanzaReg = await this.khanzaService.db('reg_periksa')
                .where('no_rawat', appt.noRawat)
                .first();

            // Case 1: Appointment is missing or Cancelled in Khanza
            if (!khanzaReg || khanzaReg.stts === 'Batal') {
                // Look for a REPLACEMENT booking for the same patient & doctor in the future
                const replacementReg = await this.khanzaService.db('reg_periksa')
                    .join('pasien', 'reg_periksa.no_rkm_medis', 'pasien.no_rkm_medis')
                    .where('reg_periksa.kd_dokter', appt.doctor.kd_dokter)
                    .where('reg_periksa.no_rkm_medis', appt.patientId)
                    .where('reg_periksa.stts', '!=', 'Batal')
                    .where('reg_periksa.no_rawat', '!=', appt.noRawat) // Different no_rawat
                    .where('reg_periksa.tgl_registrasi', '>=', today.toISOString().split('T')[0])
                    .orderBy('reg_periksa.tgl_registrasi', 'asc') // Nearest future date
                    .first();

                if (replacementReg) {
                    // Found a replacement! This is a RESCHEDULE.

                    // Prevent duplicate processing if we already synced/handled this duplicate
                    // (But usually the new one isn't synced yet if it's far in future, or we just want to notify)
                    const isNewAlreadyLocal = await this.prisma.appointment.findUnique({
                        where: { noRawat: replacementReg.no_rawat }
                    });

                    // Update Old Appointment to Cancelled (System)
                    await this.prisma.appointment.update({
                        where: { id: appt.id },
                        data: {
                            status: 'cancelled',
                            notes: `Sistem: Reschedule ke ${replacementReg.tgl_registrasi}`
                        }
                    });

                    // Determine New Date/Time
                    const tglStr = replacementReg.tgl_registrasi instanceof Date
                        ? replacementReg.tgl_registrasi.toISOString().split('T')[0]
                        : String(replacementReg.tgl_registrasi).split(' ')[0];
                    const jamStr = replacementReg.jam_reg || '00:00:00';
                    const newDate = new Date(`${tglStr}T${jamStr}+08:00`);

                    if (!isNewAlreadyLocal) {
                        // Create valid appointment record for new date
                        await this.syncRegistrations(appt.doctor.kd_dokter, tglStr);
                    }

                    // Send Notification: RESCHEDULE
                    this.logger.log(`📢 [RESCHEDULE_DETECTED] ${appt.patientName}: ${appt.appointmentDate} -> ${newDate}`);
                    // [DISABLED_AUTO_NOTIF] Prevent spamming users due to sync date mismatch
                    // await this.notificationService.sendBookingReschedule({
                    //     patientName: appt.patientName,
                    //     patientPhone: appt.patientPhone,
                    //     bookingDate: appt.appointmentDate.toISOString().split('T')[0],
                    //     bookingTime: appt.appointmentDate.toTimeString().split(' ')[0],
                    //     newDate: tglStr,
                    //     newTime: jamStr,
                    //     doctorName: appt.doctor.name,
                    //     bookingCode: replacementReg.no_reg,
                    //     poliName: appt.poliCode // Simplified
                    // }, appt.id);

                } else {
                    // No replacement found. This is a pure CANCELLATION.
                    this.logger.log(`🚫 [CANCEL_DETECTED] ${appt.patientName} (${appt.noRawat}) - No replacement found.`);

                    await this.prisma.appointment.update({
                        where: { id: appt.id },
                        data: { status: 'cancelled' }
                    });

                    // Send Notification: CANCELLATION
                    // await this.notificationService.sendBookingCancellation({
                    //    patientName: appt.patientName,
                    //    patientPhone: appt.patientPhone,
                    //    bookingDate: appt.appointmentDate.toISOString().split('T')[0],
                    //    bookingTime: appt.appointmentDate.toTimeString().split(' ')[0],
                    //    doctorName: appt.doctor.name,
                    //    bookingCode: appt.noReg,
                    //    poliName: appt.poliCode
                    // }, appt.id);
                }
            } else {
                // Case 2: Appointment exists. Check for same-day time change (handled in syncRegistrations usually, but safely double check here?)
                // Assuming syncRegistrations handles same-noRawat time changes.
            }
        }
    }

    /**
     * Sync registrations from SIMRS Khanza for a specific doctor and date
     */
    async syncRegistrations(doctorCode: string, date: string, poliCode?: string) {
        // this.logger.verbose(`🔄 Syncing for ${doctorCode} on ${date}...`);

        try {
            // 1. Fetch from Khanza using reg_periksa joined with booking_registrasi for fallback time
            const query = this.khanzaService.db('reg_periksa')
                .join('pasien', 'reg_periksa.no_rkm_medis', 'pasien.no_rkm_medis')
                .join('penjab', 'reg_periksa.kd_pj', 'penjab.kd_pj')
                .leftJoin('booking_registrasi', (join) => {
                    join.on('reg_periksa.no_rkm_medis', '=', 'booking_registrasi.no_rkm_medis')
                        .andOn('reg_periksa.kd_dokter', '=', 'booking_registrasi.kd_dokter')
                        .andOn('reg_periksa.tgl_registrasi', '=', 'booking_registrasi.tanggal_periksa');
                })
                .where('reg_periksa.kd_dokter', doctorCode)
                .where('reg_periksa.tgl_registrasi', date)
                // .whereNot('reg_periksa.stts', 'Batal') // Don't filter cancel here, we need to sync cancellations too!
                .select(
                    'reg_periksa.no_rawat',
                    'reg_periksa.no_reg',
                    'reg_periksa.no_rkm_medis',
                    'reg_periksa.tgl_registrasi',
                    'reg_periksa.jam_reg',
                    'reg_periksa.kd_poli',
                    'reg_periksa.stts', // Get status
                    'pasien.nm_pasien',
                    'pasien.no_tlp',
                    'pasien.email',
                    'pasien.alamat',
                    'penjab.png_jawab',
                    'penjab.kd_pj',
                    'booking_registrasi.waktu_kunjungan',
                    'booking_registrasi.jam_booking'
                );

            if (poliCode) {
                query.where('reg_periksa.kd_poli', poliCode);
            }

            const khanzaRegs = await query;
            if (khanzaRegs.length === 0) return 0;

            // 2. Map to Local Doctor ID
            const doctor = await this.prisma.doctor.findUnique({
                where: { kd_dokter: doctorCode },
                select: { id: true, name: true }
            });

            if (!doctor) return 0;

            // 3. Upsert into Local DB
            let syncedCount = 0;
            for (const reg of khanzaRegs) {
                // Ensure date and time are merged correctly ensuring we keep the LOCAL date from Khanza
                // Khanza returns 'Sun Feb 15 2026 00:00:00 GMT+0800' for tgl_registrasi.
                // Using toISOString() converts this to '2026-02-14T16:00:00.000Z', shifting the day!
                // We MUST use the local date parts or simple string manipulation if it's already a string.

                let tglStr = '';
                if (reg.tgl_registrasi instanceof Date) {
                    // Extract YYYY-MM-DD in Local Time (assuming server is in same timezone or date object is correct local representation)
                    // Better yet, just take the date string directly from format if possible, but manually is safer using offset logic if needed.
                    // Since we know the log shows GMT+0800, getFullYear() uses local time.
                    const d = reg.tgl_registrasi;
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    tglStr = `${year}-${month}-${day}`;
                } else {
                    tglStr = String(reg.tgl_registrasi).split(' ')[0];
                }

                let jamStr = reg.jam_reg || '00:00:00';

                // Fallback to booking time if registration time is midnight or missing
                if (jamStr === '00:00:00' || jamStr === '00:00') {
                    if (reg.waktu_kunjungan && reg.waktu_kunjungan.includes(' ')) {
                        jamStr = reg.waktu_kunjungan.split(' ')[1];
                    } else if (reg.jam_booking) {
                        jamStr = reg.jam_booking;
                    }
                }

                const appointmentDate = new Date(`${tglStr}T${jamStr}+08:00`);
                const khanzaStatus = reg.stts;
                let status = 'scheduled';
                if (khanzaStatus === 'Sudah') {
                    status = 'completed';
                } else if (khanzaStatus === 'Batal') {
                    status = 'cancelled';
                }

                // Check for existence and changes
                const existing = await this.prisma.appointment.findUnique({
                    where: { noRawat: reg.no_rawat }
                });

                if (existing) {
                    const oldDate = new Date(existing.appointmentDate);
                    const newDate = new Date(appointmentDate);

                    // Tolerance of 1 minute
                    const timeDiff = Math.abs(oldDate.getTime() - newDate.getTime());
                    const isTimeChanged = timeDiff > 60000;

                    const isStatusChanged = existing.status !== status;

                    if (isStatusChanged && status === 'cancelled' && existing.status !== 'cancelled') {
                        this.logger.log(`⚠️ Booking cancelled locally for ${reg.no_rawat}`);
                        // Send Cancel Notification?
                        // this.notificationService.sendBookingCancellation(...)
                    } else if (isTimeChanged && status !== 'cancelled') {
                        this.logger.log(`⏰ Booking rescheduled: ${existing.appointmentDate} -> ${appointmentDate}`);

                        // Debug Date Mismatch
                        this.logger.debug(`🔍 [DATE_DEBUG] Existing: ${existing.appointmentDate.toISOString()} | Incoming: ${appointmentDate.toISOString()}`);
                        this.logger.debug(`🔍 [DATE_DEBUG] Raw Tgl: ${reg.tgl_registrasi} (${typeof reg.tgl_registrasi}) | Raw Jam: ${reg.jam_reg}`);

                        // [DISABLED_AUTO_NOTIF] Prevent spamming users
                        // Send Reschedule Notification
                        // await this.notificationService.sendBookingReschedule({
                        //     patientName: reg.nm_pasien,
                        //     patientPhone: reg.no_tlp,
                        //     bookingDate: existing.appointmentDate.toISOString().split('T')[0], // Old date
                        //     bookingTime: existing.appointmentDate.toTimeString().split(' ')[0], // Old time
                        //     newDate: tglStr,
                        //     newTime: jamStr,
                        //     doctorName: doctor.name,
                        //     bookingCode: reg.no_reg,
                        //     poliName: reg.kd_poli // Simplification, ideally map to Name
                        // }, existing.id);
                    }
                }

                await this.prisma.appointment.upsert({
                    where: { noRawat: reg.no_rawat } as any,
                    update: {
                        patientName: reg.nm_pasien,
                        patientPhone: reg.no_tlp,
                        patientEmail: reg.email,
                        patientAddress: reg.alamat,
                        status: status,
                        appointmentDate: appointmentDate,
                        noReg: reg.no_reg,
                        poliCode: reg.kd_poli,
                        payerName: reg.png_jawab,
                        payerCode: reg.kd_pj,
                    } as any,
                    create: {
                        doctorId: doctor.id,
                        patientName: reg.nm_pasien,
                        noRawat: reg.no_rawat,
                        patientId: reg.no_rkm_medis,
                        patientPhone: reg.no_tlp,
                        patientEmail: reg.email,
                        patientAddress: reg.alamat,
                        appointmentDate: appointmentDate,
                        status: status,
                        poliCode: reg.kd_poli,
                        noReg: reg.no_reg,
                        payerName: reg.png_jawab,
                        payerCode: reg.kd_pj,
                        notes: 'Synced from SIMRS Khanza'
                    } as any
                });
                syncedCount++;
            }

            return syncedCount;
        } catch (error) {
            this.logger.error(`❌ Sync failed for doctor ${doctorCode} on ${date}: ${error.message}`);
            // throw error; // Don't throw, just log
            return 0;
        }
    }

    /**
     * Sync all registrations for a doctor from today onwards
     */
    async syncAllFutureRegistrations(doctorCode: string) {
        const today = new Date().toISOString().split('T')[0];

        // Get unique dates from Khanza for this doctor from today onwards
        const dates = await this.khanzaService.db('reg_periksa')
            .where('kd_dokter', doctorCode)
            .where('tgl_registrasi', '>=', today)
            .distinct('tgl_registrasi')
            .pluck('tgl_registrasi');

        for (const date of dates) {
            // FIX: Avoid toISOString() which converts to UTC and shifts date back by 1 day!
            // Khanza 'tgl_registrasi' is likely a Date object at 00:00:00 Local Time.
            // We want to keep the local YYYY-MM-DD.
            let formattedDate = '';

            if (date instanceof Date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
            } else {
                // Fallback if it's already a string
                formattedDate = String(date).split('T')[0];
            }

            await this.syncRegistrations(doctorCode, formattedDate);
        }
    }
}
