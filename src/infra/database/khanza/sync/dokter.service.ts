import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class DokterService {
  private readonly logger = new Logger(DokterService.name);

  constructor(
    private readonly dbService: KhanzaDBService,
    private readonly cache: CacheService
  ) { }

  async getDoctors() {
    const cacheKey = 'khanza_doctors';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.dbService.db('dokter')
      .select('kd_dokter', 'nm_dokter', 'kd_sps', 'no_telp')
      .where('status', '1');

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDoctorSchedules() {
    const cacheKey = 'khanza_schedules';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.dbService.db('jadwal')
      .select('*');

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDoctorSchedulesWithPoliInfo() {
    const cacheKey = 'khanza_schedules_poli';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Join jadwal with poliklinik to get poli names
    const result = await this.dbService.db('jadwal')
      .select(
        'jadwal.kd_dokter',
        'jadwal.kd_poli',
        'jadwal.hari_kerja',
        'jadwal.jam_mulai',
        'jadwal.jam_selesai',
        'jadwal.kuota',
        'poliklinik.nm_poli',
        'poliklinik.registrasi'
      )
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli');

    this.cache.set(cacheKey, result);
    return result;
  }

  async getDoctorSchedulesByDoctorAndPoli(doctorCode: string) {
    const cacheKey = `khanza_schedules_${doctorCode}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    // Get doctor schedules with poli information
    const result = await this.dbService.db('jadwal')
      .select(
        'jadwal.kd_dokter',
        'jadwal.kd_poli',
        'jadwal.hari_kerja',
        'jadwal.jam_mulai',
        'jadwal.jam_selesai',
        'jadwal.kuota',
        'poliklinik.nm_poli',
        'poliklinik.registrasi'
      )
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .where('jadwal.kd_dokter', doctorCode);

    this.cache.set(cacheKey, result);
    return result;
  }

  async getSpesialis() {
    const cacheKey = 'khanza_spesialis';
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.dbService.db('spesialis').select('kd_sps', 'nm_sps');

    this.cache.set(cacheKey, result);
    return result;
  }

  async findPoliByDoctor(doctorCode: string) {
    // Try to find poli from schedule (jadwal)
    const schedule = await this.dbService.db('jadwal').where('kd_dokter', doctorCode).first();
    return schedule?.kd_poli || '-';
  }
}