import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class DokterService {
  private readonly logger = new Logger(DokterService.name);

  constructor(private readonly dbService: KhanzaDBService) {}

  async getDoctors() {
    return this.dbService.db('dokter')
      .select('kd_dokter', 'nm_dokter', 'kd_sps', 'no_telp')
      .where('status', '1');
  }

  async getDoctorSchedules() {
    return this.dbService.db('jadwal')
      .select('*')
      .whereNot('jam_mulai', '00:00:00')
      .andWhereNot('jam_selesai', '00:00:00');
  }

  async getDoctorSchedulesWithPoliInfo() {
    // Join jadwal with poliklinik to get poli names
    // Filter out schedules with jam_mulai and jam_selesai as 00:00:00
    return this.dbService.db('jadwal')
      .select(
        'jadwal.kd_dokter',
        'jadwal.kd_poli',
        'jadwal.hari_kerja',
        'jadwal.jam_mulai',
        'jadwal.jam_selesai',
        'jadwal.kuota',
        'poliklinik.nm_poli'
      )
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .whereNot('jadwal.jam_mulai', '00:00:00')
      .andWhereNot('jadwal.jam_selesai', '00:00:00');
  }

  async getDoctorSchedulesByDoctorAndPoli(doctorCode: string) {
    // Get doctor schedules with poli information
    // Filter out schedules with jam_mulai and jam_selesai as 00:00:00
    return this.dbService.db('jadwal')
      .select(
        'jadwal.kd_dokter',
        'jadwal.kd_poli',
        'jadwal.hari_kerja',
        'jadwal.jam_mulai',
        'jadwal.jam_selesai',
        'jadwal.kuota',
        'poliklinik.nm_poli'
      )
      .leftJoin('poliklinik', 'jadwal.kd_poli', 'poliklinik.kd_poli')
      .where('jadwal.kd_dokter', doctorCode)
      .whereNot('jadwal.jam_mulai', '00:00:00')
      .andWhereNot('jadwal.jam_selesai', '00:00:00');
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