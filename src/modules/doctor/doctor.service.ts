import { Injectable } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { DoctorSortBy, GetDoctorsDto } from './dto/get-doctors.dto';

import { KhanzaService } from 'src/infra/database/khanza.service';
import { FileUploadService } from './services/file-upload.service';

@Injectable()
export class DoctorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly khanzaService: KhanzaService,
    private readonly fileUploadService: FileUploadService,
  ) { }

  async create(createDoctorDto: CreateDoctorDto) {
    return await this.prisma.doctor.create({
      data: createDoctorDto,
    });
  }

  async updateDoctorImage(doctorId: string, imageUrl: string) {
    // Jika imageUrl adalah data URI (base64), kita harus menyimpannya sebagai file
    let processedImageUrl = imageUrl;

    if (imageUrl.startsWith('data:image')) {
      // Ini adalah base64 image, kita harus menyimpannya sebagai file
      const doctor = await this.prisma.doctor.findUnique({
        where: { id: doctorId }
      });

      // Generate filename
      const fileExtension = imageUrl.split(';')[0].split('/')[1]; // Ambil ekstensi dari data URI
      const fileName = `doctor-${doctorId}.${fileExtension}`;

      // Simpan gambar dan dapatkan path-nya
      processedImageUrl = await this.fileUploadService.saveDoctorImage(
        imageUrl,
        fileName,
        doctor?.imageUrl // Gambar lama untuk dihapus
      );
    }

    const updatedDoctor = await this.prisma.doctor.update({
      where: { id: doctorId },
      data: { imageUrl: processedImageUrl },
    });

    return updatedDoctor;
  }

  async getPoliklinikWithActiveSchedules() {
    return await this.khanzaService.getPoliklinikWithActiveSchedules();
  }

  async syncDoctors() {
    const kDoctors = await this.khanzaService.getDoctors();
    const kSchedules = await this.khanzaService.getDoctorSchedules();
    const kPolis = await this.khanzaService.getPoliklinik();
    const kSpesialis = await this.khanzaService.getSpesialis();

    let syncedCount = 0;

    for (const doc of kDoctors) {
      // 1. Map Data
      const specialist = kSpesialis.find(s => s.kd_sps === doc.kd_sps);
      const specializationName = specialist ? specialist.nm_sps : 'Umum';

      // Slug generation
      const slug = doc.nm_dokter.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // 2. Upsert Doctor
      // Email is unique, so we might need a fake email if not provided in Khanza
      // Or check if doctor already exists by kd_dokter
      const existing = await this.prisma.doctor.findFirst({
        where: { kd_dokter: doc.kd_dokter }
      });

      const doctorData = {
        name: doc.nm_dokter,
        kd_dokter: doc.kd_dokter,
        phone: doc.no_telp,
        specialization: specializationName,
        slug: existing ? existing.slug : slug + '-' + Math.floor(Math.random() * 1000), // Avoid collision
        email: existing ? existing.email : `dr.${doc.kd_dokter.toLowerCase()}@rsi.id`, // Dummy email
        licenseNumber: existing ? existing.licenseNumber : `SIP-${doc.kd_dokter}`, // Dummy SIP
        isActive: true,
        imageUrl: existing ? existing.imageUrl : null // Gunakan imageUrl dari dokter existing jika ada
      };

      const savedDoctor = await this.prisma.doctor.upsert({
        where: { kd_dokter: doc.kd_dokter },
        update: {
          name: doc.nm_dokter,
          specialization: specializationName,
          phone: doc.no_telp
        },
        create: doctorData
      });

      // 3. Upsert Schedules
      const docSchedules = kSchedules.filter(s => s.kd_dokter === doc.kd_dokter);

      // Clear existing schedules? Or Update?
      // Simpler: Delete all schedules for this doctor and re-insert
      await this.prisma.schedule.deleteMany({ where: { doctorId: savedDoctor.id } });

      for (const sched of docSchedules) {
        // Convert Hari (SENIN, SELASA..) to Int (1, 2..)
        const daysMap: { [key: string]: number } = {
          'MINGGU': 0, 'SENIN': 1, 'SELASA': 2, 'RABU': 3, 'KAMIS': 4, 'JUMAT': 5, 'SABTU': 6,
          'AKHAD': 0
        };
        const dayInt = daysMap[sched.hari_kerja.toUpperCase()] ?? -1;

        if (dayInt >= 0) {
          await this.prisma.schedule.create({
            data: {
              doctorId: savedDoctor.id,
              dayOfWeek: dayInt,
              startTime: sched.jam_mulai, // Validation? 
              endTime: sched.jam_selesai,
            }
          });

          // 4. Link to Category (Poli)
          const poli = kPolis.find(p => p.kd_poli === sched.kd_poli);
          if (poli) {
            // Check if category exists
            const poliSlug = poli.nm_poli.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const category = await this.prisma.category.upsert({
              where: { slug: poliSlug },
              update: {},
              create: {
                name: poli.nm_poli,
                slug: poliSlug,
                type: 'POLI'
              }
            });

            // Connect Doctor to Category
            // Need to check if already connected
            const isConnected = await this.prisma.doctor.findFirst({
              where: { id: savedDoctor.id, categories: { some: { id: category.id } } }
            });

            if (!isConnected) {
              await this.prisma.doctor.update({
                where: { id: savedDoctor.id },
                data: { categories: { connect: { id: category.id } } }
              });
            }
          }
        }
      }
      syncedCount++;
    }

    return { message: `Synced ${syncedCount} doctors` };
  }

  async findAll(getDoctorsDto: GetDoctorsDto) {
    console.log('🔍 [FIND_ALL] Input DTO:', JSON.stringify(getDoctorsDto));

    // Get all doctors from SIMRS Khanza
    const kDoctors = await this.khanzaService.getDoctors();
    const kSchedules = await this.khanzaService.getDoctorSchedulesWithPoliInfo();

    // Filter doctors that have schedules
    const doctorsWithSchedules = kDoctors.filter(kDoctor =>
      kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
    );

    // Get corresponding doctor records from local database
    const kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);

    const where: any = {
      kd_dokter: { in: kDoctorCodes }
    };

    const isExecParam = getDoctorsDto.isExecutive;
    // Only filter if explicitly true
    if (isExecParam === true || String(isExecParam) === 'true') {
      where.is_executive = true;
    }
    // Else (false, undefined, null) -> Show ALL (do not filter)

    switch (getDoctorsDto.sort) {
      case DoctorSortBy.RECOMMENDED:
        return this.getRecommendedDoctorsWithSchedules(getDoctorsDto.limit, kSchedules);
      default:
        const doctors = await this.prisma.doctor.findMany({
          where,
          take: getDoctorsDto.limit,
          select: {
            id: true,
            name: true,
            email: true,
            licenseNumber: true,
            phone: true,
            specialization: true,
            department: true,
            imageUrl: true,
            bio: true,
            experience_years: true,
            education: true,
            certifications: true,
            consultation_fee: true,
            specialtyImage_url: true,
            is_executive: true,
            sip_number: true,
            bpjs: true,
            slug: true,
            kd_dokter: true,
            description: true,
            isActive: true,
            schedules: {
              select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
              }
            },
            categories: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        // Enhance doctors with schedule information from Khanza including poli info
        const enhancedDoctors = doctors.map(doctor => {
          const doctorSchedules = kSchedules.filter(schedule => schedule.kd_dokter === doctor.kd_dokter);
          return {
            ...doctor,
            scheduleDetails: doctorSchedules.map(schedule => ({
              kd_poli: schedule.kd_poli,
              nm_poli: schedule.nm_poli,
              hari_kerja: schedule.hari_kerja,
              jam_mulai: schedule.jam_mulai,
              jam_selesai: schedule.jam_selesai,
              kuota: schedule.kuota,
            }))
          };
        });

        return enhancedDoctors;
    }
  }

  // TODO: Implement recommended doctors algorithm
  private async getRecommendedDoctors(limit: number) {
    const kDoctors = await this.khanzaService.getDoctors();
    const kSchedules = await this.khanzaService.getDoctorSchedulesWithPoliInfo();

    // Filter doctors that have schedules
    const doctorsWithSchedules = kDoctors.filter(kDoctor =>
      kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
    );

    // Get corresponding doctor records from local database
    const kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);

    const doctors = await this.prisma.doctor.findMany({
      where: {
        kd_dokter: { in: kDoctorCodes }
      },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        licenseNumber: true,
        phone: true,
        specialization: true,
        department: true,
        imageUrl: true,
        bio: true,
        experience_years: true,
        education: true,
        certifications: true,
        consultation_fee: true,
        specialtyImage_url: true,
        is_executive: true,
        sip_number: true,
        bpjs: true,
        slug: true,
        kd_dokter: true,
        description: true,
        isActive: true,
        schedules: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },

    });

    // Enhance doctors with schedule information from Khanza including poli info
    const enhancedDoctors = doctors.map(doctor => {
      const doctorSchedules = kSchedules.filter(schedule => schedule.kd_dokter === doctor.kd_dokter);
      return {
        ...doctor,
        scheduleDetails: doctorSchedules.map(schedule => ({
          kd_poli: schedule.kd_poli,
          nm_poli: schedule.nm_poli,
          hari_kerja: schedule.hari_kerja,
          jam_mulai: schedule.jam_mulai,
          jam_selesai: schedule.jam_selesai,
          kuota: schedule.kuota,
        }))
      };
    });

    return enhancedDoctors;
  }

  private async getRecommendedDoctorsWithSchedules(limit: number, kSchedules: any[]) {
    const kDoctors = await this.khanzaService.getDoctors();

    // Filter doctors that have schedules
    const doctorsWithSchedules = kDoctors.filter(kDoctor =>
      kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
    );

    // Get corresponding doctor records from local database
    const kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);

    const doctors = await this.prisma.doctor.findMany({
      where: {
        kd_dokter: { in: kDoctorCodes }
      },
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        licenseNumber: true,
        phone: true,
        specialization: true,
        department: true,
        imageUrl: true,
        bio: true,
        experience_years: true,
        education: true,
        certifications: true,
        consultation_fee: true,
        specialtyImage_url: true,
        is_executive: true,
        sip_number: true,
        bpjs: true,
        slug: true,
        kd_dokter: true,
        description: true,
        isActive: true,
        schedules: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },

    });

    // Enhance doctors with schedule information from Khanza including poli info
    const enhancedDoctors = doctors.map(doctor => {
      const doctorSchedules = kSchedules.filter(schedule => schedule.kd_dokter === doctor.kd_dokter);
      return {
        ...doctor,
        scheduleDetails: doctorSchedules.map(schedule => ({
          kd_poli: schedule.kd_poli,
          nm_poli: schedule.nm_poli,
          hari_kerja: schedule.hari_kerja,
          jam_mulai: schedule.jam_mulai,
          jam_selesai: schedule.jam_selesai,
          kuota: schedule.kuota,
        }))
      };
    });

    return enhancedDoctors;
  }

  async findOne(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        licenseNumber: true,
        phone: true,
        specialization: true,
        department: true,
        imageUrl: true,
        bio: true,
        experience_years: true,
        education: true,
        certifications: true,
        consultation_fee: true,
        specialtyImage_url: true,
        is_executive: true,
        sip_number: true,
        bpjs: true,
        slug: true,
        kd_dokter: true,
        description: true,
        isActive: true,
        schedules: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      }
    });

    if (doctor && doctor.kd_dokter) {
      // Get schedule details from Khanza including poli information
      const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(doctor.kd_dokter);

      if (kSchedules && kSchedules.length > 0) {
        const scheduleDetails = kSchedules.map(schedule => ({
          kd_poli: schedule.kd_poli,
          nm_poli: schedule.nm_poli,
          hari_kerja: schedule.hari_kerja,
          jam_mulai: schedule.jam_mulai,
          jam_selesai: schedule.jam_selesai,
          kuota: schedule.kuota,
        }));

        return {
          ...doctor,
          scheduleDetails
        };
      }
    }

    return doctor;
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    // Jika update termasuk kd_dokter, lakukan validasi unik
    if (updateDoctorDto.kd_dokter) {
      // Cek apakah kd_dokter yang baru sudah digunakan oleh dokter lain
      const existingDoctor = await this.prisma.doctor.findFirst({
        where: {
          kd_dokter: updateDoctorDto.kd_dokter,
          id: { not: id }, // Exclude current doctor
        },
      });

      if (existingDoctor) {
        throw new Error(`Kode dokter ${updateDoctorDto.kd_dokter} sudah digunakan oleh dokter lain: ${existingDoctor.name}`);
      }
    }

    return await this.prisma.doctor.update({
      where: { id },
      data: updateDoctorDto,
    });
  }

  async remove(id: string) {
    return await this.prisma.doctor.delete({
      where: { id },
    });
  }
  async addSchedule(doctorId: string, createScheduleDto: any) {
    return await this.prisma.schedule.create({
      data: {
        ...createScheduleDto,
        doctorId,
      },
    });
  }

  async updateSchedule(scheduleId: string, updateScheduleDto: any) {
    return await this.prisma.schedule.update({
      where: { id: scheduleId },
      data: updateScheduleDto,
    });
  }

  async removeSchedule(scheduleId: string) {
    return await this.prisma.schedule.delete({
      where: { id: scheduleId },
    });
  }

  async findBySlug(slug: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        email: true,
        licenseNumber: true,
        phone: true,
        specialization: true,
        department: true,
        imageUrl: true,
        bio: true,
        experience_years: true,
        education: true,
        certifications: true,
        consultation_fee: true,
        specialtyImage_url: true,
        is_executive: true,
        sip_number: true,
        bpjs: true,
        slug: true,
        kd_dokter: true,
        description: true,
        isActive: true,
        schedules: {
          select: {
            id: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      }
    });

    if (doctor && doctor.kd_dokter) {
      // Get schedule details from Khanza including poli information
      const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(doctor.kd_dokter);

      if (kSchedules && kSchedules.length > 0) {
        const scheduleDetails = kSchedules.map(schedule => ({
          kd_poli: schedule.kd_poli,
          nm_poli: schedule.nm_poli,
          hari_kerja: schedule.hari_kerja,
          jam_mulai: schedule.jam_mulai,
          jam_selesai: schedule.jam_selesai,
          kuota: schedule.kuota,
        }));

        return {
          ...doctor,
          scheduleDetails
        };
      }
    }

    if (!doctor) {
      const idBasedDoctor = await this.prisma.doctor.findUnique({
        where: { id: slug }, // Handle ID passed as slug
        select: {
          id: true,
          name: true,
          email: true,
          licenseNumber: true,
          phone: true,
          specialization: true,
          department: true,
          imageUrl: true,
          bio: true,
          experience_years: true,
          education: true,
          certifications: true,
          consultation_fee: true,
          specialtyImage_url: true,
          is_executive: true,
          sip_number: true,
          bpjs: true,
          slug: true,
          kd_dokter: true,
          description: true,
          isActive: true,
          schedules: {
            select: {
              id: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        }
      });

      if (idBasedDoctor && idBasedDoctor.kd_dokter) {
        // Get schedule details from Khanza including poli information
        const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(idBasedDoctor.kd_dokter);

        if (kSchedules && kSchedules.length > 0) {
          const scheduleDetails = kSchedules.map(schedule => ({
            kd_poli: schedule.kd_poli,
            nm_poli: schedule.nm_poli,
            hari_kerja: schedule.hari_kerja,
            jam_mulai: schedule.jam_mulai,
            jam_selesai: schedule.jam_selesai,
            kuota: schedule.kuota,
          }));

          return {
            ...idBasedDoctor,
            scheduleDetails
          };
        }
      }

      return idBasedDoctor;
    }

    return doctor;
  }
}
