import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';
import { CacheService } from '../../../cache/cache.service';

@Injectable()
export class McuService {
    private readonly logger = new Logger(McuService.name);

    constructor(
        private readonly dbService: KhanzaDBService,
        private readonly cache: CacheService
    ) { }

    /**
     * Mengambil daftar paket MCU dari Khanza
     * Struktur tabel jns_perawatan:
     * kd_jenis_prw, nm_perawatan, kd_kategory, matrial, bhp, tarif_tindakandr,
     * tarif_tindakanpr, kso, manejemen, total_byrdr, total_byrpr, total_byrdrpr,
     * kd_pj, kd_poli, status
     */
    async getPackages() {
        const cacheKey = 'khanza_mcu_packages';
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const result = await this.dbService.db('jns_perawatan')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byrdr as price',
                    'kd_kategori as category',
                    'kd_poli as poliCode'
                )
                .where('status', '1') // Aktif
                .andWhere(function () {
                    this.where('nm_perawatan', 'like', '%MCU%')
                        .orWhere('nm_perawatan', 'like', '%Paket%')
                        .orWhere('nm_perawatan', 'like', '%Medical%')
                        .orWhere('nm_perawatan', 'like', '%Check Up%');
                })
                .limit(50);

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            this.logger.error('Error fetching MCU packages from Khanza', error);
            return [];
        }
    }

    async getPackageById(id: string) {
        const cacheKey = `khanza_mcu_package_${id}`;
        const cached = this.cache.get(cacheKey);
        if (cached) return cached;

        try {
            const result = await this.dbService.db('jns_perawatan')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byrdr as price',
                    'kd_kategori as category',
                    'kd_poli as poliCode'
                )
                .where('kd_jenis_prw', id)
                .first();

            this.cache.set(cacheKey, result);
            return result;
        } catch (error) {
            this.logger.error(`Error fetching package ${id}`, error);
            return null;
        }
    }
}
