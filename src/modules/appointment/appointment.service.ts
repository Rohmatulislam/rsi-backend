import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { NotificationService, NotificationPayload } from '../notification/notification.service';
import { getStartOfTodayWita } from '../../infra/utils/date.utils';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

@Injectable()
export class AppointmentService {
  private readonly logger = new Logger(AppointmentService.name);

  constructor(
    private readonly khanzaService: KhanzaService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) { }

  // Mapping kategori ke kode poli Khanza
  private async mapCategoryToKhanzaPoli(categoryName: string, doctorCode: string): Promise<string> {
    // Ambil data poli dari sistem SIMRS Khanza berdasarkan dokter
    // Di sini kita buat mapping berdasarkan nama kategori ke kode poli
    // Ini adalah bagian penting untuk memastikan pilihan poliklinik yang benar dikirim ke SIMRS

    // Ambil semua poliklinik yang tersedia untuk dokter ini dari sistem Khanza
    const availablePolis = await this.khanzaService.getPoliklinik();

    // Cari mapping berdasarkan nama kategori yang diketahui
    if (categoryName.includes('Eksekutif') || categoryName.includes('eksekutif')) {
      // Jika nama kategori mengandung kata 'Eksekutif', cari poliklinik eksekutif yang cocok
      const execPoli = availablePolis.find((poli: any) =>
        (poli.nm_poli.toLowerCase().includes('eksekutif') || poli.nm_poli.toLowerCase().includes('executive')) &&
        (poli.nm_poli.toLowerCase().includes(doctorCode.toLowerCase()) ||
          this.categoryMatchesDoctorSpecialty(categoryName, poli.nm_poli))
      );

      if (execPoli) {
        return execPoli.kd_poli;
      }
    } else if (categoryName.includes('Umum') || categoryName.includes('PKS') || categoryName.includes('Pks')) {
      // Jika nama kategori mengandung kata 'Umum' atau 'PKS', cari poliklinik umum yang cocok
      const generalPoli = availablePolis.find((poli: any) =>
        (poli.nm_poli.toLowerCase().includes('umum') ||
          poli.nm_poli.toLowerCase().includes('pks')) &&
        (poli.nm_poli.toLowerCase().includes(doctorCode.toLowerCase()) ||
          this.categoryMatchesDoctorSpecialty(categoryName, poli.nm_poli))
      );

      if (generalPoli) {
        return generalPoli.kd_poli;
      }
    } else {
      // Jika nama kategori bukan eksekutif atau umum/PKS, cari yang cocok secara umum
      const matchingPoli = availablePolis.find((poli: any) =>
        poli.nm_poli.toLowerCase().includes(categoryName.toLowerCase().replace('poli ', ''))
      );

      if (matchingPoli) {
        return matchingPoli.kd_poli;
      }
    }

    // Jika tidak ditemukan mapping, kembalikan poli default dokter
    return await this.khanzaService.findPoliByDoctor(doctorCode);
  }

  private categoryMatchesDoctorSpecialty(categoryName: string, poliName: string): boolean {
    // Mapping umum antara nama kategori dokter dan nama poliklinik
    const mappings: { [key: string]: string[] } = {
      'penyakit dalam': ['penyakit dalam', 'internal', 'dalam'],
      'kandungan': ['kandungan', 'obgyn', 'obstetri', 'ginekologi'],
      'anak': ['anak', 'pediatri', 'paediatri'],
      'jantung': ['jantung', 'cardio', 'kardiologi'],
      'paru': ['paru', 'pulmo', 'paru-paru', 'respirasi'],
      'saraf': ['saraf', 'neuro', 'neurologi'],
      'bedah': ['bedah', 'surgery', 'bedah umum'],
      'mata': ['mata', 'mata', 'ophthalmologi'],
      'kulit': ['kulit', 'kulit dan kelamin', 'dermatologi', 'kulit & kelamin'],
      'telinga': ['telinga', 'telinga hidung tenggorok', 'tHT', 'ent'],
    };

    const categoryLower = categoryName.toLowerCase();
    const poliLower = poliName.toLowerCase();

    for (const [specialty, keywords] of Object.entries(mappings)) {
      if (categoryLower.includes(specialty) &&
        keywords.some(keyword => poliLower.includes(keyword))) {
        return true;
      }
    }

    return false;
  }

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
    // Use WITA today
    const today = getStartOfTodayWita();

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
              bpjsNumber: createAppointmentDto.bpjsNumber, // No. BPJS untuk saved ke no_peserta
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
    let poliCode = '';

