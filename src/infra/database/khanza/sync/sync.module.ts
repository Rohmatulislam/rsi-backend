import { Logger } from '@nestjs/common';
import { Knex } from 'knex';

export class SyncModule {
  constructor(private db: Knex, private logger: Logger) {}

  async getDoctors() {
    // Select column yang relevan
    return await this.db('dokter')
      .select('kd_dokter', 'nm_dokter', 'kd_sps', 'no_telp')
      .where('status', '1');
  }

  async getDoctorSchedules() {
    return await this.db('jadwal')
      .select('*');
  }

  async getPoliklinik() {
    return await this.db('poliklinik').select('kd_poli', 'nm_poli');
  }

  async getSpesialis() {
    return await this.db('spesialis').select('kd_sps', 'nm_sps');
  }

  async getPoliByKdPoli(kdPoli: string) {
    return await this.db('poliklinik').where('kd_poli', kdPoli).first();
  }

  async getPaymentMethods() {
    return await this.db('penjab').select('*');
  }

  async getKabupatens() {
    return await this.db('kabupaten').select('*');
  }

  async getKecamatans() {
    return await this.db('kecamatan').select('*');
  }

  async getKelurahans() {
    return await this.db('kelurahan').select('*');
  }

  async getPropinsis() {
    return await this.db('propinsi').select('*');
  }

  async getSukuBangsas() {
    return await this.db('suku_bangsa').select('*');
  }

  async getBahasaPasiens() {
    return await this.db('bahasa_pasien').select('*');
  }

  async getCacatFisiks() {
    return await this.db('cacat_fisik').select('*');
  }
}