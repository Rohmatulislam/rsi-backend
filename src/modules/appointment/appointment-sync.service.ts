import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class AppointmentSyncService {
    private readonly logger = new Logger(AppointmentSyncService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly khanzaService: KhanzaService
    ) { }

    /**
     * Sync registrations from SIMRS Khanza for a specific doctor and date
     */
    async syncRegistrations(doctorCode: string, date: string, poliCode?: string) {
        this.logger.log(`🔄 Syncing registrations for doctor ${doctorCode} on ${date}...`);

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
                .whereNot('reg_periksa.stts', 'Batal')
                .select(
                    'reg_periksa.no_rawat',
                    'reg_periksa.no_reg',
                    'reg_periksa.no_rkm_medis',
                    'reg_periksa.tgl_registrasi',
                    'reg_periksa.jam_reg',
                    'reg_periksa.kd_poli',
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
            this.logger.log(`📥 Found ${khanzaRegs.length} registrations in Khanza`);

            // 2. Map to Local Doctor ID
            const doctor = await this.prisma.doctor.findUnique({
                where: { kd_dokter: doctorCode },
                select: { id: true }
            });

            if (!doctor) {
                this.logger.warn(`⚠️ Doctor with kd_dokter ${doctorCode} not found in local DB. Skipping sync.`);
                return;
            }

            // 3. Upsert into Local DB
            let syncedCount = 0;
            for (const reg of khanzaRegs) {
                // Ensure date and time are merged correctly for WITA (UTC+8)
                const tglStr = reg.tgl_registrasi instanceof Date
                    ? reg.tgl_registrasi.toISOString().split('T')[0]
                    : String(reg.tgl_registrasi).split(' ')[0];

                let jamStr = reg.jam_reg || '00:00:00';

                // Fallback to booking time if registration time is midnight or missing
                // In Khanza, placeholder registrations often default to 00:00:00
                if (jamStr === '00:00:00' || jamStr === '00:00') {
                    if (reg.waktu_kunjungan && reg.waktu_kunjungan.includes(' ')) {
                        // waktu_kunjungan: YYYY-MM-DD HH:MM:SS
                        jamStr = reg.waktu_kunjungan.split(' ')[1];
                    } else if (reg.jam_booking) {
                        jamStr = reg.jam_booking;
                    }
                }

                const appointmentDate = new Date(`${tglStr}T${jamStr}+08:00`);

                await this.prisma.appointment.upsert({
                    where: { noRawat: reg.no_rawat } as any,
                    update: {
                        patientName: reg.nm_pasien,
                        patientPhone: reg.no_tlp,
                        patientEmail: reg.email,
                        patientAddress: reg.alamat,
                        status: 'scheduled',
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
                        status: 'scheduled',
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
            throw error;
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
            const formattedDate = new Date(date).toISOString().split('T')[0];
            await this.syncRegistrations(doctorCode, formattedDate);
        }
    }
}
