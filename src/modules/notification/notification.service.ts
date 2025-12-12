import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../infra/database/prisma.service';

export interface NotificationPayload {
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  bookingDate: string;
  bookingTime: string;
  doctorName: string;
  bookingCode: string;
  poliName: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST'),
      port: this.configService.get('EMAIL_PORT'),
      secure: this.configService.get('EMAIL_SECURE') === 'true', // true for 465, false for other ports
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });
  }

  async sendBookingConfirmation(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, patientEmail, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    // Send SMS notification
    await this.sendSMS(patientPhone, this.generateSMSContent({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode
    }));

    // Send email notification if email is provided
    if (patientEmail) {
      await this.sendEmail(patientEmail, patientName, this.generateEmailContent({
        patientName,
        bookingDate,
        bookingTime,
        doctorName,
        bookingCode,
        poliName
      }));
    }

    // Log the notification
    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_CONFIRMATION',
        recipient: patientName || 'Unknown Patient',
        recipientContact: patientEmail || patientPhone || 'No Contact',
        message: `Booking confirmation for ${patientName}`,
        status: 'sent',
        ...(appointmentId && { appointmentId }) // Add appointmentId if provided
      }
    });

    this.logger.log(`Booking confirmation sent to ${patientName} (${patientPhone})`);
  }

  async sendBookingCancellation(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, patientEmail, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    // Send cancellation SMS
    await this.sendSMS(patientPhone, this.generateCancellationSMS({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode
    }));

    // Send cancellation email if email is provided
    if (patientEmail) {
      await this.sendEmail(
        patientEmail,
        patientName,
        this.generateCancellationEmailContent({
          patientName,
          bookingDate,
          bookingTime,
          doctorName,
          bookingCode,
          poliName
        })
      );
    }

    // Log the notification
    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_CANCELLATION',
        recipient: patientName,
        recipientContact: patientEmail || patientPhone,
        message: `Booking cancellation for ${patientName}`,
        status: 'sent',
        ...(appointmentId && { appointmentId }) // Add appointmentId if provided
      }
    });

    this.logger.log(`Booking cancellation sent to ${patientName} (${patientPhone})`);
  }

  async sendReminder(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, patientEmail, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    // Send reminder SMS
    await this.sendSMS(patientPhone, this.generateReminderSMS({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode
    }));

    // Send reminder email if email is provided
    if (patientEmail) {
      await this.sendEmail(
        patientEmail,
        patientName,
        this.generateReminderEmailContent({
          patientName,
          bookingDate,
          bookingTime,
          doctorName,
          bookingCode,
          poliName
        })
      );
    }

    // Log the notification
    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_REMINDER',
        recipient: patientName,
        recipientContact: patientEmail || patientPhone,
        message: `Booking reminder for ${patientName}`,
        status: 'sent',
        ...(appointmentId && { appointmentId }) // Add appointmentId if provided
      }
    });

    this.logger.log(`Booking reminder sent to ${patientName} (${patientPhone})`);
  }

  private async sendSMS(phone: string, message: string): Promise<void> {
    // For now, log the SMS as we don't have an actual SMS service configured
    this.logger.log(`SMS would be sent to ${phone}: ${message}`);

    // In a real implementation, you would use an SMS service like Twilio, AWS SNS, etc.
    // Example with a mock implementation:
    // const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    // const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    // const client = require('twilio')(accountSid, authToken);
    // await client.messages.create({
    //   body: message,
    //   from: this.configService.get('TWILIO_PHONE_NUMBER'),
    //   to: phone
    // });
  }

  private async sendEmail(to: string, name: string, htmlContent: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM') || 'noreply@rsi-hospital.com',
        to,
        subject: 'Konfirmasi Booking - RSI Hospital',
        text: `Halo ${name},\n\nPermintaan booking anda telah berhasil diproses.`,
        html: htmlContent,
      });
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  private generateSMSContent(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode } = payload;
    return `Halo ${patientName},\nBooking dokter ${doctorName} pada tanggal ${bookingDate} jam ${bookingTime} berhasil.\nKode Booking: ${bookingCode}\nTerima kasih telah menggunakan layanan RSI Hospital.`;
  }

  private generateEmailContent(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; }
            .booking-info { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>RSI Hospital</h2>
              <p>Konfirmasi Booking Online</p>
            </div>
            <div class="content">
              <h3>Halo ${patientName},</h3>
              <p>Permintaan booking Anda telah berhasil diproses.</p>
              
              <div class="booking-info">
                <h4>Detail Booking:</h4>
                <p><strong>Kode Booking:</strong> ${bookingCode}</p>
                <p><strong>Dokter:</strong> ${doctorName}</p>
                <p><strong>Poliklinik:</strong> ${poliName}</p>
                <p><strong>Tanggal:</strong> ${bookingDate}</p>
                <p><strong>Jam:</strong> ${bookingTime}</p>
              </div>
              
              <p>Silakan datang 30 menit sebelum jadwal pemeriksaan dan bawa kartu identitas serta kartu BPJS (jika ada).</p>
              <p>Terima kasih telah menggunakan layanan RSI Hospital.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} RSI Hospital. Semua hak dilindungi.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateCancellationSMS(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode } = payload;
    return `Halo ${patientName},\nBooking dokter ${doctorName} pada tanggal ${bookingDate} jam ${bookingTime} telah dibatalkan.\nKode Booking: ${bookingCode}\nTerima kasih telah menggunakan layanan RSI Hospital.`;
  }

  private generateCancellationEmailContent(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; }
            .booking-info { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>RSI Hospital</h2>
              <p>Pembatalan Booking Online</p>
            </div>
            <div class="content">
              <h3>Halo ${patientName},</h3>
              <p>Booking Anda telah dibatalkan.</p>
              
              <div class="booking-info">
                <h4>Detail Booking yang Dibatalkan:</h4>
                <p><strong>Kode Booking:</strong> ${bookingCode}</p>
                <p><strong>Dokter:</strong> ${doctorName}</p>
                <p><strong>Poliklinik:</strong> ${poliName}</p>
                <p><strong>Tanggal:</strong> ${bookingDate}</p>
                <p><strong>Jam:</strong> ${bookingTime}</p>
              </div>
              
              <p>Jika ini kesalahan, silakan buat booking kembali melalui website kami.</p>
              <p>Terima kasih telah menggunakan layanan RSI Hospital.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} RSI Hospital. Semua hak dilindungi.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private generateReminderSMS(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode } = payload;
    return `Halo ${patientName},\nIngat! Anda memiliki janji dengan dokter ${doctorName} pada tanggal ${bookingDate} jam ${bookingTime}.\nKode Booking: ${bookingCode}\nDatang 30 menit lebih awal. Terima kasih.`;
  }

  private generateReminderEmailContent(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; }
            .booking-info { background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>RSI Hospital</h2>
              <p>Pengingat Booking</p>
            </div>
            <div class="content">
              <h3>Halo ${patientName},</h3>
              <p>Ini adalah pengingat untuk janji pemeriksaan Anda.</p>
              
              <div class="booking-info">
                <h4>Detail Janji:</h4>
                <p><strong>Kode Booking:</strong> ${bookingCode}</p>
                <p><strong>Dokter:</strong> ${doctorName}</p>
                <p><strong>Poliklinik:</strong> ${poliName}</p>
                <p><strong>Tanggal:</strong> ${bookingDate}</p>
                <p><strong>Jam:</strong> ${bookingTime}</p>
              </div>
              
              <p><strong>Harap datang 30 menit sebelum jadwal pemeriksaan.</strong></p>
              <p>Bawa kartu identitas dan kartu BPJS (jika ada).</p>
              <p>Terima kasih telah menggunakan layanan RSI Hospital.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} RSI Hospital. Semua hak dilindungi.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}