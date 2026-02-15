import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';
import { isExecutive } from '../../../utils/naming.utils';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class PoliklinikService {
  private readonly logger = new Logger(PoliklinikService.name);

  constructor(
    private readonly dbService: KhanzaDBService,
    private readonly cache: CacheService
  ) { }

  async getPoliklinik() {
    return this.dbService.db('poliklinik').select('kd_poli', 'nm_poli', 'registrasi');
  }

  async getPoliklinikWithActiveSchedules() {
    const cacheKey = 'poliklinikWithActiveSchedules';

    // Cek apakah data ada di cache dan masih valid
    const cachedData = this.cache.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // Jika tidak ada di cache atau sudah expired, ambil dari database
    this.logger.debug('Mengambil data poliklinik dari database SIMRS');

    const result = await this.dbService.db('jadwal')
      .select('poliklinik.kd_poli', 'poliklinik.nm_poli')
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .whereNotNull('poliklinik.nm_poli') // Pastikan poli memiliki nama
      .distinct();

    // Simpan hasil ke cache (default 5 menit)
    this.cache.set(cacheKey, result);

    return result;
  }

  async getPoliklinikExecutiveWithActiveSchedules() {
    const result = await this.getPoliklinikWithActiveSchedules();
    // Filter those containing 'Eksekutif', 'Ekskutif', or 'Executive' via utility
    return result.filter((poli: any) => isExecutive(poli.nm_poli));
  }

  async getPoliklinikRegularWithActiveSchedules() {
    const result = await this.getPoliklinikWithActiveSchedules();
    // Filter those NOT indicating executive service
    return result.filter((poli: any) => !isExecutive(poli.nm_poli));
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.dbService.db('poliklinik').where('kd_poli', kdPoli).first();
  }
}