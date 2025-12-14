import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/database/prisma.service';
import axios from 'axios';

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
  private readonly fonntteApiUrl = 'https://api.fonnte.com/send';
  private readonly fonttneToken: string;
  private readonly whatsappEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.fonttneToken = this.configService.get('FONNTE_TOKEN') || '';
    this.whatsappEnabled = !!this.fonttneToken;

    if (this.whatsappEnabled) {
      this.logger.log('✅ WhatsApp notification enabled via Fonnte');
    } else {
      this.logger.warn('⚠️ WhatsApp notification disabled - FONNTE_TOKEN not configured');
    }
  }

  // Format phone number for WhatsApp (remove leading 0, add 62)
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

  // Send WhatsApp message via Fonnte
  private async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const formattedPhone = this.formatPhoneNumber(phone);

    if (!this.whatsappEnabled) {
      this.logger.log(`📱 [MOCK] WhatsApp to ${formattedPhone}:\n${message}`);
      return true;
    }

    try {
      const response = await axios.post(
        this.fonntteApiUrl,
        {
          target: formattedPhone,
          message: message,
          countryCode: '62',
        },
        {
          headers: {
            Authorization: this.fonttneToken,
          },
        }
      );

      if (response.data?.status) {
        this.logger.log(`✅ WhatsApp sent to ${formattedPhone}`);
        return true;
      } else {
        this.logger.warn(`⚠️ WhatsApp send failed: ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`❌ WhatsApp send error: ${error.message}`);
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

    // Log the notification
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

    // Log the notification
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

    // Log the notification
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

    // Log the notification
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

  // Message Templates
  private generateBookingConfirmationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `🏥 *RSI Hospital*
━━━━━━━━━━━━━━━━━
✅ *KONFIRMASI BOOKING*
━━━━━━━━━━━━━━━━━

Halo *${patientName}*,

Booking Anda telah berhasil! Berikut detailnya:

📋 *Detail Booking*
• Kode: *${bookingCode}*
• Dokter: *${doctorName}*
• Poli: *${poliName}*
• Tanggal: *${bookingDate}*
• Jam: *${bookingTime}* WIB

📌 *Catatan Penting*
• Harap datang 15 menit sebelum jadwal
• Bawa KTP/kartu identitas
• Bawa kartu BPJS (jika peserta)

Terima kasih telah mempercayakan kesehatan Anda kepada kami. 🙏

_Pesan ini dikirim otomatis oleh sistem RSI Hospital_`;
  }

  private generateCancellationMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `🏥 *RSI Hospital*
━━━━━━━━━━━━━━━━━
❌ *PEMBATALAN BOOKING*
━━━━━━━━━━━━━━━━━

Halo *${patientName}*,

Booking Anda telah *dibatalkan*.

📋 *Detail Booking yang Dibatalkan*
• Kode: *${bookingCode}*
• Dokter: *${doctorName}*
• Poli: *${poliName}*
• Tanggal: *${bookingDate}*
• Jam: *${bookingTime}* WIB

Jika ini kesalahan, silakan buat booking baru melalui website kami.

Terima kasih. 🙏

_Pesan ini dikirim otomatis oleh sistem RSI Hospital_`;
  }

  private generateRescheduleMessage(payload: any): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName, newDate, newTime } = payload;
    return `🏥 *RSI Hospital*
━━━━━━━━━━━━━━━━━
🔄 *PERUBAHAN JADWAL*
━━━━━━━━━━━━━━━━━

Halo *${patientName}*,

Jadwal booking Anda telah *diubah*.

📋 *Jadwal Lama*
• Tanggal: ${bookingDate}
• Jam: ${bookingTime} WIB

📋 *Jadwal Baru*
• Kode: *${bookingCode}*
• Dokter: *${doctorName}*
• Poli: *${poliName}*
• Tanggal: *${newDate}*
• Jam: *${newTime}* WIB

📌 *Catatan*
Harap datang 30 menit sebelum jadwal baru.

Terima kasih. 🙏

_Pesan ini dikirim otomatis oleh sistem RSI Hospital_`;
  }

  private generateReminderMessage(payload: Partial<NotificationPayload>): string {
    const { patientName, bookingDate, bookingTime, doctorName, bookingCode, poliName } = payload;
    return `🏥 *RSI Hospital*
━━━━━━━━━━━━━━━━━
⏰ *PENGINGAT JADWAL*
━━━━━━━━━━━━━━━━━

Halo *${patientName}*,

Ini adalah pengingat untuk jadwal pemeriksaan Anda *besok*.

📋 *Detail Jadwal*
• Kode: *${bookingCode}*
• Dokter: *${doctorName}*
• Poli: *${poliName}*
• Tanggal: *${bookingDate}*
• Jam: *${bookingTime}* WIB

📌 *Persiapan*
• Harap datang 30 menit sebelum jadwal
• Bawa KTP/kartu identitas
• Bawa kartu BPJS (jika peserta)

Sampai jumpa! 👋

_Pesan ini dikirim otomatis oleh sistem RSI Hospital_`;
  }
}