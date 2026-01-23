import { Injectable, Logger } from '@nestjs/common';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { PrismaService } from 'src/infra/database/prisma.service';
import { DoctorSortBy, GetDoctorsDto } from './dto/get-doctors.dto';

import { KhanzaService } from 'src/infra/database/khanza.service';
import { FileUploadService } from './services/file-upload.service';
import { NotificationService } from '../notification/notification.service';

import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DoctorService {
  private isSyncing = false;
  private logger = new Logger(DoctorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly khanzaService: KhanzaService,
    private readonly fileUploadService: FileUploadService,
    private readonly notificationService: NotificationService,
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

  async getPaymentMethods() {
    return await this.khanzaService.getPaymentMethods();
  }

  async getKhanzaStatus() {
    return await this.khanzaService.getConnectionStatus();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutomaticSync() {
    this.logger.log('⏰ [AUTO_SYNC] Starting scheduled doctor sync...');
    try {
      await this.performSync();
      this.logger.log('✅ [AUTO_SYNC] Scheduled doctor sync completed');
    } catch (error) {
      this.logger.error('❌ [AUTO_SYNC] Scheduled doctor sync failed:', error.message);
    }
  }

  /**
   * Match existing doctors in local DB with Khanza doctors by name
   * and update their kd_dokter field automatically
   */
  async matchDoctorCodes() {
    this.logger.log('🔗 [MATCH_CODES] Starting automatic kd_dokter matching...');

    try {
      // Get doctors from Khanza
      const kDoctors = await this.khanzaService.getDoctors();

      // Get local doctors without kd_dokter
      const localDoctors = await this.prisma.doctor.findMany({
        where: { kd_dokter: null }
      });

      if (localDoctors.length === 0) {
        return { message: 'All doctors already have kd_dokter', matched: 0 };
      }

      this.logger.log(`📋 [MATCH_CODES] Found ${localDoctors.length} doctors without kd_dokter`);

      let matchedCount = 0;
      const matchResults: { localName: string; khanzaName: string; kd_dokter: string }[] = [];

      for (const localDoc of localDoctors) {
        // Normalize local doctor name for comparison
        const localName = localDoc.name.toLowerCase().replace(/[^a-z\s]/g, '').trim();

        // Find best match in Khanza doctors
        let bestMatch = null;
        let bestScore = 0;

        for (const kDoc of kDoctors) {
          const khanzaName = kDoc.nm_dokter.toLowerCase().replace(/[^a-z\s]/g, '').trim();

          // Simple similarity: check if names contain each other or are equal
          let score = 0;
          if (localName === khanzaName) {
            score = 100;
          } else if (localName.includes(khanzaName) || khanzaName.includes(localName)) {
            score = 80;
          } else {
            // Check word overlap
            const localWords = localName.split(' ');
            const khanzaWords = khanzaName.split(' ');
            const commonWords = localWords.filter(w => khanzaWords.includes(w));
            score = (commonWords.length / Math.max(localWords.length, khanzaWords.length)) * 70;
          }

          if (score > bestScore && score >= 50) {
            bestScore = score;
            bestMatch = kDoc;
          }
        }

        if (bestMatch) {
          // Check if this kd_dokter is not already assigned to another doctor
          const existingWithCode = await this.prisma.doctor.findFirst({
            where: { kd_dokter: bestMatch.kd_dokter }
          });

          if (!existingWithCode) {
            await this.prisma.doctor.update({
              where: { id: localDoc.id },
              data: { kd_dokter: bestMatch.kd_dokter }
            });
            matchedCount++;
            matchResults.push({
              localName: localDoc.name,
              khanzaName: bestMatch.nm_dokter,
              kd_dokter: bestMatch.kd_dokter
            });
            this.logger.log(`✅ Matched: "${localDoc.name}" → "${bestMatch.nm_dokter}" (${bestMatch.kd_dokter})`);
          }
        }
      }

      this.logger.log(`🎯 [MATCH_CODES] Matched ${matchedCount} out of ${localDoctors.length} doctors`);

      return {
        message: `Successfully matched ${matchedCount} doctors with Khanza codes`,
        matched: matchedCount,
        total: localDoctors.length,
        results: matchResults
      };
    } catch (error) {
      this.logger.error('❌ [MATCH_CODES] Error:', error.message);
      throw error;
    }
  }

  /**
   * Remove doctors without kd_dokter (duplicates from before Khanza sync)
   * These are doctors that were manually added but don't link to SIMRS
   */
  async cleanupDuplicates() {
    this.logger.log('🧹 [CLEANUP] Starting duplicate cleanup...');

    try {
      // Find doctors without kd_dokter
      const doctorsWithoutCode = await this.prisma.doctor.findMany({
        where: { kd_dokter: null },
        select: { id: true, name: true }
      });

      if (doctorsWithoutCode.length === 0) {
        return { message: 'No doctors without kd_dokter found', deleted: 0 };
      }

      this.logger.log(`🗑️ [CLEANUP] Found ${doctorsWithoutCode.length} doctors without kd_dokter`);

      // Delete schedules first (foreign key constraint)
      for (const doc of doctorsWithoutCode) {
        await this.prisma.schedule.deleteMany({ where: { doctorId: doc.id } });
      }

      // Delete the doctors
      const deleteResult = await this.prisma.doctor.deleteMany({
        where: { kd_dokter: null }
      });

      this.logger.log(`✅ [CLEANUP] Deleted ${deleteResult.count} doctors without kd_dokter`);

      return {
        message: `Successfully deleted ${deleteResult.count} duplicate doctors`,
        deleted: deleteResult.count,
        deletedDoctors: doctorsWithoutCode.map(d => d.name)
      };
    } catch (error) {
      this.logger.error('❌ [CLEANUP] Error:', error.message);
      throw error;
    }
  }

  async syncDoctors() {
    if (this.isSyncing) {
      return { message: 'Synchronization is already in progress', status: 'progress' };
    }

    // Kick off sync in background
    this.performSync().catch(err => {
      this.logger.error('❌ [SYNC_DOCTORS_BG] Background sync failed:', err.message);
    });

    return {
      message: 'Synchronization started in background. This may take a few minutes.',
      status: 'started'
    };
  }

  private async performSync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      let kDoctors = [];
      let kSchedules = [];
      let kPolis = [];
      let kSpesialis = [];

      try {
        kDoctors = await this.khanzaService.getDoctors();
        kSchedules = await this.khanzaService.getDoctorSchedules();
        kPolis = await this.khanzaService.getPoliklinik();
        kSpesialis = await this.khanzaService.getSpesialis();
      } catch (error) {
        this.logger.error('❌ [PERFORM_SYNC] Error fetching from Khanza:', error.message);
        throw error;
      }

      this.logger.log(`⚙️ [PERFORM_SYNC] Syncing ${kDoctors.length} doctors...`);

      // Cache categories and doctors to avoid constant DB calls
      const [existingCategories, existingDoctors] = await Promise.all([
        this.prisma.category.findMany({ where: { type: 'POLI' } }),
        this.prisma.doctor.findMany()
      ]);

      const categoryCache = new Map(existingCategories.map(c => [c.slug, c.id]));
      const doctorMap = new Map(existingDoctors.filter(d => d.kd_dokter).map(d => [d.kd_dokter, d]));

      let syncedCount = 0;

      for (const doc of kDoctors) {
        try {
          const specialist = kSpesialis.find(s => s.kd_sps === doc.kd_sps);
          const specializationName = specialist ? specialist.nm_sps : 'Umum';
          const existing = doctorMap.get(doc.kd_dokter);

          const slug = doc.nm_dokter.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

          const doctorData = {
            name: doc.nm_dokter,
            kd_dokter: doc.kd_dokter,
            phone: doc.no_telp,
            specialization: specializationName,
            slug: existing ? existing.slug : `${slug}-${Math.floor(Math.random() * 1000)}`,
            email: existing ? existing.email : `dr.${doc.kd_dokter.toLowerCase()}@rsi.id`,
            licenseNumber: existing ? existing.licenseNumber : `SIP-${doc.kd_dokter}`,
            isActive: true,
            imageUrl: existing ? existing.imageUrl : null
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

          // Update cache for next iteration if needed (though unlikely to have duplicates in kDoctors)
          doctorMap.set(doc.kd_dokter, savedDoctor as any);

          // 3. Upsert Schedules
          const docSchedules = kSchedules.filter(s => s.kd_dokter === doc.kd_dokter);
          await this.prisma.schedule.deleteMany({ where: { doctorId: savedDoctor.id } });

          const schedulesToCreate = [];
          for (const sched of docSchedules) {
            const daysMap: { [key: string]: number } = {
              'MINGGU': 0, 'SENIN': 1, 'SELASA': 2, 'RABU': 3, 'KAMIS': 4, 'JUMAT': 5, 'SABTU': 6, 'AKHAD': 0
            };
            const dayInt = daysMap[sched.hari_kerja.toUpperCase()] ?? -1;

            if (dayInt >= 0) {
              schedulesToCreate.push({
                doctorId: savedDoctor.id,
                dayOfWeek: dayInt,
                startTime: sched.jam_mulai,
                endTime: sched.jam_selesai,
              });

              // 4. Link to Category (Poli)
              const poli = kPolis.find(p => p.kd_poli === sched.kd_poli);
              if (poli) {
                const poliSlug = poli.nm_poli.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                let categoryId = categoryCache.get(poliSlug);

                if (!categoryId) {
                  const category = await this.prisma.category.upsert({
                    where: { slug: poliSlug },
                    update: {},
                    create: { name: poli.nm_poli, slug: poliSlug, type: 'POLI' }
                  });
                  categoryId = category.id;
                  categoryCache.set(poliSlug, categoryId);
                }

                // Connect if not already
                const isConnected = await this.prisma.doctor.findFirst({
                  where: { id: savedDoctor.id, categories: { some: { id: categoryId } } }
                });

                if (!isConnected) {
                  await this.prisma.doctor.update({
                    where: { id: savedDoctor.id },
                    data: { categories: { connect: { id: categoryId } } }
                  });
                }
              }
            }
          }

          if (schedulesToCreate.length > 0) {
            await this.prisma.schedule.createMany({ data: schedulesToCreate });
          }

          syncedCount++;
        } catch (doctorError) {
          this.logger.warn(`⚠️ [PERFORM_SYNC] Failed for ${doc.kd_dokter}: ${doctorError.message}`);
        }
      }
      this.logger.log(`✅ [PERFORM_SYNC] Successfully synced ${syncedCount} doctors`);
    } finally {
      this.isSyncing = false;
    }
  }

  async findAll(getDoctorsDto: GetDoctorsDto) {
    // console.log('🔍 [FIND_ALL] Input DTO:', JSON.stringify(getDoctorsDto));

    let kDoctors = [];
    let kSchedules = [];
    let kDoctorCodes = [];
    let todayCounts = new Map<string, number>();

    try {
      // Get all doctors from SIMRS Khanza
      const [doctors, schedules, counts] = await Promise.all([
        this.khanzaService.getDoctors(),
        this.khanzaService.getDoctorSchedulesWithPoliInfo(),
        this.khanzaService.getBookingCountsByDate(new Date().toISOString().split('T')[0])
      ]);

      kDoctors = doctors;
      kSchedules = schedules;

      // Map counts for quick lookup
      counts.forEach(c => todayCounts.set(c.kd_dokter, c.count));

      // 1. FILTER BY POLI CODE IF PROVIDED
      if (getDoctorsDto.poliCode) {
        kSchedules = kSchedules.filter(s => s.kd_poli === getDoctorsDto.poliCode);
      }

      if (!getDoctorsDto.showAll) {
        // Filter doctors that have schedules (or filtered schedules)
        const doctorsWithSchedules = kDoctors.filter(kDoctor =>
          kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
        );

        // Get corresponding doctor records from local database
        kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);
      }
    } catch (error) {
      console.error('❌ [FIND_ALL] Error fetching from Khanza:', error.message);
      // If Khanza is unreachable, we will show all doctors from local DB
    }

    const where: any = {};
    // Only filter by kd_dokter if we have codes AND showAll is false
    // Skip this filter if it would exclude all doctors (to support doctors without kd_dokter)
    if (kDoctorCodes.length > 0 && !getDoctorsDto.showAll) {
      // Check if we have any local doctors with these codes before filtering
      const matchingDoctors = await this.prisma.doctor.count({
        where: { kd_dokter: { in: kDoctorCodes } }
      });
      // Only apply filter if we have matching doctors, otherwise show all active doctors
      if (matchingDoctors > 0) {
        where.kd_dokter = { in: kDoctorCodes };
      } else if (getDoctorsDto.poliCode) {
        // If filtering by Poli and no local doctors found, return empty (correct behavior)
        return [];
      }
    } else if (getDoctorsDto.poliCode && kDoctorCodes.length === 0 && !getDoctorsDto.showAll) {
      // Poli filter requested but no schedules/doctors found
      return [];
    }

    // Default to only showing active doctors unless requested otherwise
    if (!getDoctorsDto.includeInactive) {
      where.isActive = true;
    }

    const isExecParam = getDoctorsDto.isExecutive;
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
            ...({ isStudying: true } as any),
            ...({ isOnLeave: true } as any),
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

        const todayDayInt = new Date().getDay() === 0 ? 0 : new Date().getDay(); // 0-6 (Sun-Sat) or Khanza might use differnt map
        // Khanza Jadwal often uses HARI_KERJA enum like 'SENIN', 'SELASA'.
        // Mapping: SENIN=1, SELASA=2, RABU=3, KAMIS=4, JUMAT=5, SABTU=6, AKHAD/MINGGU=0
        const daysMap: { [key: string]: number } = {
          'MINGGU': 0, 'SENIN': 1, 'SELASA': 2, 'RABU': 3, 'KAMIS': 4, 'JUMAT': 5, 'SABTU': 6, 'AKHAD': 0
        };

        // Enhance doctors with schedule information from Khanza including poli info
        const enhancedDoctors = doctors.map((doctor: any) => {
          const doctorSchedules = kSchedules.filter(schedule => schedule.kd_dokter === doctor.kd_dokter);

          return {
            ...doctor,
            scheduleDetails: doctorSchedules.map(schedule => {
              const schedDay = daysMap[schedule.hari_kerja.toUpperCase()];
              const isToday = schedDay === todayDayInt;

              // Calculate Quota
              const totalQuota = schedule.kuota || 0;
              // Only subtract if it's TODAY's schedule. For future days, we don't know yet (future feature)
              const currentBooked = isToday ? (todayCounts.get(doctor.kd_dokter) || 0) : 0;
              const remaining = Math.max(0, totalQuota - currentBooked);

              return {
                kd_poli: schedule.kd_poli,
                nm_poli: schedule.nm_poli,
                hari_kerja: schedule.hari_kerja,
                jam_mulai: schedule.jam_mulai,
                jam_selesai: schedule.jam_selesai,
                kuota: totalQuota,
                sisa_kuota: remaining, // Use this for display
                is_today: isToday,
                consultation_fee: schedule.registrasi || 0,
              };
            })
          };
        });

        // console.log('📋 [FIND_ALL] Returning names:', enhancedDoctors.map((d: any) => d.name).join(', '));
        return enhancedDoctors;
    }
  }

  // TODO: Implement recommended doctors algorithm
  private async getRecommendedDoctors(limit: number) {
    let kDoctors = [];
    let kSchedules = [];

    try {
      kDoctors = await this.khanzaService.getDoctors();
      kSchedules = await this.khanzaService.getDoctorSchedulesWithPoliInfo();
    } catch (error) {
      console.error('❌ [RECOMMENDED_LEGACY] Error fetching from Khanza:', error.message);
    }

    // Filter doctors that have schedules
    const doctorsWithSchedules = kDoctors.filter(kDoctor =>
      kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
    );

    // Get corresponding doctor records from local database
    const kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);

    const doctors = await this.prisma.doctor.findMany({
      where: {
        kd_dokter: { in: kDoctorCodes },
        isActive: true
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
        ...({ isStudying: true } as any),
        ...({ isOnLeave: true } as any),
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
          consultation_fee: schedule.registrasi || 0,
        }))
      };
    });

    return enhancedDoctors;
  }

  private async getRecommendedDoctorsWithSchedules(limit: number, kSchedules: any[]) {
    let kDoctors = [];
    let kDoctorCodes = [];

    try {
      kDoctors = await this.khanzaService.getDoctors();
      // Filter doctors that have schedules
      const doctorsWithSchedules = kDoctors.filter(kDoctor =>
        kSchedules.some(schedule => schedule.kd_dokter === kDoctor.kd_dokter)
      );
      kDoctorCodes = doctorsWithSchedules.map(kDoc => kDoc.kd_dokter);
    } catch (error) {
      console.error('❌ [RECOMMENDED] Error fetching from Khanza:', error.message);
    }

    const where: any = {};
    if (kDoctorCodes.length > 0) {
      where.kd_dokter = { in: kDoctorCodes };
    }
    where.isActive = true;

    const doctors = await this.prisma.doctor.findMany({
      where,
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
        ...({ isStudying: true } as any),
        ...({ isOnLeave: true } as any),
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
          consultation_fee: schedule.registrasi || 0,
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
        ...({ isStudying: true } as any),
        ...({ isOnLeave: true } as any),
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
      try {
        // Get schedule details from Khanza including poli information
        const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(doctor.kd_dokter as any);

        if (kSchedules && kSchedules.length > 0) {
          const scheduleDetails = kSchedules.map(schedule => ({
            kd_poli: schedule.kd_poli,
            nm_poli: schedule.nm_poli,
            hari_kerja: schedule.hari_kerja,
            jam_mulai: schedule.jam_mulai,
            jam_selesai: schedule.jam_selesai,
            kuota: schedule.kuota,
            consultation_fee: schedule.registrasi || 0,
          }));

          return {
            ...doctor,
            scheduleDetails
          };
        }
      } catch (error) {
        console.error(`❌ [FIND_ONE] Error fetching from Khanza for doctor ${doctor.kd_dokter}:`, error.message);
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

    // Handle Base64 image in imageUrl if present
    const dataToUpdate = { ...updateDoctorDto };
    if (updateDoctorDto.imageUrl && updateDoctorDto.imageUrl.startsWith('data:image')) {
      const updated = await this.updateDoctorImage(id, updateDoctorDto.imageUrl);
      dataToUpdate.imageUrl = updated.imageUrl;
    }

    // Check for status change to isOnLeave
    const currentDoctor = await this.prisma.doctor.findUnique({
      where: { id },
      select: { isOnLeave: true, name: true }
    });

    const isNewlyOnLeave = updateDoctorDto.isOnLeave === true && currentDoctor?.isOnLeave !== true;

    const result = await this.prisma.doctor.update({
      where: { id },
      data: dataToUpdate,
    });

    if (isNewlyOnLeave) {
      this.handleDoctorLeaveNotifications(id, currentDoctor.name).catch(err => {
        this.logger.error(`❌ Failed to send leave notifications for doctor ${id}: ${err.message}`);
      });
    }

    return result;
  }

  private async handleDoctorLeaveNotifications(doctorId: string, doctorName: string) {
    this.logger.log(`📢 [LEAVE_NOTICE] Start sending notifications for doctor: ${doctorName}`);

    // Get today at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const affectedAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: doctorId,
        status: 'scheduled',
        appointmentDate: {
          gte: today
        }
      },
      orderBy: {
        appointmentDate: 'asc'
      }
    });

    this.logger.log(`📢 [LEAVE_NOTICE] Found ${affectedAppointments.length} affected appointments`);

    for (const appt of affectedAppointments) {
      if (appt.patientPhone) {
        try {
          const dateStr = appt.appointmentDate.toLocaleDateString('id-ID', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          // Getting time part safely if available, otherwise just use a default or empty
          const timeStr = appt.appointmentDate.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit'
          }) || '--:--';

          const results = await this.notificationService.sendDoctorLeaveNotification({
            patientName: appt.patientName || 'Pasien',
            patientPhone: appt.patientPhone,
            patientEmail: appt.patientEmail,
            doctorName: doctorName,
            appointmentDate: dateStr,
            appointmentTime: timeStr,
            bookingCode: appt.id.substring(appt.id.length - 6).toUpperCase()
          }, appt.id);

          if (results.whatsapp && results.email) {
            this.logger.log(`✅ [LEAVE_NOTICE] Notifications sent to ${appt.patientName} via WA and Email`);
          } else if (results.whatsapp) {
            this.logger.log(`✅ [LEAVE_NOTICE] Notification sent to ${appt.patientName} via WA only`);
          } else if (results.email) {
            this.logger.log(`✅ [LEAVE_NOTICE] Notification sent to ${appt.patientName} via Email only (WA failed)`);
          } else {
            this.logger.error(`❌ [LEAVE_NOTICE] All notifications failed for ${appt.patientName}`);
          }
        } catch (error) {
          this.logger.error(`❌ [LEAVE_NOTICE] Failed to notify ${appt.patientName}: ${error.message}`);
        }
      }
    }
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
        ...({ isStudying: true } as any),
        ...({ isOnLeave: true } as any),
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
      try {
        // Get schedule details from Khanza including poli information
        const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(doctor.kd_dokter as any);

        if (kSchedules && kSchedules.length > 0) {
          // Identify today's registrations to prioritize the active polyclinic
          const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
          const today = days[new Date().getDay()];
          const todayDate = new Date().toISOString().split('T')[0];

          // Fetch counts of registrations today for this doctor per poli to identify "actually active" poli
          const counts = await this.khanzaService.db('reg_periksa')
            .where('kd_dokter', doctor.kd_dokter)
            .where('tgl_registrasi', todayDate)
            .whereNot('stts', 'Batal')
            .groupBy('kd_poli')
            .select('kd_poli')
            .count('* as count');

          const queueCountMap = (counts as any[]).reduce((acc, curr) => {
            acc[curr.kd_poli] = parseInt(String(curr.count));
            return acc;
          }, {} as Record<string, number>);

          const scheduleDetails = kSchedules.map(schedule => {
            const isToday = schedule.hari_kerja === today || (today === 'MINGGU' && schedule.hari_kerja === 'AKHAD');
            return {
              kd_poli: schedule.kd_poli,
              nm_poli: schedule.nm_poli,
              hari_kerja: schedule.hari_kerja,
              jam_mulai: schedule.jam_mulai,
              jam_selesai: schedule.jam_selesai,
              kuota: schedule.kuota,
              consultation_fee: schedule.registrasi || 0,
              isToday,
              todayQueueSize: queueCountMap[schedule.kd_poli] || 0,
            };
          });

          // Sort by: isToday first, then todayQueueSize (descending), then jam_mulai (earliest first)
          scheduleDetails.sort((a, b) => {
            // 1. Is it today?
            if (a.isToday && !b.isToday) return -1;
            if (!a.isToday && b.isToday) return 1;

            if (a.isToday && b.isToday) {
              // 2. Which one has more queue today? (likely the "real" active poli)
              if (a.todayQueueSize > b.todayQueueSize) return -1;
              if (a.todayQueueSize < b.todayQueueSize) return 1;

              // 3. Which one starts earlier?
              return (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
            }

            return 0;
          });

          return {
            ...doctor,
            scheduleDetails
          };
        }
      } catch (error) {
        console.error(`❌ [FIND_BY_SLUG] Error fetching from Khanza for doctor ${doctor.kd_dokter}:`, error.message);
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
          ...({ isStudying: true } as any),
          ...({ isOnLeave: true } as any),
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
        try {
          // Get schedule details from Khanza including poli information
          const kSchedules = await this.khanzaService.getDoctorSchedulesByDoctorAndPoli(idBasedDoctor.kd_dokter as any);

          if (kSchedules && kSchedules.length > 0) {
            const scheduleDetails = kSchedules.map(schedule => ({
              kd_poli: schedule.kd_poli,
              nm_poli: schedule.nm_poli,
              hari_kerja: schedule.hari_kerja,
              jam_mulai: schedule.jam_mulai,
              jam_selesai: schedule.jam_selesai,
              kuota: schedule.kuota,
              consultation_fee: schedule.registrasi || 0,
            }));

            return {
              ...idBasedDoctor,
              scheduleDetails
            };
          }
        } catch (error) {
          console.error(`❌ [FIND_BY_ID_FALLBACK] Error fetching from Khanza for doctor ${idBasedDoctor.kd_dokter}:`, error.message);
        }
      }

      return idBasedDoctor;
    }

    return doctor;
  }
}
