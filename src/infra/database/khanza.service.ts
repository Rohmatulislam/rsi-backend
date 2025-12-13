import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KhanzaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KhanzaService.name);
  public db: Knex;

  constructor(private configService: ConfigService) {
    this.db = knex({
      client: 'mysql2',
      connection: {
        host: this.configService.get<string>('KHANZA_DB_HOST', 'localhost'),
        port: this.configService.get<number>('KHANZA_DB_PORT', 3306),
        user: this.configService.get<string>('KHANZA_DB_USER', 'root'),
        password: this.configService.get<string>('KHANZA_DB_PASSWORD', ''),
        database: this.configService.get<string>('KHANZA_DB_NAME', 'sik'),
      },
      pool: { min: 0, max: 7 },
    });
  }

  async onModuleInit() {
    try {
      await this.db.raw('SELECT 1');
      this.logger.log('Successfully connected to Khanza SIMRS Database');
    } catch (error) {
      this.logger.error('Failed to connect to Khanza SIMRS Database', error);
    }
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }

  // --- Sync Data Methods ---
  async getPoliklinik() {
    return this.db('poliklinik').select('kd_poli', 'nm_poli');
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.db('poliklinik').where('kd_poli', kdPoli).first();
  }

  async getDoctors() {
    return this.db('dokter')
      .select('kd_dokter', 'nm_dokter', 'kd_sps', 'no_telp')
      .where('status', '1');
  }

  async getDoctorSchedules() {
    return this.db('jadwal').select('*');
  }

  async getSpesialis() {
    return this.db('spesialis').select('kd_sps', 'nm_sps');
  }

  async getPaymentMethods() {
    return this.db('penjab').select('*');
  }

  async getKabupatens() {
    return this.db('kabupaten').select('*');
  }

  async getKecamatans() {
    return this.db('kecamatan').select('*');
  }

  async getKelurahans() {
    return this.db('kelurahan').select('*');
  }

  async getPropinsis() {
    return this.db('propinsi').select('*');
  }

  async getSukuBangsas() {
    return this.db('suku_bangsa').select('*');
  }

  async getBahasaPasiens() {
    return this.db('bahasa_pasien').select('*');
  }

  async getCacatFisiks() {
    return this.db('cacat_fisik').select('*');
  }

  // --- Bridging Methods ---
  async findPoliByDoctor(doctorCode: string) {
    // Try to find poli from schedule (jadwal)
    const schedule = await this.db('jadwal').where('kd_dokter', doctorCode).first();
    return schedule?.kd_poli || '-';
  }

  async findPatientByNoRM(noRM: string) {
    this.logger.log(`🔍 [KHANZA] Searching patient in table 'pasien' with no_rkm_medis: ${noRM}`);
    try {
      const patient = await this.db('pasien').where('no_rkm_medis', noRM).first();

      if (patient) {
        this.logger.log(`✅ [KHANZA] Patient found: ${patient.nm_pasien} (RM: ${patient.no_rkm_medis})`);
      } else {
        this.logger.warn(`⚠️ [KHANZA] No patient found with no_rkm_medis: ${noRM}`);
      }

      return patient;
    } catch (error) {
      this.logger.error(`❌ [KHANZA] Database error while searching patient:`, error);
      throw error;
    }
  }

  async findPatientByNIK(nik: string) {
    return this.db('pasien').where('no_ktp', nik).first();
  }

  async createPatient(data: {
    name: string;
    nik: string;
    birthDate: string; // YYYY-MM-DD
    gender: string; // L/P
    address: string;
    phone: string;
    email?: string;
    rt?: string;
    rw?: string;
    kelurahan?: string;
    kecamatan?: string;
    kabupaten?: string;
    provinsi?: string;
    bloodType?: string; // A/B/AB/O
    education?: string;
    maritalStatus?: string; // BELUM MENIKAH/MENIKAH/JANDA/DUDA
    religion?: string; // ISLAM/KRISTEN/KATOLIK/HINDU/BUDDHA/KONGHUCU
    occupation?: string;
  }) {
    try {
      const noRM = await this.getNextNoRM();

      // Calculate age
      const birthDate = new Date(data.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Get default payment method code
      let defaultPaymentCode = '-'; // Default fallback as string
      try {
        // Log available payment methods first to understand the data
        const allPaymentMethods = await this.db('penjab').select('*');
        this.logger.log(`Available payment methods:`, allPaymentMethods);

        // Try to get 'UMUM' payment method first, or any available if 'UMUM' doesn't exist
        let defaultPaymentMethod = await this.db('penjab')
          .where('png_jawab', 'like', '%UMUM%')
          .orWhere('png_jawab', 'like', '%TUNAI%')
          .orWhere('png_jawab', 'like', '%UM%')
          .first();

        if (!defaultPaymentMethod) {
          // Fallback to first available payment method
          defaultPaymentMethod = await this.db('penjab').first();
        }

        if (defaultPaymentMethod) {
          defaultPaymentCode = defaultPaymentMethod.kd_pj;
          this.logger.log(`Using payment method code: ${defaultPaymentCode}`);
        }
      } catch (error) {
        // If penjab table doesn't exist or error, continue with default value
        this.logger.warn('Could not fetch default payment method, using fallback');
      }

      // Get default wilayah codes (kabupaten, kecamatan, kelurahan, propinsi)
      let defaultKabCode = 0;
      let defaultKecCode = 0;
      let defaultKelCode = 0;
      let defaultPropCode = 0;

      try {
        // Log available wilayah data first to understand the structure
        const allKabupatens = await this.db('kabupaten').select('*');
        this.logger.log(`Available kabupatens:`, allKabupatens.slice(0, 5)); // Show first 5 only

        const allKecamatans = await this.db('kecamatan').select('*');
        this.logger.log(`Available kecamatans:`, allKecamatans.slice(0, 5)); // Show first 5 only

        const allKelurahans = await this.db('kelurahan').select('*');
        this.logger.log(`Available kelurahans:`, allKelurahans.slice(0, 5)); // Show first 5 only

        const allPropinsis = await this.db('propinsi').select('*');
        this.logger.log(`Available propinsis:`, allPropinsis.slice(0, 5)); // Show first 5 only

        // Try to get first available codes from reference tables
        const defaultKabupaten = await this.db('kabupaten').first();
        if (defaultKabupaten) {
          defaultKabCode = defaultKabupaten.kd_kab;
        } else {
          // If no kabupaten found, try to find a valid ID or use minimum ID if table exists but empty
          try {
            // Try to get minimum ID
            const minKabId = await this.db('kabupaten').min('kd_kab as min_id').first();
            if (minKabId && minKabId.min_id !== null) {
              defaultKabCode = minKabId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultKecamatan = await this.db('kecamatan').first();
        if (defaultKecamatan) {
          defaultKecCode = defaultKecamatan.kd_kec;
        } else {
          try {
            const minKecId = await this.db('kecamatan').min('kd_kec as min_id').first();
            if (minKecId && minKecId.min_id !== null) {
              defaultKecCode = minKecId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultKelurahan = await this.db('kelurahan').first();
        if (defaultKelurahan) {
          defaultKelCode = defaultKelurahan.kd_kel;
        } else {
          try {
            const minKelId = await this.db('kelurahan').min('kd_kel as min_id').first();
            if (minKelId && minKelId.min_id !== null) {
              defaultKelCode = minKelId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultPropinsi = await this.db('propinsi').first();
        if (defaultPropinsi) {
          defaultPropCode = defaultPropinsi.kd_prop;
        } else {
          try {
            const minPropId = await this.db('propinsi').min('kd_prop as min_id').first();
            if (minPropId && minPropId.min_id !== null) {
              defaultPropCode = minPropId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }
      } catch (error) {
        // If reference tables don't exist or error, continue with default values (0)
        this.logger.warn('Could not fetch default wilayah codes, using fallback');
      }

      const patientData = {
        no_rkm_medis: noRM,
        nm_pasien: data.name,
        no_ktp: data.nik,
        jk: data.gender,
        tmp_lahir: '-', // Place of birth - could be added to params
        tgl_lahir: data.birthDate,
        nm_ibu: '-', // Mother's name - could be added to params
        alamat: data.address,
        gol_darah: data.bloodType || '-',
        pekerjaan: data.occupation || '-',
        stts_nikah: data.maritalStatus || 'BELUM MENIKAH',
        agama: data.religion || 'ISLAM',
        tgl_daftar: new Date().toISOString().split('T')[0],
        no_tlp: data.phone,
        umur: `${age} Th 0 Bl 0 Hr`,
        pnd: data.education || '-',
        keluarga: 'DIRI SENDIRI',
        namakeluarga: data.name,
        kd_pj: defaultPaymentCode, // Gunakan kode penjamin yang valid dari tabel penjab
        no_peserta: '',
        kd_kab: defaultKabCode, // Integer field, gunakan kode referensi yang valid
        kd_kel: defaultKelCode, // Integer field, gunakan kode referensi yang valid
        kd_kec: defaultKecCode, // Integer field, gunakan kode referensi yang valid
        pekerjaanpj: data.occupation || '-',
        alamatpj: data.address,
        kelurahanpj: data.kelurahan || '-',
        kecamatanpj: data.kecamatan || '-',
        kabupatenpj: data.kabupaten || '-',
        perusahaan_pasien: '-',
        // Field integer, gunakan format yang sesuai struktur tabel - akan diupdate nanti
        suku_bangsa: 0,
        bahasa_pasien: 0,
        cacat_fisik: 0, // Integer field, gunakan 0 sebagai default
        email: data.email || '',
        nip: '',
        kd_prop: defaultPropCode, // Integer field, gunakan kode referensi yang valid
        propinsipj: data.provinsi || '-',
      };

      // Get default suku_bangsa code
      let defaultSukuBangsaCode = 0;
      try {
        const allSukus = await this.db('suku_bangsa').select('*');
        this.logger.log(`Available suku_bangsa:`, allSukus.slice(0, 5)); // Show first 5 only

        const defaultSuku = await this.db('suku_bangsa').first();
        if (defaultSuku) {
          defaultSukuBangsaCode = defaultSuku.id; // assuming the primary key is 'id'
        } else {
          // Try to get minimum ID
          const minSukuId = await this.db('suku_bangsa').min('id as min_id').first();
          if (minSukuId && minSukuId.min_id !== null) {
            defaultSukuBangsaCode = minSukuId.min_id;
          }
        }
      } catch (error) {
        // If suku_bangsa table doesn't exist or error, continue with default value (0)
        this.logger.warn('Could not fetch suku_bangsa, using fallback');
      }

      // Update the patient data with correct suku_bangsa code
      patientData.suku_bangsa = defaultSukuBangsaCode;

      // Similarly handle bahasa_pasien if it has a reference table
      let defaultBahasaCode = 0;
      try {
        const allBahasa = await this.db('bahasa_pasien').select('*');
        this.logger.log(`Available bahasa_pasien:`, allBahasa.slice(0, 5)); // Show first 5 only

        const defaultBahasa = await this.db('bahasa_pasien').first();
        if (defaultBahasa) {
          defaultBahasaCode = defaultBahasa.id;
        } else {
          // Try to get minimum ID
          const minBahasaId = await this.db('bahasa_pasien').min('id as min_id').first();
          if (minBahasaId && minBahasaId.min_id !== null) {
            defaultBahasaCode = minBahasaId.min_id;
          }
        }
      } catch (error) {
        // If bahasa_pasien table doesn't exist or error, continue with default value (0)
        this.logger.warn('Could not fetch bahasa_pasien, using fallback');
      }

      // Update the patient data with correct bahasa_pasien code
      patientData.bahasa_pasien = defaultBahasaCode;

      // Similarly handle cacat_fisik if it has a reference table
      let defaultCacatFisikCode = 0;
      try {
        const allCacatFisik = await this.db('cacat_fisik').select('*');
        this.logger.log(`Available cacat_fisik:`, allCacatFisik.slice(0, 5)); // Show first 5 only

        const defaultCacat = await this.db('cacat_fisik').first();
        if (defaultCacat) {
          defaultCacatFisikCode = defaultCacat.id;
        } else {
          // Try to get minimum ID
          const minCacatId = await this.db('cacat_fisik').min('id as min_id').first();
          if (minCacatId && minCacatId.min_id !== null) {
            defaultCacatFisikCode = minCacatId.min_id;
          }
        }
      } catch (error) {
        // If cacat_fisik table doesn't exist or error, continue with default value (0)
        this.logger.warn('Could not fetch cacat_fisik, using fallback');
      }

      // Update the patient data with correct cacat_fisik code
      patientData.cacat_fisik = defaultCacatFisikCode;

      await this.db('pasien').insert(patientData);

      this.logger.log(`New patient created: ${noRM} - ${data.name}`);

      return {
        success: true,
        no_rkm_medis: noRM,
        message: 'Patient registered successfully'
      };
    } catch (error) {
      this.logger.error('Error creating patient', error);
      throw error;
    }
  }

  async getNextNoRM(): Promise<string> {
    try {
      const lastPatient = await this.db('pasien')
        .orderBy('no_rkm_medis', 'desc')
        .first();

      let nextNumber = 1;
      if (lastPatient && lastPatient.no_rkm_medis) {
        // Assuming format: 000001, 000002, etc.
        const currentNumber = parseInt(lastPatient.no_rkm_medis);
        if (!isNaN(currentNumber)) {
          nextNumber = currentNumber + 1;
        }
      }

      return nextNumber.toString().padStart(6, '0');
    } catch (error) {
      this.logger.error('Error generating next No RM', error);
      // Fallback to timestamp-based
      return Date.now().toString().slice(-6);
    }
  }

  // --- Booking Methods ---
  async createBooking(data: {
    doctorCode: string;
    patient: any;
    date: string; // YYYY-MM-DD
    poliCode: string;
    paymentType: string; // 'umum' | 'bpjs'
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
      p_jawab: patient.namakeluarga || patient.nm_pasien, // Fallback to self?
      almt_pj: patient.alamatpj || patient.alamat,
      hubunganpj: patient.keluarga || 'DIRI SENDIRI',
      biaya_reg: 0, // Should fetch from poliklinik table normally
      stts: 'Belum',
      stts_daftar: 'Lama', // Or check if new patient
      status_lanjut: 'Ralan',
      kd_pj: paymentType === 'bpjs' ? 'BPJ' : '-', // Check `cara_bayar` table
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
    const poliMap = await this.db('poliklinik').where('kd_poli', poliCode).first();
    if (poliMap) {
      insertData.biaya_reg = poliMap.registrasi || 0;
    }

    const caraBayar = await this.db('penjab').where('png_jawab', 'like', `%${paymentType}%`).first();
    if (caraBayar) {
      insertData.kd_pj = caraBayar.kd_pj;
    } else {
      insertData.kd_pj = paymentType === 'bpjs' ? 'BPJ' : '-'; // Fallback
    }

    try {
      await this.db('reg_periksa').insert(insertData);

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
      const result = await this.db('reg_periksa')
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
    return this.db('reg_periksa')
      .where('no_rawat', noRawat)
      .first();
  }

  async getBookingsByDate(date: string) {
    return this.db('reg_periksa')
      .where('tgl_registrasi', date)
      .select('*');
  }

  async getBookingsByPatient(noRm: string) {
    return this.db('reg_periksa')
      .where('no_rkm_medis', noRm)
      .select('*');
  }

  async getBookingsByDoctor(doctorCode: string) {
    return this.db('reg_periksa')
      .where('kd_dokter', doctorCode)
      .select('*');
  }

  async getNextNoRawat(date: string): Promise<string> {
    // Format date: YYYY/MM/DD
    const datePart = date.replace(/-/g, '/'); // Transform YYYY-MM-DD to YYYY/MM/DD if needed

    // Check max no_rawat for this date
    // Khanza usually stores no_rawat like '2023/10/24/000001'
    // Depending on DB version, it might be safer to filter strings starting with datePart
    const lastReg = await this.db('reg_periksa')
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
    const lastReg = await this.db('reg_periksa')
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

  // --- Validation Methods ---
  async checkDoctorQuota(doctorCode: string, date: string): Promise<{
    available: boolean;
    current: number;
    max: number;
    message: string;
  }> {
    try {
      // Get current booking count
      const bookingCount = await this.db('reg_periksa')
        .where('kd_dokter', doctorCode)
        .where('tgl_registrasi', date)
        .whereNot('stts', 'Batal')
        .count('* as count')
        .first();

      const currentCount = parseInt(String(bookingCount?.count || '0'));

      // Get max quota from jadwal (if exists)
      const dayOfWeek = new Date(date).toLocaleDateString('id-ID', { weekday: 'long' }).toUpperCase();
      const schedule = await this.db('jadwal')
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
      const holiday = await this.db('hari_libur')
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
      const schedule = await this.db('jadwal')
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

  // --- Monitoring Methods ---
  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await this.db.raw('SELECT 1');
      const latency = Date.now() - startTime;
      return { connected: true, latency };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  async getBookingStats(date?: string): Promise<{
    totalBookings: number;
    byStatus: Record<string, number>;
    byPoli: Record<string, number>;
    byPaymentType: Record<string, number>;
  }> {
    try {
      const query = this.db('reg_periksa');

      if (date) {
        query.where('tgl_registrasi', date);
      } else {
        // Today's stats
        const today = new Date().toISOString().split('T')[0];
        query.where('tgl_registrasi', today);
      }

      const bookings = await query.select('*');

      const stats = {
        totalBookings: bookings.length,
        byStatus: {} as Record<string, number>,
        byPoli: {} as Record<string, number>,
        byPaymentType: {} as Record<string, number>,
      };

      bookings.forEach(booking => {
        // Count by status
        stats.byStatus[booking.stts] = (stats.byStatus[booking.stts] || 0) + 1;

        // Count by poli
        stats.byPoli[booking.kd_poli] = (stats.byPoli[booking.kd_poli] || 0) + 1;

        // Count by payment type
        stats.byPaymentType[booking.kd_pj] = (stats.byPaymentType[booking.kd_pj] || 0) + 1;
      });

      return stats;
    } catch (error) {
      this.logger.error('Error getting booking stats', error);
      return {
        totalBookings: 0,
        byStatus: {},
        byPoli: {},
        byPaymentType: {},
      };
    }
  }
}