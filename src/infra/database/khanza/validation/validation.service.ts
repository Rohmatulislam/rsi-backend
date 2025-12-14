import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly dbService: KhanzaDBService) { }

  async checkDoctorQuota(doctorCode: string, date: string): Promise<{
    available: boolean;
    current: number;
    max: number;
    message: string;
  }> {
    try {
      // Get current booking count
      const bookingCount = await this.dbService.db('reg_periksa')
        .where('kd_dokter', doctorCode)
        .where('tgl_registrasi', date)
        .whereNot('stts', 'Batal')
        .count('* as count')
        .first();

      const currentCount = parseInt(String(bookingCount?.count || '0'));

      // Get max quota from jadwal (if exists)
      const dayOfWeek = new Date(date).toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase();
      const schedule = await this.dbService.db('jadwal')
        .where('kd_dokter', doctorCode)
        .where('hari_kerja', dayOfWeek)
        .first();

      // Default max quota if not set
      const maxQuota = schedule?.kuota || 50; // Default 50 patients per session

      const available = currentCount < maxQuota;

      return {
        available,
        current: currentCount,
        max: maxQuota,
        message: available
          ? `Tersedia ${maxQuota - currentCount} slot`
          : 'Kuota penuh untuk tanggal ini'
      };
    } catch (error) {
      this.logger.error('Error checking doctor quota', error);
      // Default to available on error to not block booking
      return {
        available: true,
        current: 0,
        max: 50,
        message: 'Quota check unavailable, proceeding with booking'
      };
    }
  }

  async isHoliday(date: string): Promise<boolean> {
    try {
      const holiday = await this.dbService.db('hari_libur')
        .where('tanggal', date)
        .first();
      return !!holiday;
    } catch (error) {
      // Table might not exist in some Khanza versions
      return false;
    }
  }

  async isDoctorAvailable(doctorCode: string, date: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    try {
      // Check if holiday
      const isHoliday = await this.isHoliday(date);
      if (isHoliday) {
        return { available: false, reason: 'Tanggal merupakan hari libur' };
      }

      // Check doctor schedule
      const dayOfWeek = new Date(date).toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase();
      const schedule = await this.dbService.db('jadwal')
        .where('kd_dokter', doctorCode)
        .where('hari_kerja', dayOfWeek)
        .first();

      if (!schedule) {
        return { available: false, reason: 'Dokter tidak praktek pada hari ini' };
      }

      // Check quota
      const quota = await this.checkDoctorQuota(doctorCode, date);
      if (!quota.available) {
        return { available: false, reason: quota.message };
      }

      return { available: true };
    } catch (error) {
      this.logger.error('Error checking doctor availability', error);
      return { available: true }; // Default to available on error
    }
  }
}