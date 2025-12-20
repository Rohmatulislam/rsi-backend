import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceDto, UpdateServiceItemDto } from './dto/update-service.dto';
import { FileUploadService } from './services/file-upload.service';

@Injectable()
export class ServiceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileUploadService: FileUploadService
    ) { }

    // ===========================================================================
    // Service Methods
    // ===========================================================================

    async create(createServiceDto: CreateServiceDto) {
        let imagePath = createServiceDto.image;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `service-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveServiceImage(imagePath, fileName);
        }

        return this.prisma.service.create({
            data: {
                ...createServiceDto,
                image: imagePath,
            },
        });
    }

    async findAll() {
        return this.prisma.service.findMany({
            orderBy: { order: 'asc' },
            include: {
                _count: {
                    select: { items: true, faqs: true }
                }
            }
        });
    }

    async findOneBySlug(slug: string) {
        const service = await this.prisma.service.findUnique({
            where: { slug },
            include: {
                items: {
                    orderBy: { order: 'asc' }
                },
                faqs: {
                    orderBy: { order: 'asc' }
                }
            }
        });

        if (!service) {
            throw new NotFoundException(`Service with slug ${slug} not found`);
        }

        return service;
    }

    async update(id: string, updateServiceDto: UpdateServiceDto) {
        const existing = await this.prisma.service.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Service not found');

        let imagePath = updateServiceDto.image;
        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `service-${id}-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveServiceImage(imagePath, fileName, existing.image);
        }

        return this.prisma.service.update({
            where: { id },
            data: {
                ...updateServiceDto,
                image: imagePath || undefined,
            },
        });
    }

    async remove(id: string) {
        const existing = await this.prisma.service.findUnique({ where: { id } });
        if (existing?.image) {
            await this.fileUploadService.deleteImage(existing.image);
        }
        return this.prisma.service.delete({ where: { id } });
    }

    // ===========================================================================
    // Service Item Methods
    // ===========================================================================

    async createItem(createItemDto: CreateServiceItemDto) {
        let imagePath = createItemDto.imageUrl;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `service-item-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveServiceImage(imagePath, fileName);
        }

        return this.prisma.serviceItem.create({
            data: {
                ...createItemDto,
                imageUrl: imagePath,
            },
        });
    }

    async updateItem(id: string, updateItemDto: UpdateServiceItemDto) {
        const existing = await this.prisma.serviceItem.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Service item not found');

        let imagePath = updateItemDto.imageUrl;
        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `service-item-${id}-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveServiceImage(imagePath, fileName, existing.imageUrl);
        }

        return this.prisma.serviceItem.update({
            where: { id },
            data: {
                ...updateItemDto,
                imageUrl: imagePath || undefined,
            },
        });
    }

    async removeItem(id: string) {
        const existing = await this.prisma.serviceItem.findUnique({ where: { id } });
        if (existing?.imageUrl) {
            await this.fileUploadService.deleteImage(existing.imageUrl);
        }
        return this.prisma.serviceItem.delete({ where: { id } });
    }

    async findItemById(id: string) {
        const item = await this.prisma.serviceItem.findUnique({
            where: { id },
            include: {
                service: true
            }
        });

        if (!item) {
            throw new NotFoundException(`Service item with id ${id} not found`);
        }

        return item;
    }
}
