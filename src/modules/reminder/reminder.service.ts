import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationService, NotificationPayload } from '../notification/notification.service';

@Injectable()
export class ReminderService implements OnModuleInit {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async onModuleInit() {
    // Just log that service is ready, don't send reminders on startup
    this.logger.log('ReminderService initialized - will run on schedule');
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM) // Run once daily at 8 AM
  async sendReminders() {
    this.logger.log('Running scheduled appointment reminders...');

    // Find appointments scheduled for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Start of tomorrow

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
    dayAfterTomorrow.setHours(0, 0, 0, 0); // Start of the day after tomorrow

    const upcomingAppointments = await this.prisma.appointment.findMany({
      where: {
        appointmentDate: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
        status: 'scheduled', // Only send reminders for scheduled appointments
      },
      include: {
        doctor: true,
      },
    });

    // Check which appointments already received reminders today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const appointment of upcomingAppointments) {
      try {
        // Check if reminder was already sent today for this appointment
        const existingReminder = await this.prisma.notification.findFirst({
          where: {
            appointmentId: appointment.id,
            type: 'BOOKING_REMINDER',
            createdAt: {
              gte: todayStart,
            },
          },
        });

        if (existingReminder) {
          this.logger.log(`Reminder already sent today for appointment ${appointment.id}, skipping`);
          continue;
        }

        // Get doctor details for notification
        const doctorDetails = appointment.doctor;

        // Using the stored patient details from appointment record
        const notificationPayload: NotificationPayload = {
          patientName: appointment.patientName || 'Patient',
          patientPhone: appointment.patientPhone || '',
          patientEmail: appointment.patientEmail || '',
          bookingDate: appointment.appointmentDate.toLocaleDateString('id-ID'),
          bookingTime: appointment.appointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          doctorName: doctorDetails.name,
          bookingCode: appointment.notes?.split(',')[0]?.replace('No Reg: ', '') || appointment.id,
          poliName: 'Poliklinik',
        };

        // Send reminder notification
        await this.notificationService.sendReminder(notificationPayload, appointment.id);

        this.logger.log(`Reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder for appointment ${appointment.id}: ${error.message}`);
      }
    }

    this.logger.log(`Reminders processed for ${upcomingAppointments.length} appointments`);
  }

  // Method to send immediate reminder (useful for testing or manual sending)
  async sendImmediateReminder(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: true,
      },
    });

    if (!appointment) {
      throw new Error('Appointment not found');
    }

    if (appointment.status !== 'scheduled') {
      throw new Error('Cannot send reminder for non-scheduled appointment');
    }

    // Get doctor details for notification
    const doctorDetails = appointment.doctor;

    // Using the stored patient details from appointment record
    const notificationPayload: NotificationPayload = {
      patientName: appointment.patientName || 'Patient',
      patientPhone: appointment.patientPhone || 'Patient Phone',
      patientEmail: appointment.patientEmail || 'patient@example.com',
      bookingDate: appointment.appointmentDate.toLocaleDateString('id-ID'),
      bookingTime: appointment.appointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      doctorName: doctorDetails.name,
      bookingCode: appointment.notes || appointment.id, // Using notes as booking code since it contains no_reg
      poliName: 'Poliklinik Umum', // Placeholder - in the future could fetch actual poli name
    };

    // Send reminder notification
    await this.notificationService.sendReminder(notificationPayload, appointment.id);

    return { success: true, message: 'Reminder sent successfully' };
  }
}