import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { LAB_METADATA, RADIO_METADATA } from '../../infra/utils/treatment-metadata';

@Injectable()
export class TreatmentMetadataService {
    private readonly logger = new Logger(TreatmentMetadataService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findOne(treatmentId: string) {
        // 1. Try to find in DB
        const dbMetadata = await this.prisma.treatmentMetadata.findUnique({
            where: { treatmentId }
        });

        if (dbMetadata) return dbMetadata;

        // 2. Fallback to static metadata
        const staticLab = LAB_METADATA[treatmentId];
        const staticRadio = RADIO_METADATA[treatmentId];
        const staticData = staticLab || staticRadio;

        if (staticData) {
            return {
                treatmentId,
                description: staticData.description,
                preparation: staticData.preparation?.join('\n'),
                estimatedTime: staticData.estimatedTime,
                isPopular: staticData.isPopular || false,
                imageUrl: null,
                source: 'static'
            };
        }

        return null;
    }

    async findAll() {
        const dbData = await this.prisma.treatmentMetadata.findMany();
        return dbData;
    }

    async upsert(data: {
        treatmentId: string;
        type: string;
        description?: string;
        preparation?: string;
        estimatedTime?: string;
        isPopular?: boolean;
        imageUrl?: string;
    }) {
        return this.prisma.treatmentMetadata.upsert({
            where: { treatmentId: data.treatmentId },
            update: {
                description: data.description,
                preparation: data.preparation,
                estimatedTime: data.estimatedTime,
                isPopular: data.isPopular,
                imageUrl: data.imageUrl,
            },
            create: {
                treatmentId: data.treatmentId,
                type: data.type,
                description: data.description,
                preparation: data.preparation,
                estimatedTime: data.estimatedTime,
                isPopular: data.isPopular,
                imageUrl: data.imageUrl,
            }
        });
    }

    async getMergedMetadata(treatmentId: string, defaultName: string) {
        const metadata = await this.findOne(treatmentId);
        return {
            id: treatmentId,
            name: defaultName,
            description: metadata?.description || `Pemeriksaan ${defaultName}.`,
            preparation: metadata?.preparation ? metadata.preparation.split('\n') : [],
            estimatedTime: metadata?.estimatedTime || '-',
            isPopular: metadata?.isPopular || false,
            imageUrl: metadata?.imageUrl || null
        };
    }
}
