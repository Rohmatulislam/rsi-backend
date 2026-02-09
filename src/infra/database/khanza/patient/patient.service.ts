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
        const allSukus = await this.dbService.db('suku_bangsa').select('*');
        this.logger.log(`Available suku_bangsa:`, allSukus.slice(0, 5)); // Show first 5 only

        const defaultSuku = await this.dbService.db('suku_bangsa').first();
        if (defaultSuku) {
          defaultSukuBangsaCode = defaultSuku.id; // assuming the primary key is 'id'
        } else {
          // Try to get minimum ID
          const minSukuId = await this.dbService.db('suku_bangsa').min('id as min_id').first();
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
        const allBahasa = await this.dbService.db('bahasa_pasien').select('*');
        this.logger.log(`Available bahasa_pasien:`, allBahasa.slice(0, 5)); // Show first 5 only

        const defaultBahasa = await this.dbService.db('bahasa_pasien').first();
        if (defaultBahasa) {
          defaultBahasaCode = defaultBahasa.id;
        } else {
          // Try to get minimum ID
          const minBahasaId = await this.dbService.db('bahasa_pasien').min('id as min_id').first();
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
        const allCacatFisik = await this.dbService.db('cacat_fisik').select('*');
        this.logger.log(`Available cacat_fisik:`, allCacatFisik.slice(0, 5)); // Show first 5 only

        const defaultCacat = await this.dbService.db('cacat_fisik').first();
        if (defaultCacat) {
          defaultCacatFisikCode = defaultCacat.id;
        } else {
          // Try to get minimum ID
          const minCacatId = await this.dbService.db('cacat_fisik').min('id as min_id').first();
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

      await this.dbService.db('pasien').insert(patientData);

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
      const lastPatient = await this.dbService.db('pasien')
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
}