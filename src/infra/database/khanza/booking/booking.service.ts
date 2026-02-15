import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';
import { getCurrentTimeWita } from '../../../utils/date.utils';

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
    const jamReg = getCurrentTimeWita(); // HH:MM:SS in WITA

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

  async createMcuBooking(data: {
    patient: any;
    date: string; // YYYY-MM-DD
    timeSlot: string;
    packageId: string;
    packageName: string;
    poliCode: string;
    doctorCode: string;
    paymentType?: string;
    notes?: string;
  }) {
    const { patient, date, timeSlot, packageId, packageName, poliCode, doctorCode, paymentType, notes } = data;

    // 1. Generate No Reg for booking_registrasi (sequential per doctor/date)
    const noReg = await this.getNextNoRegBooking(doctorCode, date);

    // 2. Prepare data for booking_registrasi
    // Map timeSlot to actual time if it's a string like 'pagi', 'siang', 'sore'
    let timeValue = '08:00:00';
    if (timeSlot === 'pagi') timeValue = '08:00:00';
    else if (timeSlot === 'siang') timeValue = '13:00:00';
    else if (timeSlot === 'sore') timeValue = '16:00:00';
    else if (timeSlot && timeSlot.includes(':')) timeValue = timeSlot.includes(':') && timeSlot.split(':').length === 2 ? `${timeSlot}:00` : timeSlot;

    const bookingRegData = {
      tanggal_booking: new Date().toISOString().split('T')[0],
      jam_booking: new Date().toLocaleTimeString('id-ID', { hour12: false }).replace(/\./g, ':'),
      no_rkm_medis: patient.no_rkm_medis,
      tanggal_periksa: date,
      kd_dokter: doctorCode,
      kd_poli: poliCode,
      no_reg: noReg,
      kd_pj: paymentType || 'A09', // Default UMUM
      limit_reg: 0,
      waktu_kunjungan: `${date} ${timeValue}`,
      status: 'Belum'
    };

    // 3. Prepare data for booking_periksa (MCU specific details)
    // In Khanza, booking_periksa often uses a unique booking number. 
    // We'll use a combination of date and MR number or just the no_reg if suitable.
    // However, the schema showed no_booking as varchar(17) PK.
    const noBooking = `BK${date.replace(/-/g, '')}${patient.no_rkm_medis.slice(-4)}${noReg}`;

    const bookingPeriksaData = {
      no_booking: noBooking.slice(0, 17),
      tanggal: date,
      nama: patient.nm_pasien,
      alamat: patient.alamat || '-',
      no_telp: patient.no_tlp || '-',
      email: patient.email || '-',
      kd_poli: poliCode,
      tambahan_pesan: `Paket: ${packageName} (${packageId})${notes ? ' | ' + notes : ''}`,
      status: 'Belum Dibalas',
      tanggal_booking: new Date()
    };

    try {
      await this.dbService.db.transaction(async (trx) => {
        await trx('booking_registrasi').insert(bookingRegData);
        await trx('booking_periksa').insert(bookingPeriksaData);
      });

      this.logger.log(`MCU Booking Created: ${noBooking} for RM ${patient.no_rkm_medis}`);

      return {
        success: true,
        no_reg: noReg,
        no_booking: noBooking,
        no_rawat: noBooking // For consistency with other flows
      };
    } catch (e) {
      this.logger.error('Error creating MCU booking in Khanza', e);
      throw e;
    }
  }

  async createLabBooking(data: {
    patient: any;
    date: string;
    timeSlot: string;
    tests: Array<{ id: string, name: string }>;
    paymentType?: string;
  }) {
    const { patient, date, timeSlot, tests, paymentType } = data;
    const noReg = await this.getNextNoRegBooking('-', date); // Use '-' for generic lab doctor if unknown

    const noBooking = `LB${date.replace(/-/g, '')}${patient.no_rkm_medis.slice(-4)}${noReg}`;

    const bookingPeriksaData = {
      no_booking: noBooking.slice(0, 17),
      tanggal: date,
      nama: patient.nm_pasien,
      alamat: patient.alamat || '-',
      no_telp: patient.no_tlp || '-',
      email: patient.email || '-',
      kd_poli: 'LAB', // Standard code
      tambahan_pesan: `Pemeriksaan Lab: ${tests.map(t => t.name).join(', ')}`,
      status: 'Belum Dibalas',
      tanggal_booking: new Date()
    };

    try {
      await this.dbService.db('booking_periksa').insert(bookingPeriksaData);
      return { success: true, no_booking: noBooking };
    } catch (e) {
      this.logger.error('Error creating Lab booking', e);
      throw e;
    }
  }

  async createRadiologiBooking(data: {
    patient: any;
    date: string;
    timeSlot: string;
    tests: Array<{ id: string, name: string }>;
    paymentType?: string;
  }) {
    const { patient, date, timeSlot, tests, paymentType } = data;
    const noReg = await this.getNextNoRegBooking('-', date);

    const noBooking = `RD${date.replace(/-/g, '')}${patient.no_rkm_medis.slice(-4)}${noReg}`;

    const bookingPeriksaData = {
      no_booking: noBooking.slice(0, 17),
      tanggal: date,
      nama: patient.nm_pasien,
      alamat: patient.alamat || '-',
      no_telp: patient.no_tlp || '-',
      email: patient.email || '-',
      kd_poli: 'RAD', // Standard code
      tambahan_pesan: `Pemeriksaan Radiologi: ${tests.map(t => t.name).join(', ')}`,
      status: 'Belum Dibalas',
      tanggal_booking: new Date()
    };

    try {
      await this.dbService.db('booking_periksa').insert(bookingPeriksaData);
      return { success: true, no_booking: noBooking };
    } catch (e) {
      this.logger.error('Error creating Radiologi booking', e);
      throw e;
    }
  }

  async getNextNoRegBooking(doctorCode: string, date: string): Promise<string> {
    const lastReg = await this.dbService.db('booking_registrasi')
      .where('kd_dokter', doctorCode)
      .where('tanggal_periksa', date)
      .orderBy('no_reg', 'desc')
      .first();

    let nextNumber = 1;
    if (lastReg && lastReg.no_reg) {
      nextNumber = parseInt(lastReg.no_reg) + 1;
    }

    return nextNumber.toString().padStart(3, '0');
  }

  /**
   * Get list of patients in queue with their status (waiting/served)
   */
  async getQueuePatients(poliCode: string, date: string): Promise<{
    patients: Array<{
      no_reg: string;
      nm_pasien: string;
      stts: string;
      jam_reg: string;
      is_waiting: boolean;
    }>;
  }> {
    try {
      const patients = await this.dbService.db('reg_periksa as r')
        .join('pasien as p', 'r.no_rkm_medis', 'p.no_rkm_medis')
        .where({
          'r.kd_poli': poliCode,
          'r.tgl_registrasi': date
        })
        .whereNot('r.stts', 'Batal')
        .select([
          'r.no_reg',
          'p.nm_pasien',
          'r.stts',
          'r.jam_reg'
        ])
        .orderBy('r.no_reg', 'asc');

      return {
        patients: patients.map(p => ({
          no_reg: p.no_reg,
          nm_pasien: p.nm_pasien,
          stts: p.stts,
          jam_reg: p.jam_reg,
          is_waiting: p.stts === 'Belum'
        }))
      };
    } catch (error) {
      this.logger.error(`Error fetching queue patients for poli ${poliCode} on ${date}:`, error);
      return { patients: [] };
    }
  }

  async getQueueInfo(poliCode: string, date: string): Promise<{
    total: number;
    served: number;
    current: string;
    remaining: number;
    currentDoctor?: string;
  }> {
    try {
      // 1. Optimized aggregation query to get counts and the last served registration number
      const stats = await this.dbService.db('reg_periksa')
        .where({
          kd_poli: poliCode,
          tgl_registrasi: date
        })
        .whereNot('stts', 'Batal')
        .select([
          this.dbService.db.raw('COUNT(*) as total'),
          this.dbService.db.raw('SUM(CASE WHEN stts NOT IN ("Belum", "Batal") THEN 1 ELSE 0 END) as served'),
          this.dbService.db.raw('MAX(CASE WHEN stts NOT IN ("Belum", "Batal") THEN no_reg ELSE NULL END) as currentReg'),
          this.dbService.db.raw('SUM(CASE WHEN stts = "Belum" THEN 1 ELSE 0 END) as remaining')
        ])
        .first() as any;

      const total = parseInt(String(stats?.total || '0'));
      const served = parseInt(String(stats?.served || '0'));
      const remaining = parseInt(String(stats?.remaining || '0'));
      const currentReg = stats?.currentReg;

      let lastServed = '-';
      let currentDoctor = '-';

      // 2. If someone is being served, fetch the doctor's name for that specific registration
      if (currentReg) {
        lastServed = currentReg;

        const doctorInfo = await this.dbService.db('reg_periksa')
          .leftJoin('dokter', 'reg_periksa.kd_dokter', '=', 'dokter.kd_dokter')
          .where({
            kd_poli: poliCode,
            tgl_registrasi: date,
            no_reg: currentReg
          })
          .whereNot('reg_periksa.stts', 'Batal')
          .select('dokter.nm_dokter')
          .first();

        if (doctorInfo) {
          currentDoctor = doctorInfo.nm_dokter || '-';
        }
      }

      return {
        total,
        served,
        current: lastServed,
        remaining,
        currentDoctor
      };
    } catch (error) {
      this.logger.error(`Error querying queue info for poli ${poliCode} on ${date}:`, error);
      // Return default values on error
      return {
        total: 0,
        served: 0,
        current: '-',
        remaining: 0,
        currentDoctor: '-'
      };
    }
  }

  async cancelBooking(noRawat: string) {
    try {
      this.logger.log(`Attempting to cancel booking in Khanza: ${noRawat}`);

      // Update status booking in reg_periksa to show it's cancelled
      // Note: status_bayar has limited length, using shorter value
      const result = await this.dbService.db('reg_periksa')
        .where('no_rawat', noRawat)
        .update({
          stts: 'Batal'
          // status_bayar tidak di-update karena limitasi column length di Khanza
        });

      if (result > 0) {
        this.logger.log(`Booking Cancelled in Khanza: ${noRawat}`);
        return {
          success: true,
          message: 'Booking cancelled successfully in SIMRS',
          no_rawat: noRawat
        };
      } else {
        this.logger.warn(`Booking not found in Khanza: ${noRawat}`);
        throw new Error('Booking not found in SIMRS');
      }
    } catch (e) {
      this.logger.error('Error cancelling booking in SIMRS', e);
      throw e;
    }
  }

  async updateBookingDate(noRawat: string, newDate: string) {
    try {
      this.logger.log(`Attempting to reschedule booking in Khanza: ${noRawat} to ${newDate}`);

      // Check if booking exists
      const existingBooking = await this.dbService.db('reg_periksa')
        .where('no_rawat', noRawat)
        .first();

      if (!existingBooking) {
        this.logger.warn(`Booking not found in Khanza: ${noRawat}`);
        throw new Error('Booking not found in SIMRS');
      }

      // Update the registration date
      const result = await this.dbService.db('reg_periksa')
        .where('no_rawat', noRawat)
        .update({
          tgl_registrasi: newDate
        });

      if (result > 0) {
        this.logger.log(`Booking Rescheduled in Khanza: ${noRawat} to ${newDate}`);
        return {
          success: true,
          message: 'Booking rescheduled successfully in SIMRS',
          no_rawat: noRawat,
          new_date: newDate
        };
      } else {
        throw new Error('Failed to update booking date in SIMRS');
      }
    } catch (e) {
      this.logger.error('Error rescheduling booking in SIMRS', e);
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

  async getBookingCountsByDate(date: string): Promise<{ kd_dokter: string, count: number }[]> {
    // Count bookings grouped by doctor for efficient quota calculation
    const counts = await this.dbService.db('reg_periksa')
      .where('tgl_registrasi', date)
      .andWhere('stts', '!=', 'Batal') // Exclude cancelled ones
      .select('kd_dokter')
      .count('no_rawat as count')
      .groupBy('kd_dokter');

    return counts.map(row => ({
      kd_dokter: row.kd_dokter as string,
      count: parseInt(row.count as string) || 0
    }));
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