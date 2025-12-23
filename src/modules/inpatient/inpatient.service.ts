import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class InpatientService {
    private readonly logger = new Logger(InpatientService.name);

    constructor(
        private readonly khanzaService: KhanzaService,
        private readonly prisma: PrismaService,
    ) { }

    // ============ BED & ROOM (from SIMRS Khanza) ============
    /**
     * Mendapatkan ketersediaan bed secara real-time dengan filter pengecualian lokal
     */
    async getBedAvailability() {
        const rooms = await this.getRooms();

        // Re-aggregate rooms into availability format
        const grouped: Record<string, {
            unitId: string;
            unitName: string;
            class: string;
            total: number;
            available: number;
            minPrice: number;
            maxPrice: number;
        }> = {};

        for (const room of rooms) {
            const key = `${room.unitId}-${room.class}`;
            if (!grouped[key]) {
                grouped[key] = {
                    unitId: room.unitId,
                    unitName: room.unitName,
                    class: room.class,
                    total: 0,
                    available: 0,
                    minPrice: room.price,
                    maxPrice: room.price
                };
            }
            grouped[key].total++;
            if (room.status === 'KOSONG') {
                grouped[key].available++;
            }

            // Calculate price range
            if (room.price < grouped[key].minPrice) grouped[key].minPrice = room.price;
            if (room.price > grouped[key].maxPrice) grouped[key].maxPrice = room.price;
        }

        return Object.values(grouped);
    }

    async getRooms() {
        const [khanzaRooms, excludedBeds] = await Promise.all([
            this.khanzaService.getDetailedRooms(),
            this.prisma.excludedBed.findMany()
        ]);

        const excludedIds = new Set(excludedBeds.map(b => b.id));

        // Filter out beds that are in our exclusion list
        return khanzaRooms.filter(room => !excludedIds.has(room.id));
    }

    /**
     * Mendapatkan daftar unit/bangsal dari SIMRS
     */
    async getUnitsFromKhanza() {
        return this.khanzaService.getInpatientUnits();
    }

    // ============ UNITS (local database with SIMRS sync) ============

    /**
     * Get all units from local database
     */
    async findAllUnits() {
        return this.prisma.building.findMany({
            orderBy: { order: 'asc' },
        });
    }

    /**
     * Get active units only (for public API)
     */
    async findActiveUnits() {
        return this.prisma.building.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    /**
     * Get single unit by ID
     */
    async findOneUnit(id: string) {
        const unit = await this.prisma.building.findUnique({
            where: { id },
        });

        if (!unit) {
            throw new NotFoundException(`Unit with ID ${id} not found`);
        }

        return unit;
    }

    /**
     * Update unit (image, description, etc)
     */
    async updateUnit(id: string, data: {
        name?: string;
        description?: string;
        imageUrl?: string;
        order?: number;
        isActive?: boolean;
    }) {
        await this.findOneUnit(id); // Check if exists

        return this.prisma.building.update({
            where: { id },
            data,
        });
    }

    /**
     * Sync units from SIMRS Khanza to local database
     */
    async syncUnitsFromKhanza() {
        try {
            const khanzaUnits = await this.khanzaService.getInpatientUnits();

            let synced = 0;
            for (const unit of khanzaUnits) {
                await this.prisma.building.upsert({
                    where: { kd_bangsal: unit.id },
                    create: {
                        kd_bangsal: unit.id,
                        name: unit.name,
                        order: synced,
                    },
                    update: {
                        name: unit.name,
                    },
                });
                synced++;
            }

            this.logger.log(`Synced ${synced} units from SIMRS Khanza`);
            return { synced, message: `Berhasil sinkronisasi ${synced} unit dari SIMRS` };
        } catch (error) {
            this.logger.error('Error syncing units from Khanza:', error);
            throw error;
        }
    }

    /**
     * Reorder units
     */
    async reorderUnits(orders: { id: string; order: number }[]) {
        await Promise.all(
            orders.map((item) =>
                this.prisma.building.update({
                    where: { id: item.id },
                    data: { order: item.order },
                }),
            ),
        );

        return { message: 'Urutan unit berhasil diperbarui' };
    }

    // ============ BED EXCLUSIONS ============

    async getExcludedBeds() {
        return this.prisma.excludedBed.findMany();
    }

    async excludeBed(data: { id: string; reason?: string }) {
        return this.prisma.excludedBed.upsert({
            where: { id: data.id },
            create: {
                id: data.id,
                reason: data.reason
            },
            update: {
                reason: data.reason
            }
        });
    }

    async unexcludeBed(id: string) {
        return this.prisma.excludedBed.delete({
            where: { id }
        });
    }
}
