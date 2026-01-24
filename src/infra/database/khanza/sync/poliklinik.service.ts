import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class PoliklinikService {
  private readonly logger = new Logger(PoliklinikService.name);

  // Cache untuk menyimpan hasil query, valid selama 5 menit
  private readonly cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 menit dalam milidetik

  constructor(private readonly dbService: KhanzaDBService) { }

  async getPoliklinik() {
    return this.dbService.db('poliklinik').select('kd_poli', 'nm_poli', 'registrasi');
  }

  async getPoliklinikWithActiveSchedules() {
    const cacheKey = 'poliklinikWithActiveSchedules';
    const now = Date.now();

    // Cek apakah data ada di cache dan masih valid
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      this.logger.debug('Mengambil data poliklinik dari cache');
      return cached.data;
    }

    // Jika tidak ada di cache atau sudah expired, ambil dari database
    this.logger.debug('Mengambil data poliklinik dari database SIMRS');

    // Optimalkan query untuk mengambil jadwal berdasarkan hari hari ini (SENIN, SELASA, dll)
    const days = ['AKHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const currentDay = days[new Date().getDay()];

    this.logger.debug(`Mencari poliklinik aktif untuk hari: ${currentDay}`);

    const result = await this.dbService.db('jadwal')
      .select('poliklinik.kd_poli', 'poliklinik.nm_poli')
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .where('jadwal.hari_kerja', currentDay)
      .distinct();

    // Simpan hasil ke cache
    this.cache.set(cacheKey, { data: result, timestamp: now });

    return result;
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.dbService.db('poliklinik').where('kd_poli', kdPoli).first();
  }
}