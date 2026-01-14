import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class DokterService {
  private readonly logger = new Logger(DokterService.name);

  constructor(private readonly dbService: KhanzaDBService) { }

  async getDoctors() {
    return this.dbService.db('dokter')
      .select('kd_dokter', 'nm_dokter', 'kd_sps', 'no_telp')
      .where('status', '1');
  }

  async getDoctorSchedules() {
    return this.dbService.db('jadwal')
      .select('*');
  }

  async getDoctorSchedulesWithPoliInfo() {
    // Join jadwal with poliklinik to get poli names
    return this.dbService.db('jadwal')
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
  }

  async getDoctorSchedulesByDoctorAndPoli(doctorCode: string) {
    // Get doctor schedules with poli information
    return this.dbService.db('jadwal')
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
  }

  async getSpesialis() {
    return this.dbService.db('spesialis').select('kd_sps', 'nm_sps');
  }

  async findPoliByDoctor(doctorCode: string) {
    // Try to find poli from schedule (jadwal)
    const schedule = await this.dbService.db('jadwal').where('kd_dokter', doctorCode).first();
    return schedule?.kd_poli || '-';
  }
}