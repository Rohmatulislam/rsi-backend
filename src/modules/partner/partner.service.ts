import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { PartnerUploadService } from './services/partner-upload.service';

@Injectable()
export class PartnerService {
    constructor(
        private prisma: PrismaService,
        private partnerUploadService: PartnerUploadService,
    ) { }

    async create(createPartnerDto: CreatePartnerDto) {
        let imageUrl = createPartnerDto.imageUrl;

        // If image is base64, upload it to Supabase
        if (imageUrl && imageUrl.startsWith('data:image')) {
            const ext = imageUrl.split(';')[0].split('/')[1] || 'png';
            const fileName = `partner-${Date.now()}.${ext}`;
            imageUrl = await this.partnerUploadService.savePartnerImage(imageUrl, fileName);
        }

        return this.prisma.partner.create({
            data: {
                ...createPartnerDto,
                imageUrl,
            },
        });
    }

    async findAll() {
        return this.prisma.partner.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async findActive() {
        return this.prisma.partner.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOne(id: string) {
        const partner = await this.prisma.partner.findUnique({
            where: { id },
        });

        if (!partner) {
            throw new NotFoundException(`Partner with ID ${id} not found`);
        }

        return partner;
    }

    async update(id: string, updatePartnerDto: UpdatePartnerDto) {
        const existing = await this.findOne(id);

        let imageUrl = updatePartnerDto.imageUrl;
        // If new image is base64, upload and delete old one if it was a Supabase URL
        if (imageUrl && imageUrl.startsWith('data:image')) {
            const ext = imageUrl.split(';')[0].split('/')[1] || 'png';
            const fileName = `partner-${id}-${Date.now()}.${ext}`;
            imageUrl = await this.partnerUploadService.savePartnerImage(
                imageUrl,
                fileName,
                existing.imageUrl // Pass old image path to delete it
            );
        }

        return this.prisma.partner.update({
            where: { id },
            data: {
                ...updatePartnerDto,
                imageUrl: imageUrl || undefined,
            },
        });
    }

    async remove(id: string) {
        const existing = await this.findOne(id);

        // Delete image from Supabase if it exists
        if (existing.imageUrl) {
            await this.partnerUploadService.deleteImage(existing.imageUrl);
        }

        return this.prisma.partner.delete({
            where: { id },
        });
    }

    async reorder(orders: { id: string; order: number }[]) {
        await Promise.all(
            orders.map((item) =>
                this.prisma.partner.update({
                    where: { id: item.id },
                    data: { order: item.order },
                }),
            ),
        );
    }
}
