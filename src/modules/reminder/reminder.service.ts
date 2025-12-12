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
  ) {}

  async onModuleInit() {
    // Initialize reminder service when module starts
    await this.sendReminders();
  }

  @Cron(CronExpression.EVERY_HOUR) // Run every hour
  async sendReminders() {
    this.logger.log('Sending appointment reminders');

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

    for (const appointment of upcomingAppointments) {
      try {
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

        this.logger.log(`Reminder sent for appointment ${appointment.id}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder for appointment ${appointment.id}: ${error.message}`);
      }
    }
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