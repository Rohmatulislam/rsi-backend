import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';
import { getTodayFormatted, getStartOfTodayWita } from '../../../utils/date.utils';

@Injectable()
export class PatientService {
  private readonly logger = new Logger(PatientService.name);

  constructor(private readonly dbService: KhanzaDBService) { }

  async findPatientByNoRM(noRM: string) {
    this.logger.log(`🔍 [KHANZA] Searching patient in table 'pasien' with no_rkm_medis: ${noRM}`);
    try {
      const patient = await this.dbService.db('pasien').where('no_rkm_medis', noRM).first();

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
    return this.dbService.db('pasien').where('no_ktp', nik).first();
  }

  async findNoRMByNIK(nik: string): Promise<string | null> {
    try {
      const patient = await this.dbService.db('pasien')
        .where('no_ktp', nik)
        .select('no_rkm_medis')
        .first();
      return patient ? patient.no_rkm_medis : null;
    } catch (error) {
      this.logger.error(`Error finding No RM for NIK ${nik}`, error);
      return null;
    }
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
    motherName?: string;
    birthPlace?: string;
    bpjsNumber?: string; // No. BPJS untuk disimpan ke no_peserta
    penanggungJawab?: string; // Nama penanggung jawab
    hubunganPenanggungJawab?: string; // Hubungan dengan pasien
  }) {
    try {
      const noRM = await this.getNextNoRM();

      // Calculate age
      const birthDate = new Date(data.birthDate);
      const today = getStartOfTodayWita();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      // Get default payment method code
      let defaultPaymentCode = '-'; // Default fallback as string
      try {
        // Log available payment methods first to understand the data
        const allPaymentMethods = await this.dbService.db('penjab').select('*');
        this.logger.log(`Available payment methods:`, allPaymentMethods);

        // Try to get 'UMUM' payment method first, or any available if 'UMUM' doesn't exist
        let defaultPaymentMethod = await this.dbService.db('penjab')
          .where('png_jawab', 'like', '%UMUM%')
          .orWhere('png_jawab', 'like', '%TUNAI%')
          .orWhere('png_jawab', 'like', '%UM%')
          .first();

        if (!defaultPaymentMethod) {
          // Fallback to first available payment method
          defaultPaymentMethod = await this.dbService.db('penjab').first();
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
        const allKabupatens = await this.dbService.db('kabupaten').select('*');
        this.logger.log(`Available kabupatens:`, allKabupatens.slice(0, 5)); // Show first 5 only

        const allKecamatans = await this.dbService.db('kecamatan').select('*');
        this.logger.log(`Available kecamatans:`, allKecamatans.slice(0, 5)); // Show first 5 only

        const allKelurahans = await this.dbService.db('kelurahan').select('*');
        this.logger.log(`Available kelurahans:`, allKelurahans.slice(0, 5)); // Show first 5 only

        const allPropinsis = await this.dbService.db('propinsi').select('*');
        this.logger.log(`Available propinsis:`, allPropinsis.slice(0, 5)); // Show first 5 only

        // Try to get first available codes from reference tables
        const defaultKabupaten = await this.dbService.db('kabupaten').first();
        if (defaultKabupaten) {
          defaultKabCode = defaultKabupaten.kd_kab;
        } else {
          // If no kabupaten found, try to find a valid ID or use minimum ID if table exists but empty
          try {
            // Try to get minimum ID
            const minKabId = await this.dbService.db('kabupaten').min('kd_kab as min_id').first();
            if (minKabId && minKabId.min_id !== null) {
              defaultKabCode = minKabId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultKecamatan = await this.dbService.db('kecamatan').first();
        if (defaultKecamatan) {
          defaultKecCode = defaultKecamatan.kd_kec;
        } else {
          try {
            const minKecId = await this.dbService.db('kecamatan').min('kd_kec as min_id').first();
            if (minKecId && minKecId.min_id !== null) {
              defaultKecCode = minKecId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultKelurahan = await this.dbService.db('kelurahan').first();
        if (defaultKelurahan) {
          defaultKelCode = defaultKelurahan.kd_kel;
        } else {
          try {
            const minKelId = await this.dbService.db('kelurahan').min('kd_kel as min_id').first();
            if (minKelId && minKelId.min_id !== null) {
              defaultKelCode = minKelId.min_id;
            }
          } catch (e) {
            // If min query fails, stick to default 0
          }
        }

        const defaultPropinsi = await this.dbService.db('propinsi').first();
        if (defaultPropinsi) {
          defaultPropCode = defaultPropinsi.kd_prop;
        } else {
          try {
            const minPropId = await this.dbService.db('propinsi').min('kd_prop as min_id').first();
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

      // Get default suku bangsa, bahasa, cacat fisik
      let defaultSukuBangsa = 1; // Default fallback (usually 1 exists)
      let defaultBahasa = 1;
      let defaultCacat = 1;

      try {
        const suku = await this.dbService.db('suku_bangsa').first();
        if (suku) defaultSukuBangsa = suku.id;

        const bahasa = await this.dbService.db('bahasa_pasien').first();
        if (bahasa) defaultBahasa = bahasa.id;

        const cacat = await this.dbService.db('cacat_fisik').first();
        if (cacat) defaultCacat = cacat.id;

        this.logger.log(`Using defaults - Suku: ${defaultSukuBangsa}, Bahasa: ${defaultBahasa}, Cacat: ${defaultCacat}`);
      } catch (e) {
        this.logger.warn('Could not fetch default demographics, using fallback 1');
      }

      const patientData = {
        no_rkm_medis: noRM,
        nm_pasien: data.name,
        no_ktp: data.nik,
        jk: data.gender,
        tmp_lahir: data.birthPlace || '-', // Place of birth
        tgl_lahir: data.birthDate,
        nm_ibu: data.motherName || '-', // Mother's name
        alamat: data.address,
        gol_darah: data.bloodType || '-',
        pekerjaan: data.occupation || '-',
        stts_nikah: data.maritalStatus || 'BELUM MENIKAH',
        agama: data.religion || 'ISLAM',
        tgl_daftar: getTodayFormatted(),
        no_tlp: data.phone,
        umur: `${age} Th 0 Bl 0 Hr`,
        pnd: data.education || '-',
        keluarga: 'DIRI SENDIRI',
        namakeluarga: data.name,
        kd_pj: defaultPaymentCode, // Gunakan kode penjamin yang valid dari tabel penjab
        no_peserta: data.bpjsNumber || '', // No. BPJS
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
        suku_bangsa: defaultSukuBangsa,
        bahasa_pasien: defaultBahasa,
        cacat_fisik: defaultCacat, // Integer field, gunakan valid ID sebagai default
        email: data.email || '',
        nip: '',
        kd_prop: defaultPropCode, // Integer field, gunakan kode referensi yang valid
        propinsipj: data.provinsi || '-',
      };

      // ... (Suku bangsa, bahasa, cacat fisik logic remains the same) ...
      // Assuming existing logic for suku_bangsa, bahasa_pasien, and cacat_fisik updates patientData

      await this.dbService.db('pasien').insert(patientData);

      // SINKRONISASI BALIK: Update set_no_rkm_medis agar Khanza tetap sinkron
      try {
        const nextValNumeric = parseInt(noRM) + 1;
        const nextValStr = nextValNumeric.toString().padStart(6, '0');
        await this.dbService.db('set_no_rkm_medis').update({ no_rkm_medis: nextValStr });
        this.logger.log(`✅ [KHANZA] set_no_rkm_medis updated to: ${nextValStr}`);
      } catch (syncError) {
        this.logger.error('❌ [KHANZA] Failed to sync back no_rkm_medis setting', syncError);
      }

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
      // 1. Ambil dari tabel pengaturan (Source of Truth Khanza)
      const setting = await this.dbService.db('set_no_rkm_medis').select('no_rkm_medis').first();
      let seedNumber = 1;

      if (setting && setting.no_rkm_medis) {
        seedNumber = parseInt(setting.no_rkm_medis);
      }

      // 2. Cari MAX di tabel pasien tapi batasi di rentang valid (6 digit, < 900.000)
      // Gunakan numeric max untuk menghindari masalah lexicographical sort
      // Kita abaikan angka > 900.000 karena itu biasanya data uji coba / sampah
      const result = await this.dbService.db('pasien')
        .whereRaw('LENGTH(no_rkm_medis) <= 6 AND CAST(no_rkm_medis AS UNSIGNED) < 900000')
        .select(this.dbService.db.raw('MAX(CAST(no_rkm_medis AS UNSIGNED)) as max_rm'))
        .first() as any;

      let dbMax = 0;
      if (result && result.max_rm !== null && result.max_rm !== undefined) {
        dbMax = parseInt(result.max_rm.toString());
      }

      // Gunakan yang tertinggi antara setting dan database (plus 1)
      let nextNumber = Math.max(seedNumber, dbMax + 1);

      // 3. Safety Check: Pastikan nomor tidak benar-benar ada di database (collision prevention)
      let isDuplicate = true;
      let finalRM = '';
      let attempts = 0;

      while (isDuplicate && attempts < 10) {
        finalRM = nextNumber.toString().padStart(6, '0');
        const exists = await this.dbService.db('pasien').where('no_rkm_medis', finalRM).first();
        if (!exists) {
          isDuplicate = false;
        } else {
          nextNumber++;
          attempts++;
        }
      }

      return finalRM;
    } catch (error) {
      this.logger.error('Error generating next No RM', error);
      // Fallback manual jika tabel setting tidak ada
      const lastPatient = await this.dbService.db('pasien')
        .whereRaw('LENGTH(no_rkm_medis) <= 6 AND CAST(no_rkm_medis AS UNSIGNED) < 900000')
        .orderByRaw('CAST(no_rkm_medis AS UNSIGNED) DESC')
        .first();

      if (lastPatient && lastPatient.no_rkm_medis) {
        return (parseInt(lastPatient.no_rkm_medis) + 1).toString().padStart(6, '0');
      }
      return Date.now().toString().slice(-6);
    }
  }

  // Additional patient reference data methods
  async getPaymentMethods() {
    try {
      // Try to get payment methods with status filter if column exists
      return await this.dbService.db('penjab')
        .select('kd_pj', 'png_jawab')
        .orderBy('png_jawab', 'asc');
    } catch (error) {
      this.logger.error('Error fetching payment methods:', error);
      return [];
    }
  }

  async getKabupatens() {
    return this.dbService.db('kabupaten').select('*');
  }

  async getKecamatans() {
    return this.dbService.db('kecamatan').select('*');
  }

  async getKelurahans() {
    return this.dbService.db('kelurahan').select('*');
  }

  async getPropinsis() {
    return this.dbService.db('propinsi').select('*');
  }

  async getSukuBangsas() {
    return this.dbService.db('suku_bangsa').select('*');
  }

  async getBahasaPasiens() {
    return this.dbService.db('bahasa_pasien').select('*');
  }

  async getCacatFisiks() {
    return this.dbService.db('cacat_fisik').select('*');
  }

  async getPatientHistory(noRM: string) {
    try {
      // Fetch registrations (visits)
      const visits = await this.dbService.db('reg_periksa')
        .join('dokter', 'reg_periksa.kd_dokter', '=', 'dokter.kd_dokter')
        .join('poliklinik', 'reg_periksa.kd_poli', '=', 'poliklinik.kd_poli')
        .leftJoin('diagnosa_pasien', 'reg_periksa.no_rawat', '=', 'diagnosa_pasien.no_rawat')
        .leftJoin('penyakit', 'diagnosa_pasien.kd_penyakit', '=', 'penyakit.kd_penyakit')
        .where('reg_periksa.no_rkm_medis', noRM)
        .select(
          'reg_periksa.no_rawat',
          'reg_periksa.tgl_registrasi',
          'dokter.nm_dokter',
          'poliklinik.nm_poli',
          'penyakit.nm_penyakit',
          'diagnosa_pasien.prioritas'
        )
        .orderBy('reg_periksa.tgl_registrasi', 'desc')
        .limit(20);

      // Group by no_rawat to handle multiple diagnoses per visit
      const historyMap = new Map();

      visits.forEach(visit => {
        if (!historyMap.has(visit.no_rawat)) {
          historyMap.set(visit.no_rawat, {
            id: visit.no_rawat,
            date: visit.tgl_registrasi,
            doctor: visit.nm_dokter,
            diagnosis: visit.nm_penyakit || 'Belum ada diagnosa',
            notes: `Poli: ${visit.nm_poli}`
          });
        } else if (visit.nm_penyakit) {
          // Append additional diagnoses
          const current = historyMap.get(visit.no_rawat);
          if (current.diagnosis === 'Belum ada diagnosa') {
            current.diagnosis = visit.nm_penyakit;
          } else {
            current.diagnosis += `, ${visit.nm_penyakit}`;
          }
        }
      });

      return Array.from(historyMap.values());
    } catch (error) {
      this.logger.error(`Error fetching patient history for RM ${noRM}`, error);
      return [];
    }
  }
}