    // poliId dari frontend sudah berisi kd_poli dari SIMRS Khanza (misalnya "U0021")
    // Kita gunakan langsung, karena frontend sudah mengambil dari API getActivePoli
    if (createAppointmentDto.poliId) {
      // Validasi bahwa kode poli valid dengan mengecek ke Khanza
      const poliDetails = await this.khanzaService.getPoliByKdPoli(createAppointmentDto.poliId);

      if (poliDetails) {
        poliCode = createAppointmentDto.poliId;
        this.logger.log(`✅ Poli from frontend validated: ${poliCode} - ${poliDetails.nm_poli}`);
      } else {
        this.logger.warn(`⚠️ Poli code ${createAppointmentDto.poliId} not found in Khanza, using doctor's default poli`);
      }
    }

    // Fallback: gunakan poli default dokter jika tidak ada pilihan spesifik atau tidak valid
    if (!poliCode) {
      poliCode = await this.khanzaService.findPoliByDoctor(doctor.kd_dokter);
      this.logger.log(`📋 Using doctor's default poli: ${poliCode}`);
    }

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
      let appointmentDateTime = bookingDate;

      // If bookingTime is provided, combine it with bookingDate
      if (createAppointmentDto.bookingTime) {
        const [hours, minutes] = createAppointmentDto.bookingTime.split(':').map(Number);
        appointmentDateTime = new Date(bookingDate);
        appointmentDateTime.setHours(hours, minutes, 0, 0);
      }

      const reason = createAppointmentDto.serviceItemName
        ? `${createAppointmentDto.serviceItemName}${createAppointmentDto.keluhan ? ' | ' + createAppointmentDto.keluhan : ''}`
        : (createAppointmentDto.keluhan || 'Online Booking via Website');

