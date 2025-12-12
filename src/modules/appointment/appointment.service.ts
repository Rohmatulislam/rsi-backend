import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationService, NotificationPayload } from '../notification/notification.service';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly khanzaService: KhanzaService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  async create(createAppointmentDto: CreateAppointmentDto) {
    this.logger.log('Creating appointment', createAppointmentDto);

    // 0. Get Doctor to find kd_dokter
    const doctor = await this.prisma.doctor.findFirst({
      where: { id: createAppointmentDto.doctorId }
    });

    if (!doctor || !doctor.kd_dokter) {
      throw new BadRequestException('Dokter tidak ditemukan atau belum terhubung dengan SIMRS (kd_dokter missing)');
    }

    // 0.1 Validate booking date format and not in the past
    const bookingDate = new Date(createAppointmentDto.bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Tanggal booking tidak boleh di masa lalu');
    }

    const dateString = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD

    // 0.2 Check doctor availability (schedule, holiday, quota)
    const availability = await this.khanzaService.isDoctorAvailable(doctor.kd_dokter, dateString);
    if (!availability.available) {
      throw new BadRequestException(availability.reason || 'Dokter tidak tersedia pada tanggal ini');
    }

    // 1. Validasi Pasien (jika pasien lama, cek di Khanza/Local)
    let patient;
    let isNewPatient = false;

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
      // Pasien Baru 
      // Check by NIK first to avoid duplicate
      if (createAppointmentDto.nik) {
        patient = await this.khanzaService.findPatientByNIK(createAppointmentDto.nik);

        if (!patient) {
          // Create new patient in Khanza
          try {
            // Validate required fields for new patient
            if (!createAppointmentDto.birthDate) {
              throw new BadRequestException('Tanggal lahir wajib diisi untuk pasien baru');
            }
            if (!createAppointmentDto.gender) {
              throw new BadRequestException('Jenis kelamin wajib diisi untuk pasien baru');
            }

            const newPatientResult = await this.khanzaService.createPatient({
              name: createAppointmentDto.patientName,
              nik: createAppointmentDto.nik,
              birthDate: createAppointmentDto.birthDate,
              gender: createAppointmentDto.gender,
              address: createAppointmentDto.patientAddress || '-',
              phone: createAppointmentDto.patientPhone,
              email: createAppointmentDto.patientEmail,
            });

            // Fetch the newly created patient
            patient = await this.khanzaService.findPatientByNoRM(newPatientResult.no_rkm_medis);
            isNewPatient = true;

            this.logger.log(`New patient registered: ${newPatientResult.no_rkm_medis}`);
          } catch (error) {
            this.logger.error('Failed to create new patient', error);
            throw new BadRequestException('Gagal mendaftarkan pasien baru: ' + error.message);
          }
        } else {
          // Patient exists, use existing data
          this.logger.log(`Existing patient found by NIK: ${patient.no_rkm_medis}`);
        }
      } else {
        throw new BadRequestException('NIK wajib diisi untuk pasien baru');
      }
    }

    if (!patient) {
      throw new BadRequestException('Pasien tidak valid');
    }

    // Lookup Poli
    const poliCode = await this.khanzaService.findPoliByDoctor(doctor.kd_dokter);

    // 2. Insert ke Reg Periksa (Bridging Real)
    try {
      const bookingResult = await this.khanzaService.createBooking({
        doctorCode: doctor.kd_dokter,
        patient: patient,
        date: dateString,
        poliCode: poliCode,
        paymentType: createAppointmentDto.paymentType
      });

      // Use DTO data or Fallback to Patient Data from Khanza
      const finalPatientName = createAppointmentDto.patientName || patient.nm_pasien;
      const finalPatientPhone = createAppointmentDto.patientPhone || patient.no_tlp;
      const finalPatientEmail = createAppointmentDto.patientEmail || patient.email;
      const finalPatientAddress = createAppointmentDto.patientAddress || patient.alamat;

      // 3. Simpan Log di Local DB (Prisma)
      const appointment = await this.prisma.appointment.create({
        data: {
          patientId: patient.no_rkm_medis,
          doctorId: doctor.id,
          appointmentDate: bookingDate,
          status: 'scheduled',
          reason: createAppointmentDto.keluhan || 'Online Booking via Website',
          notes: `No Reg: ${bookingResult.no_reg}, No Rawat: ${bookingResult.no_rawat}`,
          patientName: finalPatientName,
          patientPhone: finalPatientPhone,
          patientEmail: finalPatientEmail,
          patientAddress: finalPatientAddress
        }
      });

      // 4. Send booking confirmation notification
      try {
        // Get doctor details for notification
        const doctorDetails = await this.prisma.doctor.findFirst({
          where: { id: createAppointmentDto.doctorId },
          select: { name: true }
        });

        // Get poli details for notification
        const poliDetails = await this.khanzaService.getPoliByKdPoli(poliCode);

        // Prepare notification payload
        const notificationPayload: NotificationPayload = {
          patientName: finalPatientName,
          patientPhone: finalPatientPhone,
          patientEmail: finalPatientEmail,
          bookingDate: bookingDate.toLocaleDateString('id-ID'),
          bookingTime: bookingDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          doctorName: doctorDetails?.name || 'Unknown Doctor',
          bookingCode: bookingResult.no_reg,
          poliName: poliDetails?.nm_poli || 'Poliklinik Umum',
        };

        // Send notification
        await this.notificationService.sendBookingConfirmation(notificationPayload, appointment.id);
      } catch (notificationError) {
        this.logger.error('Failed to send booking confirmation notification', notificationError);
        // Don't fail the booking if notification fails
      }

      return {
        success: true,
        bookingCode: bookingResult.no_reg,
        noRawat: bookingResult.no_rawat,
        noRM: patient.no_rkm_medis,
        isNewPatient,
        message: isNewPatient
          ? 'Pasien baru berhasil didaftarkan dan booking berhasil terkirim ke SIMRS'
          : 'Booking berhasil terkirim ke SIMRS'
      };
    } catch (error) {
      this.logger.error('Failed to create booking', error);
      throw new BadRequestException('Gagal membuat booking: ' + error.message);
    }
  }

  async cancel(appointmentId: string) {
    this.logger.log(`Cancelling appointment ${appointmentId}`);

    // Find the appointment
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: {
            name: true
          }
        }
      }
    });

    if (!appointment) {
      throw new BadRequestException('Appointment not found');
    }

    // Extract no_rawat from appointment notes (stored as "No Reg: X, No Rawat: Y")
    let noRawat = '';
    if (appointment.notes) {
      const rawatMatch = appointment.notes.match(/No Rawat: (\w+)/);
      if (rawatMatch) {
        noRawat = rawatMatch[1];
      }
    }

    // Cancel in SIMRS Khanza if we have no_rawat
    if (noRawat) {
      try {
        await this.khanzaService.cancelBooking(noRawat);
        this.logger.log(`Booking cancelled in SIMRS for no_rawat: ${noRawat}`);
      } catch (simrsError) {
        this.logger.error(`Failed to cancel booking in SIMRS for no_rawat: ${noRawat}`, simrsError);
        // Don't fail the local cancellation if SIMRS cancellation fails
      }
    }

    // Update appointment status to cancelled
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'cancelled' }
    });

    // Send cancellation notification
    try {
      // Get doctor details for notification
      const doctorDetails = await this.prisma.doctor.findFirst({
        where: { id: appointment.doctorId },
        select: { name: true }
      });

      // Prepare notification payload using stored patient data
      const notificationPayload: NotificationPayload = {
        patientName: appointment.patientName || 'Patient',
        patientPhone: appointment.patientPhone || 'Patient Phone',
        patientEmail: appointment.patientEmail || 'patient@example.com',
        bookingDate: appointment.appointmentDate.toLocaleDateString('id-ID'),
        bookingTime: appointment.appointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        doctorName: doctorDetails?.name || 'Unknown Doctor',
        bookingCode: appointment.notes || appointmentId, // Using notes as booking code since it contains no_reg
        poliName: 'Poliklinik Umum', // Placeholder
      };

      // Send notification
      await this.notificationService.sendBookingCancellation(notificationPayload, appointment.id);
    } catch (notificationError) {
      this.logger.error('Failed to send cancellation notification', notificationError);
      // Don't fail the cancellation if notification fails
    }

    return {
      success: true,
      message: 'Appointment cancelled successfully'
    };
  }

  async getPatientHistory(patientId: string) {
    this.logger.log(`Fetching appointment history for patient ${patientId}`);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        patientId: patientId
      },
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true,
            imageUrl: true
          }
        },
        notifications: {
          orderBy: {
            sentAt: 'desc'
          }
        }
      },
      orderBy: {
        appointmentDate: 'desc'
      }
    });

    return appointments.map(appointment => ({
      id: appointment.id,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      patientEmail: appointment.patientEmail,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes,
      doctor: appointment.doctor,
      notifications: appointment.notifications
    }));
  }

  async getAllAppointments() {
    this.logger.log('Fetching all appointments');

    const appointments = await this.prisma.appointment.findMany({
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true,
            imageUrl: true
          }
        },
        notifications: {
          orderBy: {
            sentAt: 'desc'
          }
        }
      },
      orderBy: {
        appointmentDate: 'desc'
      }
    });

    return appointments.map(appointment => ({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      patientEmail: appointment.patientEmail,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes,
      doctor: appointment.doctor,
      notifications: appointment.notifications
    }));
  }

  /**
   * Search patient by Medical Record Number from Khanza
   * Returns patient details if found
   */
  async searchPatientByRM(mrNumber: string) {
    this.logger.log(`🔍 [SEARCH] Searching patient by RM: ${mrNumber}`);

    try {
      // Search patient in Khanza database
      this.logger.log(`🔍 [SEARCH] Calling khanzaService.findPatientByNoRM(${mrNumber})`);
      const patient = await this.khanzaService.findPatientByNoRM(mrNumber);

      if (!patient) {
        this.logger.warn(`⚠️ [SEARCH] Patient not found for RM: ${mrNumber}`);
        return {
          found: false,
          message: 'Pasien tidak ditemukan'
        };
      }

      this.logger.log(`✅ [SEARCH] Patient found: ${patient.nm_pasien} (RM: ${patient.no_rkm_medis})`);
      this.logger.debug(`📋 [SEARCH] Patient details:`, {
        no_rkm_medis: patient.no_rkm_medis,
        nm_pasien: patient.nm_pasien,
        jk: patient.jk,
        tgl_lahir: patient.tgl_lahir,
      });

      // Return patient details
      return {
        found: true,
        patient: {
          no_rkm_medis: patient.no_rkm_medis,
          no_ktp: patient.no_ktp, // NIK
          nm_pasien: patient.nm_pasien,
          jk: patient.jk,
          tgl_lahir: patient.tgl_lahir,
          no_tlp: patient.no_tlp,
          alamat: patient.alamat,
          email: patient.email,
        }
      };
    } catch (error) {
      this.logger.error(`❌ [SEARCH] Error searching patient by RM: ${error.message}`);
      this.logger.error(`❌ [SEARCH] Error stack:`, error.stack);
      throw new BadRequestException('Gagal mencari data pasien');
    }
  }
}
