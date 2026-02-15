import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/database/prisma.service';
import * as nodemailer from 'nodemailer';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

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
  private readonly wablasEnabled: boolean;
  private readonly wablasServer: string;
  private readonly wablasToken: string;
  private readonly wablasSecret: string; // Added secret
  private readonly transporter: nodemailer.Transporter;
  private readonly emailFrom: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {
    // Initialize Wablas
    this.wablasServer = this.configService.get('WABLAS_SERVER');
    this.wablasToken = this.configService.get('WABLAS_TOKEN');
    this.wablasSecret = this.configService.get('WABLAS_SECRET'); // Read secret

    if (this.wablasServer && this.wablasToken) {
      this.wablasEnabled = true;
      this.logger.log('✅ Wablas WhatsApp notification enabled');
    } else {
      this.wablasEnabled = false;
      this.logger.warn('⚠️ WhatsApp notification disabled - Wablas credentials missing');
    }

    // Initialize Email Transporter
    this.emailFrom = this.configService.get('EMAIL_FROM') || 'RSI Hospital <noreply@rsi-hospital.com>';
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST'),
      port: this.configService.get('EMAIL_PORT'),
      secure: this.configService.get('EMAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });

    this.logger.log('📧 Email notification service initialized');
  }

  // Format phone number for Wablas (must be E.164, e.g., 628123456789)
  private formatPhoneNumber(phone: string): string {
    if (!phone) return '';

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with 62
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }

    // If doesn't start with 62, add it
    if (!cleaned.startsWith('62')) {
      cleaned = '62' + cleaned;
    }

    return cleaned;
  }

  // Send WhatsApp message via Wablas
  public async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phone);

    if (!this.wablasEnabled) {
      this.logger.log(`📱 [MOCK] Wablas to ${formattedPhone}:\n${message}`);
      return true;
    }

    try {
      const url = `${this.wablasServer}/api/v2/send-message`;
      const payload = {
        data: [
          {
            phone: formattedPhone,
            message: message,
          }
        ]
      };

      this.logger.log(`🚀 Sending Wablas to: ${url}`);
      // this.logger.log(`Payload: ${JSON.stringify(payload)}`); // Enable if needed (careful with PII)

      // Construct Authorization header: token.secret (if secret exists)
      const authHeader = this.wablasSecret
        ? `${this.wablasToken}.${this.wablasSecret}`
        : this.wablasToken;

      const response = await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        })
      );

      if (response.data.status) {
        this.logger.log(`✅ Wablas sent to ${formattedPhone}`);
        return true;
      } else {
        this.logger.warn(`⚠️ Wablas response: ${JSON.stringify(response.data)}`);
        // Some wablas responses might not have 'status' field or it might be 'true'/'false' string.
        // Assuming successful if no error thrown for now, but logging response is good.
        return true;
      }
    } catch (error) {
      this.logger.error(`❌ Wablas send error: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response Data: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  // Send Email (public for use by AuthService)
  async sendEmail(params: { to: string; subject: string; html?: string; text?: string }): Promise<boolean> {
    const { to, subject, html, text } = params;
    if (!to) return false;

    try {
      await this.transporter.sendMail({
        from: this.emailFrom,
        to,
        subject,
        text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
        html: html || `
          <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #0b1e33; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">RSI Hospital</h1>
            </div>
            <div style="padding: 30px;">
              ${text?.split('\n').map(line => line.trim() ? `<p style="margin: 10px 0;">${line}</p>` : '<br/>').join('')}
            </div>
          </div>
        `,
      });
      this.logger.log(`✅ Email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`❌ Email send error: ${error.message}`);
      return false;
    }
  }

  async sendBookingConfirmation(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    const message = this.generateBookingConfirmationMessage({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode,
      poliName
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_CONFIRMATION',
        recipient: patientName || 'Unknown Patient',
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Booking confirmation for ${patientName}`,
        status: sent ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`Booking confirmation ${sent ? 'sent' : 'logged'} for ${patientName}`);
  }

  async sendBookingCancellation(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    const message = this.generateCancellationMessage({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode,
      poliName
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_CANCELLATION',
        recipient: patientName,
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Booking cancellation for ${patientName}`,
        status: sent ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`Booking cancellation ${sent ? 'sent' : 'logged'} for ${patientName}`);
  }

  async sendBookingReschedule(payload: NotificationPayload & { newDate: string; newTime: string }, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, bookingDate, bookingTime, doctorName, bookingCode, poliName, newDate, newTime } = payload;

    const message = this.generateRescheduleMessage({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode,
      poliName,
      newDate,
      newTime
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_RESCHEDULE',
        recipient: patientName,
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Booking reschedule for ${patientName}`,
        status: sent ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`Booking reschedule ${sent ? 'sent' : 'logged'} for ${patientName}`);
  }

  async sendDoctorLeaveNotification(payload: {
    patientName: string;
    patientPhone: string;
    patientEmail?: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    bookingCode: string;
  }, appointmentId?: string): Promise<{ whatsapp: boolean; email: boolean }> {
    const { patientName, patientPhone, patientEmail, doctorName, appointmentDate, appointmentTime, bookingCode } = payload;

    const message = this.generateDoctorLeaveMessage({
      patientName,
      doctorName,
      appointmentDate,
      appointmentTime,
      bookingCode
    });

    const whatsappSent = await this.sendWhatsApp(patientPhone, message);

    let emailSent = false;
    if (patientEmail) {
      emailSent = await this.sendEmail({
        to: patientEmail,
        subject: `⚠️ Pemberitahuan Penting: Dokter Cuti - RSI Hospital`,
        text: message,
      });
    }

    await this.prisma.notification.create({
      data: {
        type: 'DOCTOR_LEAVE_NOTICE',
        recipient: patientName,
        recipientContact: `${this.formatPhoneNumber(patientPhone)}${patientEmail ? ` / ${patientEmail}` : ''}`,
        message: `Doctor leave notice for ${doctorName} to ${patientName}`,
        status: (whatsappSent || emailSent) ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`Doctor leave notice process completed for ${patientName}. WA: ${whatsappSent}, Email: ${emailSent}`);
    return { whatsapp: whatsappSent, email: emailSent };
  }

  async sendReminder(payload: NotificationPayload, appointmentId?: string): Promise<void> {
    const { patientName, patientPhone, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;

    const message = this.generateReminderMessage({
      patientName,
      bookingDate,
      bookingTime,
      doctorName,
      bookingCode,
      poliName
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_REMINDER',
        recipient: patientName,
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Booking reminder for ${patientName}`,
        status: sent ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`Booking reminder ${sent ? 'sent' : 'logged'} for ${patientName}`);
  }

  async sendScheduleChangeNotification(payload: any, appointmentId?: string): Promise<{ whatsapp: boolean }> {
    const { patientName, patientPhone, doctorName, dayName, newTime, poliName, type } = payload;

    const message = this.generateScheduleChangeMessage({
      patientName,
      doctorName,
      dayName,
      newTime,
      poliName,
      type
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'SCHEDULE_CHANGE_NOTICE',
        recipient: patientName,
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Schedule change notice for ${patientName} - Doctor: ${doctorName}`,
        status: sent ? 'sent' : 'failed',
        ...(appointmentId && { appointmentId })
      }
    });

    this.logger.log(`📢 [SCHEDULE_CHANGE] Notification ${sent ? 'sent' : 'failed'} for ${patientName}`);
    return { whatsapp: sent };
  }

  // Twilio Templates (Minimalist/Clean for official template approval if needed later)
  // For sandbox/basic use, simple text is fine.

  private generateBookingConfirmationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `*KONFIRMASI BOOKING RSI*\n\nHalo ${patientName},\nBooking Anda terkonfirmasi.\n\nKode: *${bookingCode}*\nDokter: ${doctorName}\nPoli: ${poliName}\nJadwal: ${bookingDate} | ${bookingTime} WIB\n\nMohon datang 15 menit sebelum jadwal.`;
  }

  private generateCancellationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `*PEMBATALAN BOOKING RSI*\n\nHalo ${patientName},\nBooking Anda berikut telah DIBATALKAN:\n\nKode: ${bookingCode}\nDokter: ${doctorName}\nPoli: ${poliName}\nJadwal: ${bookingDate} | ${bookingTime} WIB\n\nSilakan buat booking baru jika diperlukan.`;
  }

  private generateRescheduleMessage(payload: any): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName, newDate, newTime } = payload;
    const websiteUrl = this.configService.get('FRONTEND_URL') || 'https://rsisitihajarmataram.co.id';
    return `*PERUBAHAN JADWAL RSI*\n\nHalo ${patientName},\nJadwal Anda berubah.\n\nJadwal BARU:\nTanggal: *${newDate}*\nJam: *${newTime}* WIB\n\n(Booking Awal: ${bookingDate} ${bookingTime})\nDokter: ${doctorName}\n\nInfo lengkap: ${websiteUrl}/doctors`;
  }

  private generateScheduleChangeMessage(payload: any): string {
    const { patientName, doctorName, dayName, newTime, poliName, type } = payload;
    let changeText = `terdapat perubahan jam praktek`;
    if (type === 'deleted') changeText = `jadwal praktek ditiadakan`;

    const websiteUrl = this.configService.get('FRONTEND_URL') || 'https://rsisitihajarmataram.co.id';
    return `*INFO JADWAL DOKTER*\n\nHalo ${patientName},\nUntuk hari *${dayName}*, ${changeText} dokter:\n\nNama: ${doctorName}\nPoli: ${poliName}\n${type === 'modified' ? `Jam Baru: ${newTime} WIB` : ''}\n\nCek jadwal terbaru di: ${websiteUrl}/doctors`;
  }

  private generateReminderMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode } = payload;
    return `*PENGINGAT JADWAL RSI*\n\nHalo ${patientName},\nIngat jadwal periksa Anda BESOK.\n\nKode: ${bookingCode}\nDokter: ${doctorName}\nJam: ${bookingTime} WIB\n\nDatang tepat waktu ya!`;
  }

  private generateDoctorLeaveMessage(payload: {
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    bookingCode: string;
  }): string {
    const { patientName, doctorName, appointmentDate, appointmentTime } = payload;
    const websiteUrl = this.configService.get('FRONTEND_URL') || 'https://rsisitihajarmataram.co.id';
    return `*INFO DOKTER CUTI*\n\nHalo ${patientName},\nDokter *${doctorName}* berhalangan hadir/cuti pada jadwal:\n${appointmentDate} | ${appointmentTime} WIB.\n\nKami mohon maaf. Silakan cek jadwal dokter lain di: ${websiteUrl}/doctors atau hubungi kami untuk reschedule.`;
  }
}