      // Fetch payer name for local storage
      let payerName = createAppointmentDto.paymentType;
      try {
        const penjab = await this.khanzaService.db('penjab')
          .where('kd_pj', createAppointmentDto.paymentType)
          .first();
        if (penjab) {
          payerName = penjab.png_jawab;
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch payer name for ${createAppointmentDto.paymentType}`);
      }

      const appointment = await this.prisma.appointment.create({
        data: {
          patientId: patient.no_rkm_medis,
          doctorId: doctor.id,
          appointmentDate: appointmentDateTime,
          status: 'scheduled',
          reason: reason,
          noRawat: bookingResult.no_rawat,
          noReg: bookingResult.no_reg,
          poliCode: poliCode,
          payerName: payerName,
          payerCode: createAppointmentDto.paymentType,
          notes: `No Reg: ${bookingResult.no_reg}, No Rawat: ${bookingResult.no_rawat}`,
          patientName: finalPatientName,
          patientPhone: finalPatientPhone,
          patientEmail: finalPatientEmail,
          patientAddress: finalPatientAddress,
          createdByUserId: createAppointmentDto.createdByUserId || null
        } as any
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
          bookingDate: appointmentDateTime.toLocaleDateString('id-ID'),
          bookingTime: appointmentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
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

    try {
      // Find the appointment
      const appointment = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: {
          doctor: {
            select: {
              name: true,
              specialization: true
            }
          }
        }
      });

      if (!appointment) {
        this.logger.error(`Appointment not found: ${appointmentId}`);
        throw new BadRequestException('Appointment not found');
      }

      this.logger.log(`Found appointment: ${appointment.id}, status: ${appointment.status}`);

      // Check if already cancelled
      if (appointment.status === 'cancelled' || appointment.status === 'CANCELLED') {
        this.logger.warn(`Appointment ${appointmentId} already cancelled`);
        throw new BadRequestException('Appointment sudah dibatalkan sebelumnya');
      }

      // Extract no_rawat from appointment notes (stored as "No Reg: X, No Rawat: Y")
      let noRawat = '';
      if (appointment.notes) {
        const rawatMatch = appointment.notes.match(/No Rawat: ([^\s,]+)/);
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

      this.logger.log(`Appointment ${appointmentId} cancelled successfully`);

      // Send cancellation notification (optional, don't fail if this fails)
      try {
        const doctorDetails = await this.prisma.doctor.findFirst({
          where: { id: appointment.doctorId },
          select: { name: true }
        });

        const notificationPayload: NotificationPayload = {
          patientName: appointment.patientName || 'Patient',
          patientPhone: appointment.patientPhone || '',
          patientEmail: appointment.patientEmail || '',
          bookingDate: appointment.appointmentDate.toLocaleDateString('id-ID'),
          bookingTime: appointment.appointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          doctorName: doctorDetails?.name || 'Unknown Doctor',
          bookingCode: appointment.notes || appointmentId,
          poliName: 'Poliklinik Umum',
        };

        await this.notificationService.sendBookingCancellation(notificationPayload, appointment.id);
      } catch (notificationError) {
        this.logger.error('Failed to send cancellation notification', notificationError);
      }

      return {
        success: true,
        message: 'Appointment cancelled successfully'
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Unexpected error cancelling appointment ${appointmentId}:`, error);
      throw new BadRequestException(`Gagal membatalkan appointment: ${error.message}`);
    }
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
            imageUrl: true,
            isActive: true,
            isStudying: true,
            isOnLeave: true
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
            imageUrl: true,
            isActive: true,
            isStudying: true,
            isOnLeave: true
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

