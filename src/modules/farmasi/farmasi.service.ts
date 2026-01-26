import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { PharmacyUploadService } from './services/pharmacy-upload.service';
import { SubmitPrescriptionDto } from './dto/submit-prescription.dto';
import { Prescription } from './entities/prescription.entity';

@Injectable()
export class FarmasiService {
    private readonly logger = new Logger(FarmasiService.name);

    constructor(
        private readonly khanzaService: KhanzaService,
        private readonly prisma: PrismaService,
        private readonly uploadService: PharmacyUploadService,
    ) { }

    async getPrescriptionStatus(identifier: string) {
        this.logger.log(`Fetching prescription status for: ${identifier}`);

        // 1. Try to fetch from SIMRS (Khanza)
        const khanzaStatus = await this.khanzaService.getPrescriptionStatus(identifier);
        if (khanzaStatus) {
            return {
                ...khanzaStatus,
                source: 'SIMRS',
            };
        }

        // 2. If not found in SIMRS, check local digital submissions
        const localPrescription = await (this.prisma as any).prescription.findFirst({
            where: {
                OR: [
                    { id: identifier },
                    { patientPhone: identifier },
                    { patientRM: identifier },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });

        if (localPrescription) {
            // Map local status to display labels
            const statusLabels: Record<string, string> = {
                SUBMITTED: 'Terkirim - Menunggu Verifikasi',
                VERIFIED: 'Terverifikasi - Sedang Disiapkan',
                PROCESSING: 'Sedang Dirack / Disiapkan',
                READY: 'Siap Diambil / Dikirim',
                COMPLETED: 'Selesai / Sudah Diterima',
                CANCELLED: 'Dibatalkan',
            };

            return {
                no_resep: localPrescription.id.slice(-8).toUpperCase(),
                no_rawat: localPrescription.patientRM || '-',
                no_rm: localPrescription.patientRM || '-',
                nama_pasien: localPrescription.patientName,
                dokter: 'Penebusan Resep Mandiri (Foto)',
                tanggal: localPrescription.createdAt.toISOString().split('T')[0],
                jam: localPrescription.createdAt.toISOString().split('T')[1].slice(0, 5),
                status: localPrescription.status,
                status_label: statusLabels[localPrescription.status] || localPrescription.status,
                source: 'WEBSITE',
                delivery_method: localPrescription.deliveryMethod,
            };
        }

        throw new NotFoundException(
            `Data resep dengan nomor ${identifier} tidak ditemukan di SIMRS maupun database website.`,
        );
    }

    async submitPrescription(dto: SubmitPrescriptionDto): Promise<Prescription> {
        this.logger.log(`Submitting prescription for patient: ${dto.patientName}`);

        let imageUrl = '';
        if (dto.prescriptionImage) {
            const fileName = `prescription-${Date.now()}-${dto.patientPhone.slice(-4)}.jpg`;
            imageUrl = await this.uploadService.savePrescriptionImage(
                dto.prescriptionImage,
                fileName,
            );
        }

        const data = await (this.prisma as any).prescription.create({
            data: {
                userId: dto.userId,
                patientName: dto.patientName,
                patientPhone: dto.patientPhone,
                patientRM: dto.patientRM,
                prescriptionImageUrl: imageUrl,
                deliveryMethod: dto.deliveryMethod,
                address: dto.address,
                note: dto.note,
                status: 'SUBMITTED',
            },
        });

        return new Prescription(data);
    }

    async getMyPrescriptions(userId: string): Promise<Prescription[]> {
        this.logger.log(`Fetching prescriptions for user: ${userId}`);

        const results = await (this.prisma as any).prescription.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });

        return results.map(item => new Prescription(item));
    }

    async searchMedicines(query: string) {
        this.logger.log(`Searching medicines for: ${query}`);
        const medicines = await this.khanzaService.farmasiService.searchMedicines(query);
        return medicines.map(m => this.enhanceMedicine(m));
    }

    async getCategories() {
        this.logger.log('Fetching medicine categories');
        // Pre-defined user-friendly categories
        return [
            { id: 'OTC', name: 'Obat Bebas', icon: 'Pill' },
            { id: 'VIT', name: 'Vitamin & Suplemen', icon: 'ShieldCheck' },
            { id: 'KID', name: 'Ibu & Anak', icon: 'Heart' },
            { id: 'ALKES', name: 'Alat Kesehatan', icon: 'Activity' },
        ];
    }

    async getItemsByCategory(category: string) {
        this.logger.log(`Fetching items for category: ${category}`);
        // Map user-friendly category to SIMRS category keywords
        let query = '';
        if (category === 'VIT') query = 'vitamin';
        if (category === 'OTC') query = 'paracetamol'; // Mock query for popular items
        if (category === 'KID') query = 'anak';
        if (category === 'ALKES') query = 'masker';

        const medicines = await this.khanzaService.farmasiService.searchMedicines(query || category);
        return medicines.map(m => this.enhanceMedicine(m));
    }

    async getDailyQueue() {
        this.logger.log('Fetching daily pharmacy queue');
        return await this.khanzaService.farmasiService.getDailyQueue();
    }

    private enhanceMedicine(m: any) {
        // Add mock descriptions and images for popular items
        const lowerName = m.name.toLowerCase();
        let description = `Produk kesehatan ${m.name} berkualitas standar rumah sakit.`;
        let image = '';

        if (lowerName.includes('paracetamol')) {
            description = 'Obat pereda nyeri dan penurun demam yang efektif.';
            image = 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400';
        } else if (lowerName.includes('vitamin c')) {
            description = 'Suplemen vitamin C untuk menjaga daya tahan tubuh.';
            image = 'https://images.unsplash.com/photo-1616671285410-999338274d6c?w=400';
        }

        return {
            ...m,
            description,
            image,
        };
    }
}
