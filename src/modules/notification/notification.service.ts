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
  items?: string[]; // Added for diagnostic
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

  async sendDiagnosticBookingConfirmation(payload: NotificationPayload, orderId?: string): Promise<void> {
    const { patientName, patientPhone, bookingDate, bookingTime, bookingCode, items, poliName } = payload;

    const message = this.generateDiagnosticConfirmationMessage({
      patientName,
      bookingDate,
      bookingTime,
      bookingCode,
      items,
      poliName
    });

    const sent = await this.sendWhatsApp(patientPhone, message);

    await this.prisma.notification.create({
      data: {
        type: 'BOOKING_CONFIRMATION',
        recipient: patientName || 'Unknown Patient',
        recipientContact: this.formatPhoneNumber(patientPhone),
        message: `Diagnostic booking confirmation for ${patientName}`,
        status: sent ? 'sent' : 'failed',
        // Optional: linking to diagnostic order if table exists/updated
      }
    });

    this.logger.log(`Diagnostic confirmation ${sent ? 'sent' : 'logged'} for ${patientName}`);
  }

  // --- Premium Template Generators ---

  private generateBookingConfirmationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `*KONFIRMASI PENDAFTARAN - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Pendaftaran pendaftaran Anda telah berhasil diproses oleh sistem kami. Berikut adalah rincian janji temu Anda:\n\n` +
      `📌 *Detail Kunjungan:*\n` +
      `🎫 Kode Booking: *${bookingCode}*\n` +
      `👨‍⚕️ Dokter: ${doctorName}\n` +
      `🏥 Poliklinik: ${poliName}\n` +
      `🗓️ Tanggal: ${bookingDate}\n` +
      `⏰ Waktu: ${bookingTime} WITA\n\n` +
      `📍 *Petunjuk Kedatangan:*\n` +
      `1. Silakan tiba 15 menit lebih awal dari jadwal yang ditentukan.\n` +
      `2. Tunjukkan kode booking ini kepada petugas pendaftaran.\n` +
      `3. Harap membawa identitas diri (KTP/NIK).\n\n` +
      `Terima kasih telah mempercayai **RSI Siti Hajar Mataram** sebagai mitra kesehatan Anda.\n\n` +
      `*Hormat Kami,*\n` +
      `Manajemen RSI Siti Hajar`;
  }

  private generateDiagnosticConfirmationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, bookingCode, items, poliName } = payload;
    const itemList = items?.map(item => `   - ${item}`).join('\n') || '';

    return `*KONFIRMASI LAYANAN DIAGNOSTIK - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Pendaftaran layanan diagnostik Anda telah terkonfirmasi. Kami siap melayani Anda pada jadwal berikut:\n\n` +
      `📌 *Detail Layanan:*\n` +
      `🎫 Kode Booking: *${bookingCode}*\n` +
      `🏥 Layanan: ${poliName}\n` +
      `🧪 Jenis Pemeriksaan:\n${itemList}\n` +
      `🗓️ Tanggal: ${bookingDate}\n` +
      `⏰ Waktu: ${bookingTime} WITA\n\n` +
      `📍 *Informasi Penting:*\n` +
      `1. Pastikan mengikuti instruksi persiapan (seperti puasa) jika diperlukan.\n` +
      `2. Tiba 20 menit lebih awal untuk proses registrasi diagnostik.\n\n` +
      `Kesehatan Anda adalah prioritas kami.\n\n` +
      `*Hormat Kami,*\n` +
      `Manajemen RSI Siti Hajar`;
  }

  private generateCancellationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, doctorName, bookingCode } = payload;
    return `*PEMBATALAN JANJI TEMU - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Melalui pesan ini, kami menginformasikan bahwa janji temu Anda telah resmi *DIBATALKAN*.\n\n` +
      `📌 *Detail Pembatalan:*\n` +
      `🎫 Kode Booking: ${bookingCode}\n` +
      `👨‍⚕️ Dokter: ${doctorName}\n` +
      `🗓️ Rencana Kunjungan: ${bookingDate}\n\n` +
      `Jika pembatalan ini bukan atas permintaan Anda atau Anda ingin menjadwalkan ulang, silakan hubungi layanan pelanggan kami atau mendaftar kembali melalui website.\n\n` +
      `Terima kasih atas pengertiannya.\n\n` +
      `*Hormat Kami,*\n` +
      `Pendaftaran Online RSI Siti Hajar`;
  }

  private generateRescheduleMessage(payload: any): string {
    const { patientName, doctorName, poliName, newDate, newTime } = payload;
    return `*PENJADWALAN ULANG KUNJUNGAN - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Kami menginformasikan adanya pembaruan jadwal untuk janji temu Anda. Mohon diperhatikan rincian terbaru berikut:\n\n` +
      `📌 *Jadwal Terbaru:*\n` +
      `🗓️ Tanggal: *${newDate}*\n` +
      `⏰ Waktu: *${newTime}* WITA\n` +
      `👨‍⚕️ Dokter: ${doctorName}\n` +
      `🏥 Poliklinik: ${poliName}\n\n` +
      `Kami memohon maaf atas perubahan ini dan sangat menghargai fleksibilitas Anda demi pelayanan yang maksimal.\n\n` +
      `Terima kasih.`;
  }

  private generateScheduleChangeMessage(payload: any): string {
    const { patientName, doctorName, dayName, newTime, poliName, type } = payload;
    let changeText = `mengalami penyesuaian jam praktik`;
    if (type === 'deleted') changeText = `ditiadakan sementara`;

    return `*PENGUMUMAN PERUBAHAN JADWAL DOKTER - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Kami menginformasikan bahwa jadwal praktik dokter spesialis kami untuk hari *${dayName}* ${changeText}:\n\n` +
      `👨‍⚕️ Dokter: *${doctorName}*\n` +
      `🏥 Poliklinik: ${poliName}\n` +
      `${type === 'modified' ? `⏰ Jam Praktik Terbaru: *${newTime}* WITA` : ''}\n\n` +
      `Mohon Bapak/Ibu menyesuaikan rencana kunjungan. Jadwal lengkap dokter dapat diakses setiap saat melalui website resmi kami.\n\n` +
      `Semoga Bapak/Ibu senantiasa diberikan kesehatan.\n\n` +
      `*Hormat Kami,*\n` +
      `Manajemen RSI Siti Hajar`;
  }

  private generateReminderMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `*PENGINGAT (REMINDER) KUNJUNGAN - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Sampai jumpa BESOK dalam janji temu Anda di RSI Siti Hajar Mataram.\n\n` +
      `📌 *Jadwal Esok Hari:*\n` +
      `🎫 Kode Booking: *${bookingCode}*\n` +
      `👨‍⚕️ Dokter: ${doctorName}\n` +
      `🏥 Poliklinik: ${poliName}\n` +
      `🗓️ Tanggal: ${bookingDate}\n` +
      `⏰ Waktu: ${bookingTime} WITA\n\n` +
      `Mohon hadir tepat waktu dan membawa persyaratan pendaftaran untuk kenyamanan bersama.\n\n` +
      `Sampai jumpa esok hari.`;
  }

  private generateDoctorLeaveMessage(payload: {
    patientName: string;
    doctorName: string;
    appointmentDate: string;
    appointmentTime: string;
    bookingCode: string;
  }): string {
    const { patientName, doctorName, appointmentDate, appointmentTime } = payload;
    return `*PEMBERITAHUAN DOKTER BERHALANGAN HADIR - RSI SITI HAJAR*\n\n` +
      `Salam Sejahtera Bapak/Ibu *${patientName}*,\n\n` +
      `Kami memohon maaf yang sebesar-besarnya, dr. *${doctorName}* berhalangan hadir pada jadwal Anda:\n\n` +
      `🗓️ Hari/Tgl: ${appointmentDate}\n` +
      `⏰ Waktu: ${appointmentTime} WITA\n\n` +
      `Demi kenyamanan pengobatan Anda, silakan melakukan pendaftaran ulang untuk jadwal dokter lainnya atau hari lain melalui website kami.\n\n` +
      `Atas pengertian Bapak/Ibu, kami sampaikan terima kasih.\n\n` +
      `*Hormat Kami,*\n` +
      `Manajemen Pelayanan RSI Siti Hajar`;
  }
}