    return appointments.map((appointment: any) => ({
      id: appointment.id,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientPhone: appointment.patientPhone,
      patientEmail: appointment.patientEmail,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes,
      noRawat: appointment.noRawat,
      noReg: appointment.noReg,
      poliCode: appointment.poliCode,
      payerName: appointment.payerName,
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
          no_peserta: patient.no_peserta || '', // No. BPJS
        }
      };
    } catch (error) {
      this.logger.error(`❌ [SEARCH] Error searching patient by RM: ${error.message}`);
      this.logger.error(`❌ [SEARCH] Error stack:`, error.stack);
      throw new BadRequestException('Gagal mencari data pasien');
    }
  }

  /**
   * Search patient by NIK (No. KTP) from Khanza
   * Returns patient details if found
   */
  async searchPatientByNIK(nik: string) {
    this.logger.log(`🔍 [SEARCH] Searching patient by NIK: ${nik}`);

    try {
      // Search patient in Khanza database
      this.logger.log(`🔍 [SEARCH] Calling khanzaService.findPatientByNIK(${nik})`);
      const patient = await this.khanzaService.findPatientByNIK(nik);

      if (!patient) {
        this.logger.warn(`⚠️ [SEARCH] Patient not found for NIK: ${nik}`);
        return {
          found: false,
          message: 'Pasien tidak ditemukan'
        };
      }

      this.logger.log(`✅ [SEARCH] Patient found: ${patient.nm_pasien} (NIK: ${patient.no_ktp})`);

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
          no_peserta: patient.no_peserta || '', // No. BPJS
        }
      };
    } catch (error) {
      this.logger.error(`❌ [SEARCH] Error searching patient by NIK: ${error.message}`);
      throw new BadRequestException('Gagal mencari data pasien melalui NIK');
    }
  }

  /**
   * Get all appointments created by a specific user
   * Returns list of patients registered by this user
   */
  async getByUserId(userId: string) {
    this.logger.log(`Fetching appointments created by user ${userId}`);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        createdByUserId: userId
      },
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true,
            imageUrl: true,
            isActive: true,
            isStudying: true,
            isOnLeave: true
          }
        }
      },
      orderBy: {
        appointmentDate: 'desc'
      }
    });

    // Group by patientId to get unique patients
    const patientsMap = new Map<string, {
      patientId: string;
      patientName: string;
      patientPhone: string;
      patientEmail: string;
      appointmentsCount: number;
      lastAppointment: Date;
      appointments: any[];
    }>();

    appointments.forEach(appointment => {
      const existing = patientsMap.get(appointment.patientId);
      if (existing) {
        existing.appointmentsCount++;
        existing.appointments.push({
          id: appointment.id,
          appointmentDate: appointment.appointmentDate,
          status: appointment.status,
          reason: appointment.reason,
          doctor: appointment.doctor,
          notes: appointment.notes
        });
        if (appointment.appointmentDate > existing.lastAppointment) {
          existing.lastAppointment = appointment.appointmentDate;
        }
      } else {
        patientsMap.set(appointment.patientId, {
          patientId: appointment.patientId,
          patientName: appointment.patientName || 'Unknown',
          patientPhone: appointment.patientPhone || '',
          patientEmail: appointment.patientEmail || '',
          appointmentsCount: 1,
          lastAppointment: appointment.appointmentDate,
          appointments: [{
            id: appointment.id,
            appointmentDate: appointment.appointmentDate,
            status: appointment.status,
            reason: appointment.reason,
            doctor: appointment.doctor,
            notes: appointment.notes
          }]
        });
      }
    });

    return {
      totalPatients: patientsMap.size,
      totalAppointments: appointments.length,
      patients: Array.from(patientsMap.values())
    };
  }

  /**
   * Reschedule an existing appointment to a new date/time
   */
  async reschedule(appointmentId: string, rescheduleDto: RescheduleAppointmentDto) {
    this.logger.log(`Rescheduling appointment ${appointmentId}`);

    // Find the appointment
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            kd_dokter: true
          }
        }
      }
    });

    if (!appointment) {
      throw new BadRequestException('Appointment not found');
    }

    // Check if appointment is still active
    if (appointment.status === 'cancelled' || appointment.status === 'completed') {
      throw new BadRequestException('Cannot reschedule a cancelled or completed appointment');
    }

    // Validate new date is not in the past
    const newDate = new Date(rescheduleDto.newDate);
    const today = getStartOfTodayWita();

    if (newDate < today) {
      throw new BadRequestException('Tanggal baru tidak boleh di masa lalu');
    }

    const dateString = newDate.toISOString().split('T')[0];

    // Check doctor availability for new date (optional - don't block reschedule if check fails)
    if (appointment.doctor.kd_dokter) {
      try {
        const availability = await this.khanzaService.isDoctorAvailable(appointment.doctor.kd_dokter, dateString);
        if (!availability.available) {
          this.logger.warn(`Doctor ${appointment.doctor.kd_dokter} may not be available on ${dateString}: ${availability.reason}`);
          // Don't block - just warn. User may know better about schedule.
        }
      } catch (availabilityError) {
        this.logger.warn(`Could not check doctor availability: ${availabilityError.message}`);
        // Continue with reschedule
      }
    }

    // Create new appointment date time
    let newAppointmentDate = newDate;
    if (rescheduleDto.newTime) {
      const [hours, minutes] = rescheduleDto.newTime.split(':').map(Number);
      newAppointmentDate = new Date(newDate);
      newAppointmentDate.setHours(hours, minutes, 0, 0);
    }

    // Extract no_rawat from appointment notes and update in Khanza
    let noRawat = '';
    if (appointment.notes) {
      // Format: "No Reg: 001, No Rawat: 2024/12/15/000001"
      const rawatMatch = appointment.notes.match(/No Rawat:\s*([^\s,|]+)/);
      if (rawatMatch) {
        noRawat = rawatMatch[1].trim();
      }
    }

    // Sync reschedule to SIMRS Khanza
    if (noRawat) {
      try {
        await this.khanzaService.updateBookingDate(noRawat, dateString);
        this.logger.log(`Booking rescheduled in Khanza for no_rawat: ${noRawat}`);
      } catch (khanzaError) {
        this.logger.error(`Failed to reschedule in Khanza for no_rawat: ${noRawat}`, khanzaError);
        // Don't fail local reschedule if Khanza sync fails
      }
    } else {
      this.logger.warn(`No no_rawat found in appointment notes, cannot sync to Khanza`);
    }

    // Update the appointment in local database
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        appointmentDate: newAppointmentDate,
        notes: appointment.notes ? `${appointment.notes} | Rescheduled from ${appointment.appointmentDate.toLocaleDateString('id-ID')}` : undefined
      },
      include: {
        doctor: {
          select: {
            name: true,
            specialization: true
          }
        }
      }
    });

    // Send reschedule notification
    try {
      const notificationPayload: any = {
        patientName: appointment.patientName || 'Patient',
        patientPhone: appointment.patientPhone || '',
        doctorName: updatedAppointment.doctor?.name || 'Unknown Doctor',
        oldDate: format(new Date(appointment.appointmentDate), "dd MMMM yyyy", { locale: id }),
        newDate: format(new Date(newAppointmentDate), "dd MMMM yyyy", { locale: id }),
        newTime: newAppointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        poliName: updatedAppointment.doctor?.specialization || 'Poliklinik',
      };

      // Send notification about reschedule
      await this.notificationService.sendBookingReschedule(notificationPayload, appointment.id);
    } catch (notificationError) {
      this.logger.error('Failed to send reschedule notification', notificationError);
    }

    return {
      success: true,
      message: 'Jadwal berhasil diubah',
      newDate: newAppointmentDate.toLocaleDateString('id-ID'),
      newTime: newAppointmentDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };
  }

  /**
   * Get real-time queue status from SIMRS Khanza
   */
  async getQueueStatus(doctorCode: string, poliCode: string, date: string) {
    this.logger.log(`Fetching queue status for Doc: ${doctorCode}, Poli: ${poliCode}, Date: ${date}`);

    try {
      // Optimized single query to get total, current, and waiting counts
      const stats = await this.khanzaService.db('reg_periksa')
        .where({
          kd_dokter: doctorCode,
          kd_poli: poliCode,
          tgl_registrasi: date
        })
        .whereNot('stts', 'Batal')
        .select([
          this.khanzaService.db.raw('COUNT(*) as totalQueue'),
          this.khanzaService.db.raw('MAX(CASE WHEN stts != "Belum" THEN no_reg ELSE 0 END) as current'),
          this.khanzaService.db.raw('SUM(CASE WHEN stts = "Belum" THEN 1 ELSE 0 END) as totalWaiting')
        ])
        .first() as any;

      const totalQueue = parseInt(String(stats?.totalQueue || '0'));
      const currentNumber = stats?.current ? parseInt(String(stats.current)) : 0;
      const totalWaiting = parseInt(String(stats?.totalWaiting || '0'));

      return {
        doctorCode,
        poliCode,
        date,
        currentNumber,
        totalQueue,
        totalWaiting,
        status: currentNumber >= totalQueue && totalQueue > 0 ? 'Selesai' : 'Aktif',
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Failed to get queue status: ${error.message}`);
      return {
        doctorCode,
        poliCode,
        date,
        currentNumber: 0,
        totalQueue: 0,
        totalWaiting: 0,
        status: 'Error',
        message: 'Gagal mengambil data antrean'
      };
    }
  }

}
