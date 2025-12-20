import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class InpatientService {
    private readonly logger = new Logger(InpatientService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mengambil ketersediaan bed (tempat tidur) dari Khanza
     * Tabel: kamar, bangsal
     */
    async getBedAvailability() {
        try {
            // Query raw untuk mendapatkan statistik ketersediaan bed per bangsal dan kelas
            // status 'ISI' (occupied), 'KOSONG' (available)
            const beds = await this.dbService.db('kamar')
                .join('bangsal', 'kamar.kd_bangsal', 'bangsal.kd_bangsal')
                .select(
                    'bangsal.kd_bangsal',
                    'bangsal.nm_bangsal',
                    'kamar.kelas',
                    this.dbService.db.raw('count(kamar.kd_kamar) as total'),
                    this.dbService.db.raw("sum(case when kamar.status = 'KOSONG' then 1 else 0 end) as available")
                )
                .where('kamar.status', '!=', 'RUSAK') // Abaikan bed rusak
                .andWhere('bangsal.status', '1') // Bangsal aktif
                .groupBy('bangsal.kd_bangsal', 'bangsal.nm_bangsal', 'kamar.kelas')
                .orderBy('bangsal.nm_bangsal', 'asc');

            return beds.map(bed => ({
                buildingId: bed.kd_bangsal,
                buildingName: bed.nm_bangsal,
                class: bed.kelas,
                total: parseInt(bed.total as string),
                available: parseInt(bed.available as string),
            }));
        } catch (error) {
            this.logger.error('Error fetching bed availability from Khanza', error);
            return [];
        }
    }

    /**
     * Mengambil daftar kamar/bed secara detail dari Khanza
     * Tabel: kamar, bangsal
     */
    async getDetailedRooms() {
        try {
            const rooms = await this.dbService.db('kamar')
                .join('bangsal', 'kamar.kd_bangsal', 'bangsal.kd_bangsal')
                .select(
                    'kamar.kd_kamar as id',
                    'kamar.kd_bangsal as buildingId',
                    'bangsal.nm_bangsal as buildingName',
                    'kamar.kelas as class',
                    'kamar.status',
                    'kamar.trf_kamar as price'
                )
                .where('kamar.status', '!=', 'RUSAK')
                .andWhere('bangsal.status', '1')
                .orderBy('kamar.kd_kamar', 'asc');

            return rooms.map(room => ({
                id: room.id,
                buildingId: room.buildingId,
                buildingName: room.buildingName,
                class: room.class,
                status: room.status, // 'ISI', 'KOSONG', 'DIBERSIHKAN'
                price: parseFloat(room.price as string),
            }));
        } catch (error) {
            this.logger.error('Error fetching detailed rooms from Khanza', error);
            return [];
        }
    }

    /**
     * Mengambil daftar bangsal (paviliun/gedung)
     */
    async getBuildings() {
        try {
            return await this.dbService.db('bangsal')
                .select('kd_bangsal as id', 'nm_bangsal as name')
                .where('status', '1')
                .orderBy('nm_bangsal', 'asc');
        } catch (error) {
            this.logger.error('Error fetching buildings from Khanza', error);
            return [];
        }
    }
}
