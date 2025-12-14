import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class PoliklinikService {
  private readonly logger = new Logger(PoliklinikService.name);

  constructor(private readonly dbService: KhanzaDBService) {}

  async getPoliklinik() {
    return this.dbService.db('poliklinik').select('kd_poli', 'nm_poli');
  }

  async getPoliklinikWithActiveSchedules() {
    // Get poliklinik that have active schedules (not just 00:00:00 times)
    return this.dbService.db('jadwal')
      .select('poliklinik.kd_poli', 'poliklinik.nm_poli')
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .whereNot('jadwal.jam_mulai', '00:00:00')
      .andWhereNot('jadwal.jam_selesai', '00:00:00')
      .distinct();
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.dbService.db('poliklinik').where('kd_poli', kdPoli).first();
  }
}