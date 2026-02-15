import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from 'src/modules/notification/notification.service';

@Injectable()
export class DoctorScheduleExceptionService {
    private readonly logger = new Logger(DoctorScheduleExceptionService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationService: NotificationService,
        private readonly configService: ConfigService,
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

            const websiteUrl = this.configService.get('FRONTEND_URL') || 'https://rsisitihajarmataram.co.id';
            const scheduleUrl = `${websiteUrl}/doctors`;

            let message = '';
            const dateStr = date.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            if (type === 'LEAVE') {
                message = `*INFORMASI PELAYANAN DOKTER - RSI SITI HAJAR*\n\nSalam Sejahtera Bapak/Ibu ${appt.patientName},\n\nKami memohon maaf atas ketidaknyamanan Anda. Melalui pesan ini, kami menginformasikan bahwa jadwal praktik dr. ${appt.doctor.name} pada hari *${dateStr}* ditiadakan sementara dikarenakan *${note || 'keperluan mendesak'}*.\n\nBapak/Ibu dapat meninjau jadwal alternatif atau melakukan pendaftaran kembali melalui tautan berikut:\n${scheduleUrl}\n\nTerima kasih atas pengertian dan kerja sama Bapak/Ibu.`;
            } else if (type === 'RESCHEDULE') {
                message = `*INFORMASI PENYESUAIAN JADWAL PRAKTIK - RSI SITI HAJAR*\n\nSalam Sejahtera Bapak/Ibu ${appt.patientName},\n\nKami menginformasikan bahwa terdapat penyesuaian waktu praktik untuk dr. ${appt.doctor.name} pada hari *${dateStr}* dikarenakan *${note || 'keperluan mendesak'}*.\n\nMohon kesediaan Bapak/Ibu untuk memeriksa kembali jadwal pelayanan terbaru melalui website resmi kami agar mendapatkan estimasi waktu yang akurat:\n${scheduleUrl}\n\nTerima kasih atas kepercayaan Bapak/Ibu.`;
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
