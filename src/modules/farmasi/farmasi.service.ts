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
}
