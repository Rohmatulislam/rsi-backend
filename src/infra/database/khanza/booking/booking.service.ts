import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private readonly dbService: KhanzaDBService) { }

  async createBooking(data: {
    doctorCode: string;
    patient: any;
    date: string; // YYYY-MM-DD
    poliCode: string;
    paymentType: string; // kd_pj dari Khanza (misalnya: "A01", "BPJ", dll)
  }) {
    const { doctorCode, patient, date, poliCode, paymentType } = data;

    // 1. Generate No Rawat
    const noRawat = await this.getNextNoRawat(date);

    // 2. Generate No Reg
    const noReg = await this.getNextNoReg(doctorCode, date);

    // 3. Prepare Data
    // Default values mapping (Adjust based on Khanza logic/Enum)
    const jamReg = new Date().toLocaleTimeString('id-ID', { hour12: false }).replace(/\./g, ':'); // HH:MM:SS

    const insertData = {
      no_reg: noReg,
      no_rawat: noRawat,
      jam_reg: jamReg,
      kd_dokter: doctorCode,
      no_rkm_medis: patient.no_rkm_medis,
      kd_poli: poliCode,
      p_jawab: patient.namakeluarga || 'DIRI SENDIRI', // Fallback to self?
      almt_pj: patient.alamatpj || patient.alamat,
      hubunganpj: patient.keluarga,
      biaya_reg: 0, // Should fetch from poliklinik table normally
      stts: 'Belum',
      stts_daftar: 'Lama', // Or check if new patient
      status_lanjut: 'Ralan',
      kd_pj: '', // Akan di-set setelah validasi payment method
      umurdaftar: 0, // Calculate age
      sttsumur: 'Th',
      status_bayar: 'Belum Bayar',
      status_poli: 'Lama', // Logic for this?
      tgl_registrasi: date // IMPORTANT: Missing in provided list but essential for PK usually
    };

    // Calculate Age helper
    if (patient.tgl_lahir) {
      const birthDate = new Date(patient.tgl_lahir);
      const today = new Date(date);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      insertData.umurdaftar = age;
    }

    // Lookup biaya registrasi (Example)
    const poliMap = await this.dbService.db('poliklinik').where('kd_poli', poliCode).first();
    if (poliMap) {
      insertData.biaya_reg = poliMap.registrasi || 0;
    }

    // paymentType sekarang sudah berisi kd_pj langsung dari Khanza
    // Validasi bahwa kode penjab valid
    const caraBayar = await this.dbService.db('penjab').where('kd_pj', paymentType).first();
    if (caraBayar) {
      insertData.kd_pj = paymentType;
      this.logger.log(`✅ Payment method validated: ${paymentType} - ${caraBayar.png_jawab}`);
    } else {
      // Fallback: cari berdasarkan nama jika kode tidak ditemukan (backward compatibility)
      const fallbackPayment = await this.dbService.db('penjab')
        .where('png_jawab', 'like', `%${paymentType}%`)
        .first();

      if (fallbackPayment) {
        insertData.kd_pj = fallbackPayment.kd_pj;
        this.logger.log(`⚠️ Payment method found by name: ${fallbackPayment.kd_pj}`);
      } else {
        // Default fallback
        insertData.kd_pj = '-';
        this.logger.warn(`⚠️ Payment method not found: ${paymentType}, using default '-'`);
      }
    }

    try {
      await this.dbService.db('reg_periksa').insert(insertData);

      this.logger.log(`Booking Created: ${noRawat}`);

      return {
        success: true,
        message: 'Booking Data Sent',
        no_reg: noReg,
        no_rawat: noRawat
      };
    } catch (e) {
      this.logger.error('Error inserting reg_periksa', e);
      throw e;
    }
  }

  async cancelBooking(noRawat: string) {
    try {
      // Update status booking in reg_periksa to show it's cancelled
      const result = await this.dbService.db('reg_periksa')
        .where('no_rawat', noRawat)
        .update({
          stts: 'Batal',
          status_bayar: 'Batal'
        });

      if (result > 0) {
        this.logger.log(`Booking Cancelled: ${noRawat}`);
        return {
          success: true,
          message: 'Booking cancelled successfully in SIMRS',
          no_rawat: noRawat
        };
      } else {
        throw new Error('Booking not found in SIMRS');
      }
    } catch (e) {
      this.logger.error('Error cancelling booking in SIMRS', e);
      throw e;
    }
  }

  async getBookingByNoRawat(noRawat: string) {
    return this.dbService.db('reg_periksa')
      .where('no_rawat', noRawat)
      .first();
  }

  async getBookingsByDate(date: string) {
    return this.dbService.db('reg_periksa')
      .where('tgl_registrasi', date)
      .select('*');
  }

  async getBookingsByPatient(noRm: string) {
    return this.dbService.db('reg_periksa')
      .where('no_rkm_medis', noRm)
      .select('*');
  }

  async getBookingsByDoctor(doctorCode: string) {
    return this.dbService.db('reg_periksa')
      .where('kd_dokter', doctorCode)
      .select('*');
  }

  async getNextNoRawat(date: string): Promise<string> {
    // Format date: YYYY/MM/DD
    const datePart = date.replace(/-/g, '/'); // Transform YYYY-MM-DD to YYYY/MM/DD if needed

    // Check max no_rawat for this date
    // Khanza usually stores no_rawat like '2023/10/24/000001'
    // Depending on DB version, it might be safer to filter strings starting with datePart
    const lastReg = await this.dbService.db('reg_periksa')
      .where('no_rawat', 'like', `${datePart}%`)
      .orderBy('no_rawat', 'desc')
      .first();

    let nextNumber = 1;
    if (lastReg && lastReg.no_rawat) {
      const parts = lastReg.no_rawat.split('/');
      if (parts.length === 4) {
        nextNumber = parseInt(parts[3]) + 1;
      }
    }

    const paddedNumber = nextNumber.toString().padStart(6, '0');
    return `${datePart}/${paddedNumber}`;
  }

  async getNextNoReg(doctorId: string, date: string): Promise<string> {
    const lastReg = await this.dbService.db('reg_periksa')
      .where('kd_dokter', doctorId)
      .where('tgl_registrasi', date)
      .orderBy('no_reg', 'desc')
      .first();

    let nextNumber = 1;
    if (lastReg && lastReg.no_reg) {
      nextNumber = parseInt(lastReg.no_reg) + 1;
    }

    return nextNumber.toString().padStart(3, '0');
  }
}