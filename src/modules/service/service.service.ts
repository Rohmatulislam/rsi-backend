import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceDto, UpdateServiceItemDto } from './dto/update-service.dto';
import { FileUploadService } from './services/file-upload.service';

import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class ServiceService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileUploadService: FileUploadService,
        private readonly khanzaService: KhanzaService
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

        // SIMRS Integration for Rawat Jalan
        if (slug === 'rawat-jalan') {
            try {
                // Fetch active poli from SIMRS
                const activePoli = await this.khanzaService.getPoliklinikWithActiveSchedules();

                if (activePoli && activePoli.length > 0) {
                    // Map to ServiceItems (Dynamic)
                    const simrsItems = activePoli.map((poli, index) => ({
                        id: poli.kd_poli, // Use kd_poli as ID for frontend key
                        serviceId: service.id,
                        name: poli.nm_poli,
                        description: `Layanan spesialis ${poli.nm_poli} dengan dokter berpengalaman.`,
                        icon: this.getIconForPoli(poli.nm_poli),
                        imageUrl: null,
                        isActive: true, // Assuming if it has schedule, it's active
                        order: index + 1,
                        price: null,
                        features: null,
                        category: null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }));

                    // Return merged object (CMS Metadata + SIMRS Items)
                    return {
                        ...service,
                        items: simrsItems
                    };
                }
            } catch (error) {
                console.error('Failed to fetch SIMRS poli for Rawat Jalan:', error);
                // Fallback to local items if SIMRS fails
            }
        }

        return service;
    }

    private getIconForPoli(namaPoli: string): string {
        const lower = namaPoli.toLowerCase();
        if (lower.includes('anak')) return 'Baby';
        if (lower.includes('bedah')) return 'Scalpel';
        if (lower.includes('gigi')) return 'Smile';
        if (lower.includes('jantung')) return 'Heart';
        if (lower.includes('kandungan') || lower.includes('obgyn') || lower.includes('kebidanan')) return 'Baby';
        if (lower.includes('mata')) return 'Eye';
        if (lower.includes('paru')) return 'Wind';
        if (lower.includes('dalam')) return 'Activity';
        if (lower.includes('saraf') || lower.includes('syaraf')) return 'Brain';
        if (lower.includes('tht')) return 'Ear';
        if (lower.includes('kulit')) return 'Sparkles';
        if (lower.includes('jiwa')) return 'BrainCircuit';
        if (lower.includes('ortho')) return 'Bone';
        if (lower.includes('rehab')) return 'PersonStanding';
        return 'Stethoscope'; // Default
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

    // ===========================================================================
    // Seed Default Services
    // ===========================================================================

    async seedDefaultServices() {
        const defaultServices = [
            { name: 'Laboratorium', slug: 'laboratorium', title: 'Laboratorium', subtitle: 'Pemeriksaan Lab Akurat', description: 'Layanan pemeriksaan laboratorium dengan hasil akurat dan cepat.', icon: 'FlaskConical', isActive: true, isFeatured: false, order: 1 },
            { name: 'Radiologi', slug: 'radiologi', title: 'Radiologi', subtitle: 'Diagnostik Imaging', description: 'Layanan pemeriksaan X-Ray, CT Scan, USG dan lainnya.', icon: 'Radio', isActive: true, isFeatured: false, order: 2 },
            { name: 'MCU', slug: 'mcu', title: 'Medical Check Up', subtitle: 'Paket Kesehatan Lengkap', description: 'Paket pemeriksaan kesehatan menyeluruh untuk deteksi dini penyakit.', icon: 'ClipboardCheck', isActive: true, isFeatured: false, order: 3 },
            { name: 'Rawat Jalan', slug: 'rawat-jalan', title: 'Rawat Jalan', subtitle: 'Poliklinik Spesialis', description: 'Konsultasi dan pemeriksaan dengan dokter spesialis.', icon: 'Stethoscope', isActive: true, isFeatured: false, order: 4 },
            { name: 'Rawat Inap', slug: 'rawat-inap', title: 'Rawat Inap', subtitle: 'Fasilitas Lengkap', description: 'Layanan perawatan pasien dengan fasilitas kamar lengkap dan nyaman.', icon: 'Building2', isActive: true, isFeatured: false, order: 5 },
            { name: 'Poli Eksekutif', slug: 'poli-executive', title: 'Poliklinik Eksekutif', subtitle: 'Layanan Premium', description: 'Pelayanan premium dengan fasilitas eksklusif dan waktu tunggu minimal.', icon: 'Crown', isActive: true, isFeatured: true, order: 6 },
            { name: 'Farmasi', slug: 'farmasi', title: 'Farmasi 24 Jam', subtitle: 'Apotek Lengkap', description: 'Layanan apotek yang beroperasi sepanjang waktu.', icon: 'Pill', isActive: true, isFeatured: false, order: 7 },
            { name: 'Rehabilitasi Medik', slug: 'rehabilitasi-medik', title: 'Rehabilitasi Medik', subtitle: 'Fisioterapi & Pemulihan', description: 'Layanan fisioterapi dan pemulihan fungsi tubuh.', icon: 'Heart', isActive: true, isFeatured: false, order: 8 },
        ];

        const results = { created: [] as string[], skipped: [] as string[] };

        for (const service of defaultServices) {
            const existing = await this.prisma.service.findUnique({
                where: { slug: service.slug }
            });

            if (existing) {
                results.skipped.push(service.name);
                continue;
            }

            await this.prisma.service.create({ data: service });
            results.created.push(service.name);
        }

        const totalCount = await this.prisma.service.count();
        return { ...results, totalServices: totalCount };
    }
}
