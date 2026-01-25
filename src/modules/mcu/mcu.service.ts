import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class McuApiService {
    private readonly logger = new Logger(McuApiService.name);

    constructor(
        private readonly khanzaService: KhanzaService,
        private readonly prisma: PrismaService,
    ) { }

    /**
     * Get all MCU packages from Khanza
     */
    async getPackages() {
        try {
            // 1. Fetch from Khanza
            const khanzaPackages = await this.khanzaService.getMcuPackages();

            // 2. Fetch from Local DB (Prisma)
            const mcuService = await this.prisma.service.findUnique({
                where: { slug: 'mcu' },
                include: { items: { where: { isActive: true } } }
            });

            const localItems = mcuService?.items || [];

            // 3. Merge: Local items are base, add unique items from Khanza
            const merged = [...localItems.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                category: item.category || 'Umum',
                description: item.description,
                features: item.features,
                source: 'local'
            }))];

            if (khanzaPackages && khanzaPackages.length > 0) {
                const seenNames = new Set(merged.map(i => i.name.toLowerCase()));

                khanzaPackages.forEach(pkg => {
                    const nameLower = pkg.name.toLowerCase();
                    // Merge if name matches exactly or contains
                    const matchedIdx = merged.findIndex(i => {
                        const iClean = i.name.toLowerCase().replace(/paket|mcu|medical|check|up/gi, '').trim();
                        const pkgClean = nameLower.replace(/paket|mcu|medical|check|up/gi, '').trim();
                        return iClean && pkgClean && (iClean.includes(pkgClean) || pkgClean.includes(iClean));
                    });

                    if (matchedIdx !== -1) {
                        // Update ID to Khanza ID so booking works with it
                        // But keep our local better descriptions/features
                        merged[matchedIdx].id = pkg.id;
                        (merged[matchedIdx] as any).source = 'simrs';
                    } else if (!seenNames.has(nameLower)) {
                        merged.push({
                            id: pkg.id,
                            name: pkg.name,
                            price: pkg.price,
                            category: pkg.category || 'SIMRS',
                            description: `Paket pemeriksaan kesehatan ${pkg.name}.`,
                            features: null,
                            source: 'simrs'
                        } as any);
                        seenNames.add(nameLower);
                    }
                });
            }

            return {
                success: true,
                data: merged,
                message: 'MCU packages fetched and merged successfully',
            };
        } catch (error) {
            this.logger.error('Failed to fetch and merge MCU packages', error);
            // Fallback to local items only if everything fails
            const mcuService = await this.prisma.service.findUnique({
                where: { slug: 'mcu' },
                include: { items: { where: { isActive: true } } }
            });
            return {
                success: true,
                data: mcuService?.items || [],
                message: 'Fetched local MCU packages (fallback)',
            };
        }
    }

    /**
     * Get single package by ID
     */
    async getPackageById(id: string) {
        try {
            // Try Khanza first
            let pkg = await this.khanzaService.getMcuPackageById(id);

            if (pkg) {
                return {
                    success: true,
                    data: pkg,
                    message: 'Package fetched from SIMRS successfully',
                };
            }

            // Fallback to Local DB
            const localItem = await this.prisma.serviceItem.findUnique({
                where: { id }
            });

            if (localItem) {
                return {
                    success: true,
                    data: {
                        id: localItem.id,
                        name: localItem.name,
                        price: localItem.price,
                        description: localItem.description,
                        features: localItem.features,
                    },
                    message: 'Package fetched from local database successfully',
                };
            }

            return {
                success: false,
                data: null,
                message: 'Package not found in SIMRS or local database',
            };
        } catch (error) {
            this.logger.error(`Failed to fetch package ${id}`, error);
            return {
                success: false,
                data: null,
                message: 'Failed to fetch package',
            };
        }
    }

    async createBooking(data: {
        packageId: string;
        packageName: string;
        date: string;
        timeSlot: string;
        patientType: 'new' | 'old';
        mrNumber?: string;
        nik: string;
        patientName: string;
        patientPhone: string;
        patientEmail?: string;
        birthDate?: string;
        gender?: 'L' | 'P';
        patientAddress?: string;
        religion?: string;
        notes?: string;
        motherName?: string;
        birthPlace?: string;
        maritalStatus?: string;
        occupation?: string;
        education?: string;
        bloodType?: string;
        penanggungJawab?: string;
        hubunganPenanggungJawab?: string;
        createdByUserId?: string;
    }) {
        this.logger.log(`Processing MCU booking for ${data.patientName} (${data.patientType})`);

        // 1. Get Patient Data
        let patient;
        if (data.patientType === 'old') {
            if (!data.mrNumber) {
                throw new BadRequestException('Nomor RM wajib diisi untuk pasien lama');
            }
            patient = await this.khanzaService.findPatientByNoRM(data.mrNumber);
            if (!patient) {
                throw new BadRequestException('Data Pasien tidak ditemukan di SIMRS (RM tidak valid)');
            }
        } else {
            // New Patient - Check existing by NIK
            patient = await this.khanzaService.findPatientByNIK(data.nik);

            if (!patient) {
                // Register as new patient in Khanza
                try {
                    const newPatientResult = await this.khanzaService.createPatient({
                        name: data.patientName,
                        nik: data.nik,
                        birthDate: data.birthDate!,
                        gender: data.gender!,
                        address: data.patientAddress || '-',
                        phone: data.patientPhone,
                        email: data.patientEmail,
                        religion: data.religion,
                        motherName: data.motherName,
                        birthPlace: data.birthPlace,
                        maritalStatus: data.maritalStatus,
                        occupation: data.occupation,
                        education: data.education,
                        bloodType: data.bloodType,
                        penanggungJawab: data.penanggungJawab,
                        hubunganPenanggungJawab: data.hubunganPenanggungJawab,
                    });
                    // Fetch newly created patient to get full data
                    patient = await this.khanzaService.findPatientByNoRM(newPatientResult.no_rkm_medis);
                } catch (error) {
                    this.logger.error('Failed to register new patient for MCU', error);
                    throw new BadRequestException('Gagal mendaftarkan pasien baru: ' + error.message);
                }
            }
        }

        if (!patient) {
            throw new BadRequestException('Pasien tidak valid');
        }

        // 2. Determine Poli and Doctor
        // Based on our analysis, U0028 is the MCU Poli
        // We will use a default doctor for MCU if not specified
        const poliCode = 'U0028';
        const doctorCode = 'D0000043'; // Default to dr. Lalu Anugrah Nugraha or any from the list

        // 3. Create Booking in SIMRS Khanza
        try {
            const bookingResult = await this.khanzaService.createMcuBooking({
                patient,
                date: data.date,
                timeSlot: data.timeSlot,
                packageId: data.packageId,
                packageName: data.packageName,
                poliCode: poliCode,
                doctorCode: doctorCode,
                notes: data.notes
            });

            // 4. Log to Local Database (Prisma)
            try {
                // Parse date and time
                let appointmentDate = new Date(data.date);
                if (data.timeSlot) {
                    const [hours, minutes] = data.timeSlot.split(':').map(Number);
                    if (!isNaN(hours)) appointmentDate.setHours(hours, minutes || 0, 0, 0);
                }

                await this.prisma.appointment.create({
                    data: {
                        patientId: patient.no_rkm_medis,
                        // Find a valid doctor from local DB to avoid FK constraint error
                        // Preferred: The one assigned to MCU (D0000043)
                        // Fallback: Any doctor if 'D0000043' not in local DB
                        doctorId: await (async () => {
                            const mcuDoctor = await this.prisma.doctor.findFirst({ where: { kd_dokter: 'D0000043' } });
                            if (mcuDoctor) return mcuDoctor.id;
                            const anyDoctor = await this.prisma.doctor.findFirst();
                            return anyDoctor ? anyDoctor.id : 'unknown'; // Foreign key will still fail if no doctors at all, but we handle it in catch
                        })(),
                        appointmentDate: appointmentDate,
                        status: 'scheduled',
                        reason: `MCU: ${data.packageName}`,
                        notes: `No Booking: ${bookingResult.no_booking}, Paket: ${data.packageName}`,
                        patientName: data.patientName,
                        patientPhone: data.patientPhone,
                        patientEmail: data.patientEmail,
                        patientAddress: data.patientAddress,
                        createdByUserId: data.createdByUserId || null
                    }
                });
            } catch (localError) {
                this.logger.error('Failed to save local appointment log', localError);
                // Don't fail the whole request if only local log fails
            }

            return {
                success: true,
                message: 'Reservasi MCU berhasil dibuat',
                data: {
                    bookingCode: bookingResult.no_reg,
                    noBooking: bookingResult.no_booking,
                    patientName: patient.nm_pasien,
                    appointmentDate: data.date,
                    timeSlot: data.timeSlot
                }
            };
        } catch (error) {
            this.logger.error('Failed to process MCU booking bridging', error);
            throw new BadRequestException('Gagal memproses booking ke SIMRS: ' + error.message);
        }
    }
}
