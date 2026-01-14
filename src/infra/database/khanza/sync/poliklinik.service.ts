import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class PoliklinikService {
  private readonly logger = new Logger(PoliklinikService.name);

  constructor(private readonly dbService: KhanzaDBService) { }

  async getPoliklinik() {
    return this.dbService.db('poliklinik').select('kd_poli', 'nm_poli', 'registrasi');
  }

  async getPoliklinikWithActiveSchedules() {
    // Get poliklinik that have active schedules
    // Note: We used to filter out 00:00:00, but Lab/Rad often use this as 24h or default marker
    return this.dbService.db('jadwal')
      .select('poliklinik.kd_poli', 'poliklinik.nm_poli')
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .distinct();
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.dbService.db('poliklinik').where('kd_poli', kdPoli).first();
  }
}