import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { CreateServiceItemDto } from './dto/create-service-item.dto';
import { UpdateServiceDto, UpdateServiceItemDto } from './dto/update-service.dto';
import { FileUploadService } from './services/file-upload.service';

import { KhanzaService } from '../../infra/database/khanza.service';
import { normalizePoliName, POLI_KEYWORDS_REGEX, isExecutive } from '../../infra/utils/naming.utils';

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

        // SIMRS Integration for Poliklinik
        if (slug === 'rawat-jalan' || slug === 'poli-executive') {
            try {
                // Fetch active poli from SIMRS based on type
                let activePoli = [];
                if (slug === 'rawat-jalan') {
                    activePoli = await this.khanzaService.poliklinikService.getPoliklinikRegularWithActiveSchedules();
                } else if (slug === 'poli-executive') {
                    activePoli = await this.khanzaService.poliklinikService.getPoliklinikExecutiveWithActiveSchedules();
                }

                // Merge SIMRS items with CMS items (Seeded/Marketing data)
                const cmsItems = service.items || [];
                const mergedItems = [...cmsItems];

                if (activePoli && activePoli.length > 0) {
                    // Unique SIMRS items by name to avoid duplicates
                    const seenNames = new Set(cmsItems.map(i => i.name.toLowerCase()));

                    activePoli.forEach((poli, index) => {
                        const poliNameLower = poli.nm_poli.toLowerCase();

                        // Check if this SIMRS poli matches any existing CMS item
                        const matchedIdx = mergedItems.findIndex(i => {
                            const poliNameClean = normalizePoliName(poli.nm_poli).toLowerCase();
                            const itemNameClean = normalizePoliName(i.name).toLowerCase();

                            if (poliNameClean.length < 3 || itemNameClean.length < 3) {
                                return i.name.toLowerCase() === poliNameLower;
                            }

                            return itemNameClean.includes(poliNameClean) || poliNameClean.includes(itemNameClean);
                        });

                        if (matchedIdx !== -1) {
                            if (mergedItems[matchedIdx].id.startsWith('cl')) {
                                mergedItems[matchedIdx].id = poli.kd_poli;
                            }
                        } else if (!seenNames.has(poliNameLower)) {
                            mergedItems.push({
                                id: poli.kd_poli,
                                serviceId: service.id,
                                name: poli.nm_poli,
                                description: `Layanan spesialis ${poli.nm_poli} dengan dokter berpengalaman.`,
                                icon: this.getIconForPoli(poli.nm_poli),
                                imageUrl: null,
                                isActive: true,
                                order: 100 + index,
                                price: null,
                                features: null,
                                category: null,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            } as any);
                            seenNames.add(poliNameLower);
                        }
                    });
                }

                return {
                    ...service,
                    items: mergedItems.sort((a, b) => (a.order || 0) - (b.order || 0))
                };
            } catch (error) {
                console.error(`Failed to fetch SIMRS poli for ${slug}:`, error);
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
        // 1. Try to find in local DB first
        const item = await this.prisma.serviceItem.findUnique({
            where: { id },
            include: {
                service: true
            }
        });

        if (item) {
            return item;
        }

        // 2. If not found, try to find in SIMRS (Khanza)
        try {
            const simrsPoli = await this.khanzaService.getPoliByKdPoli(id);

            if (simrsPoli) {
                // We need the parent service 'rawat-jalan' to attach it
                const parentService = await this.prisma.service.findUnique({
                    where: { slug: 'rawat-jalan' }
                });

                if (!parentService) return null; // Should not happen if seeded

                // Construct a transient ServiceItem object
                return {
                    id: simrsPoli.kd_poli,
                    serviceId: parentService.id,
                    name: simrsPoli.nm_poli,
                    description: `Layanan spesialis ${simrsPoli.nm_poli} dengan dokter berpengalaman.`,
                    icon: this.getIconForPoli(simrsPoli.nm_poli),
                    imageUrl: null,
                    price: null,
                    features: null,
                    category: null,
                    isActive: true,
                    order: 99,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    service: parentService
                };
            }
        } catch (error) {
            console.error(`Failed to find SIMRS poli with id ${id}:`, error);
        }

        // 3. If still not found, throw 404
        throw new NotFoundException(`Service item with id ${id} not found`);
    }

    async getQueueInfo(id: string) {
        let poliCode = id;

        // 1. Resolve ID mapping if it's a CUID or slug (from local DB/CMS)
        // SIMRS codes are usually short (e.g., U0017), so we check for longer IDs or known CUID prefix
        if (id.startsWith('cl') || id.length > 5) {
            try {
                const item = await this.prisma.serviceItem.findUnique({
                    where: { id },
                    select: { name: true }
                });

                if (item) {
                    // Try to find matching SIMRS code by name from active poliklinik list
                    const activePoli = await this.khanzaService.getPoliklinik();
                    const matched = activePoli.find(p => {
                        const pName = p.nm_poli.toLowerCase().replace(/poliklinik|poli|klinik/gi, '').trim();
                        const iName = item.name.toLowerCase().replace(/poliklinik|poli|klinik/gi, '').trim();
                        // Partial match for flexibility (e.g. "Anak" matches "Poli Anak")
                        return pName === iName || pName.includes(iName) || iName.includes(pName);
                    });

                    if (matched) {
                        poliCode = matched.kd_poli;
                    }
                }
            } catch (error) {
                console.error(`Failed to resolve SIMRS poliCode for lookup ID ${id}:`, error);
            }
        }

        // 2. Use the current date in Asia/Makassar (WITA)
        const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });

        try {
            return await this.khanzaService.getQueueInfo(poliCode, date);
        } catch (error) {
            console.error(`Error getting queue info for poli ${poliCode} on ${date}:`, error);
            // Kembalikan data default jika terjadi error
            return {
                total: 0,
                served: 0,
                current: '-',
                remaining: 0,
                currentDoctor: '-'
            };
        }
    }

    /**
     * Get list of patients in queue with their served/waiting status
     */
    async getQueuePatients(id: string) {
        let poliCode = id;

        // Resolve ID mapping if it's a CUID or slug
        if (id.startsWith('cl') || id.length > 5) {
            try {
                const item = await this.prisma.serviceItem.findUnique({
                    where: { id },
                    select: { name: true }
                });

                if (item) {
                    const activePoli = await this.khanzaService.getPoliklinik();
                    const matched = activePoli.find(p => {
                        const pName = p.nm_poli.toLowerCase().replace(/poliklinik|poli|klinik/gi, '').trim();
                        const iName = item.name.toLowerCase().replace(/poliklinik|poli|klinik/gi, '').trim();
                        return pName === iName || pName.includes(iName) || iName.includes(pName);
                    });

                    if (matched) {
                        poliCode = matched.kd_poli;
                    }
                }
            } catch (error) {
                console.error(`Failed to resolve poliCode for ${id}:`, error);
            }
        }

        const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });

        try {
            return await this.khanzaService.getQueuePatients(poliCode, date);
        } catch (error) {
            console.error(`Error getting queue patients for poli ${poliCode}:`, error);
            return { patients: [] };
        }
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
