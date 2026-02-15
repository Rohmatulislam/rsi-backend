import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { NotificationService } from 'src/modules/notification/notification.service';

@Injectable()
export class DoctorScheduleExceptionService {
    private readonly logger = new Logger(DoctorScheduleExceptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
    ) { }

    async createException(data: {
        doctorId: string;
        date: string | Date;
        type: string; // 'LEAVE', 'RESCHEDULE', 'EXTRA_QUOTA'
        startTime?: string;
        endTime?: string;
        note?: string;
    }) {
        const dateObj = new Date(data.date);

        // Ensure unique constraint based on doctorId and date
        const exception = await this.prisma.doctorScheduleException.upsert({
            where: {
                doctorId_date: {
                    doctorId: data.doctorId,
                    date: dateObj,
                },
            },
            update: {
                type: data.type,
                startTime: data.startTime,
                endTime: data.endTime,
                note: data.note,
                isActive: true,
            },
            create: {
                doctorId: data.doctorId,
                date: dateObj,
                type: data.type,
                startTime: data.startTime,
                endTime: data.endTime,
                note: data.note,
            },
        });

        // Send notifications to affected patients
        if (data.type === 'LEAVE' || data.type === 'RESCHEDULE') {
            this.notifyAffectedPatients(data.doctorId, dateObj, data.type, data.note).catch(err => {
                this.logger.error(`Failed to notify patients for exception ${exception.id}`, err);
            });
        }

        return exception;
    }

    private async notifyAffectedPatients(doctorId: string, date: Date, type: string, note?: string) {
        this.logger.log(`🔔 notifyAffectedPatients triggered for Doctor ${doctorId} on ${date.toISOString()} (${type})`);

        // Find appointments for this doctor on this date
        // Note: appointmentDate in DB is DateTime, so we need to match the day.
        // Prisma doesn't have robust date filtering, so we might need ranges.

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        this.logger.log(`🔎 Searching appointments between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}`);

        const appointments = await this.prisma.appointment.findMany({
            where: {
                doctorId: doctorId,
                appointmentDate: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: {
                    in: ['PENDING', 'CONFIRMED', 'scheduled', 'registered'], // Expanded status check just in case
                }
            },
            include: {
                doctor: true,
            }
        });

        if (appointments.length === 0) {
            this.logger.warn(`⚠️ No active appointments found for this date. Notification skipped.`);
            return;
        }

        this.logger.log(`✅ Found ${appointments.length} affected appointments for exception on ${date.toISOString()}`);

        for (const appt of appointments) {
            this.logger.log(`Processing appt ${appt.id} for patient ${appt.patientName} (${appt.patientPhone})`);

            let message = '';
            if (type === 'LEAVE') {
                message = `Mohon maaf, jadwal dr. ${appt.doctor.name} pada tanggal ${date.toLocaleDateString('id-ID')} DIBATALKAN/LIBUR karena ${note || 'halangan mendesak'}. Silakan lakukan reschedule atau hubungi kami.`;
            } else if (type === 'RESCHEDULE') {
                message = `Info: Jadwal dr. ${appt.doctor.name} pada tanggal ${date.toLocaleDateString('id-ID')} mengalami perubahan jam. Mohon cek kembali jadwal terbaru.`;
            }

            if (message && appt.patientPhone) {
                try {
                    const sent = await this.notificationService.sendWhatsApp(appt.patientPhone, message);
                    this.logger.log(`📤 WA Sending result to ${appt.patientPhone}: ${sent}`);
                } catch (err) {
                    this.logger.error(`❌ Failed to send WA to ${appt.patientPhone}: ${err.message}`);
                }
            } else {
                this.logger.warn(`⚠️ Skipping notification for ${appt.patientName}: No phone number or empty message.`);
            }
        }
    }

    async getExceptionsByDoctor(doctorId: string, startDate?: Date, endDate?: Date) {
        const where: any = { doctorId };

        if (startDate && endDate) {
            where.date = {
                gte: startDate,
                lte: endDate,
            };
        } else if (startDate) {
            where.date = { gte: startDate };
        }

        return await this.prisma.doctorScheduleException.findMany({
            where,
            orderBy: { date: 'asc' },
        });
    }

    async deleteException(id: string) {
        return await this.prisma.doctorScheduleException.delete({
            where: { id },
        });
    }
}
