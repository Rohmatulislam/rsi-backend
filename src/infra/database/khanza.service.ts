import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { BookingService } from './khanza/booking/booking.service';
import { PatientService } from './khanza/patient/patient.service';
import { PoliklinikService } from './khanza/sync/poliklinik.service';
import { DokterService } from './khanza/sync/dokter.service';
import { ValidationService } from './khanza/validation/validation.service';
import { MonitoringService } from './khanza/monitoring/monitoring.service';
import { KhanzaDBService } from './khanza/khanza-db.service';

@Injectable()
export class KhanzaService implements OnModuleInit {
  private readonly logger = new Logger(KhanzaService.name);

  // Gunakan koneksi dari KhanzaDBService, bukan buat sendiri
  public get db(): Knex {
    return this.dbService.db;
  }

  // Inject all specialized services + KhanzaDBService
  constructor(
    private configService: ConfigService,
    private readonly dbService: KhanzaDBService, // Inject KhanzaDBService
    public readonly bookingService: BookingService,
    public readonly patientService: PatientService,
    public readonly poliklinikService: PoliklinikService,
    public readonly dokterService: DokterService,
    public readonly validationService: ValidationService,
    public readonly monitoringService: MonitoringService,
  ) { }

  async onModuleInit() {
    try {
      const isConnected = await this.dbService.testConnection();
      if (isConnected) {
        this.logger.log('✅ Successfully connected to Khanza SIMRS Database (via KhanzaDBService)');
      } else {
        this.logger.error('❌ Failed to connect to Khanza SIMRS Database');
      }
    } catch (error) {
      this.logger.error('❌ Failed to connect to Khanza SIMRS Database', error);
    }
  }

  // --- Convenience Methods (Delegating to specialized services) ---

  // Booking methods
  async createBooking(data: {
    doctorCode: string;
    patient: any;
    date: string; // YYYY-MM-DD
    poliCode: string;
    paymentType: string; // 'umum' | 'bpjs'
  }) {
    return this.bookingService.createBooking(data);
  }

  async cancelBooking(noRawat: string) {
    return this.bookingService.cancelBooking(noRawat);
  }

  async updateBookingDate(noRawat: string, newDate: string) {
    return this.bookingService.updateBookingDate(noRawat, newDate);
  }

  async getBookingByNoRawat(noRawat: string) {
    return this.bookingService.getBookingByNoRawat(noRawat);
  }

  async getBookingsByDate(date: string) {
    return this.bookingService.getBookingsByDate(date);
  }

  async getBookingsByPatient(noRm: string) {
    return this.bookingService.getBookingsByPatient(noRm);
  }

  async getBookingsByDoctor(doctorCode: string) {
    return this.bookingService.getBookingsByDoctor(doctorCode);
  }

  async getNextNoRawat(date: string): Promise<string> {
    return this.bookingService.getNextNoRawat(date);
  }

  async getNextNoReg(doctorId: string, date: string): Promise<string> {
    return this.bookingService.getNextNoReg(doctorId, date);
  }

  // Patient methods
  async findPatientByNoRM(noRM: string) {
    return this.patientService.findPatientByNoRM(noRM);
  }

  async findPatientByNIK(nik: string) {
    return this.patientService.findPatientByNIK(nik);
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
  }) {
    return this.patientService.createPatient(data);
  }

  async getNextNoRM(): Promise<string> {
    return this.patientService.getNextNoRM();
  }

  async getPaymentMethods() {
    return this.patientService.getPaymentMethods();
  }

  async getKabupatens() {
    return this.patientService.getKabupatens();
  }

  async getKecamatans() {
    return this.patientService.getKecamatans();
  }

  async getKelurahans() {
    return this.patientService.getKelurahans();
  }

  async getPropinsis() {
    return this.patientService.getPropinsis();
  }

  async getSukuBangsas() {
    return this.patientService.getSukuBangsas();
  }

  async getBahasaPasiens() {
    return this.patientService.getBahasaPasiens();
  }

  async getCacatFisiks() {
    return this.patientService.getCacatFisiks();
  }

  // Poliklinik methods
  async getPoliklinik() {
    return this.poliklinikService.getPoliklinik();
  }

  async getPoliklinikWithActiveSchedules() {
    return this.poliklinikService.getPoliklinikWithActiveSchedules();
  }

  async getPoliByKdPoli(kdPoli: string) {
    return this.poliklinikService.getPoliByKdPoli(kdPoli);
  }

  // Dokter methods
  async getDoctors() {
    return this.dokterService.getDoctors();
  }

  async getDoctorSchedules() {
    return this.dokterService.getDoctorSchedules();
  }

  async getDoctorSchedulesWithPoliInfo() {
    return this.dokterService.getDoctorSchedulesWithPoliInfo();
  }

  async getDoctorSchedulesByDoctorAndPoli(doctorCode: string) {
    return this.dokterService.getDoctorSchedulesByDoctorAndPoli(doctorCode);
  }

  async getSpesialis() {
    return this.dokterService.getSpesialis();
  }

  async findPoliByDoctor(doctorCode: string) {
    return this.dokterService.findPoliByDoctor(doctorCode);
  }

  // Validation methods
  async checkDoctorQuota(doctorCode: string, date: string): Promise<{
    available: boolean;
    current: number;
    max: number;
    message: string;
  }> {
    return this.validationService.checkDoctorQuota(doctorCode, date);
  }

  async isHoliday(date: string): Promise<boolean> {
    return this.validationService.isHoliday(date);
  }

  async isDoctorAvailable(doctorCode: string, date: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    return this.validationService.isDoctorAvailable(doctorCode, date);
  }

  // Monitoring methods
  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency?: number;
    error?: string;
  }> {
    return this.monitoringService.getConnectionStatus();
  }
}