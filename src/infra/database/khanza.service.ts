import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import knex, { Knex } from 'knex';

@Injectable()
export class KhanzaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KhanzaService.name);
  public db: Knex;

  constructor(private configService: ConfigService) {
    this.db = knex({
      client: 'mysql2',
      connection: {
        host: this.configService.get<string>('KHANZA_DB_HOST', 'localhost'),
        port: this.configService.get<number>('KHANZA_DB_PORT', 3306),
        user: this.configService.get<string>('KHANZA_DB_USER', 'root'),
        password: this.configService.get<string>('KHANZA_DB_PASSWORD', ''),
        database: this.configService.get<string>('KHANZA_DB_NAME', 'sik'),
      },
      pool: { min: 0, max: 7 }, // Adjust pool size as needed
    });
  }

  async onModuleInit() {
    try {
      await this.db.raw('SELECT 1');
      this.logger.log('Successfully connected to Khanza SIMRS Database');
    } catch (error) {
      this.logger.error('Failed to connect to Khanza SIMRS Database', error);
      // Don't throw error to prevent app crash if Khanza is offline
    }
  }

  async onModuleDestroy() {
    await this.db.destroy();
  }

  // --- Bridging Methods ---

  async findPatientByNoRM(noRM: string) {
    return this.db('pasien').where('no_rkm_medis', noRM).first();
  }

  async findPatientByNIK(nik: string) {
    return this.db('pasien').where('no_ktp', nik).first();
  }

  async createBooking(data: any) {
    // Implementasi logika insert ke reg_periksa
    // Ini butuh detail struktur tabel reg_periksa yang spesifik
    // Untuk tahap ini, kita hanya return simulasi atau row data
    
    // Contoh query insert simpel (harus disesuaikan dengan kolom wajib di Khanza)
    /*
    return this.db('reg_periksa').insert({
        no_reg: data.no_reg,
        no_rawat: data.no_rawat,
        tgl_registrasi: data.date,
        // ...
    });
    */
    this.logger.log('Mock Booking Created', data);
    return {
        message: 'Booking Data Sent',
        no_reg: 'REG-' + Math.floor(Math.random() * 9999) + '-REAL'
    };
  }
}
