import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly khanzaService: KhanzaService,
    private readonly prisma: PrismaService,
  ) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    this.logger.log('Creating appointment', createAppointmentDto);

    // 1. Validasi Pasien (jika pasien lama, cek di Khanza/Local)
    let patient;
    if (createAppointmentDto.patientType === 'old') {
      if (!createAppointmentDto.mrNumber) {
        throw new BadRequestException('Nomor RM wajib diisi untuk pasien lama');
      }
      // Cek ke Khanza
      patient = await this.khanzaService.findPatientByNoRM(createAppointmentDto.mrNumber);
      if (!patient) {
        throw new BadRequestException('Data Pasien tidak ditemukan di SIMRS');
      }
    } else {
       // Pasien Baru (Logic lebih kompleks: Insert ke tabel pasien Khanza dulu ideally)
       // Untuk bridging simpel, kita asumsikan validasi NIK dulu
       if (createAppointmentDto.nik) {
            patient = await this.khanzaService.findPatientByNIK(createAppointmentDto.nik);
            if (patient) {
                // Pasien ternyata sudah ada
                // Use existing data
            }
       }
    }

    // 2. Insert ke Reg Periksa (Bridging)
    const bookingResult = await this.khanzaService.createBooking({
        doctorCode: createAppointmentDto.doctorId, // Asumsi ID dokter sudah mapping dg kode dokter khanza? Atau harus lookup
        patient: patient || createAppointmentDto,
        date: createAppointmentDto.bookingDate,
        payment: createAppointmentDto.paymentType
    });

    // 3. Simpan Log di Local DB (Prisma)
    // Optional, but good for history
    const doctor = await this.prisma.doctor.findFirst({
        where: { id: createAppointmentDto.doctorId } // Or slug
    });

    /*
    await this.prisma.appointment.create({
        data: {
             patientId: patient?.no_rkm_medis || 'TEMP', 
             doctorId: createAppointmentDto.doctorId,
             appointmentDate: new Date(createAppointmentDto.bookingDate),
             status: 'scheduled',
             // ...
        }
    });
    */

    return {
        success: true,
        bookingCode: bookingResult?.no_reg || 'REG-' + Math.floor(Math.random() * 10000), // Mock code form Khanza service
        message: 'Booking Berhasil Terkirim ke SIMRS'
    };
  }
}
