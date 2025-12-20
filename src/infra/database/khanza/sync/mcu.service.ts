import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class McuService {
    private readonly logger = new Logger(McuService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mengambil daftar paket MCU dari Khanza
     * Struktur tabel jns_perawatan:
     * kd_jenis_prw, nm_perawatan, kd_kategory, matrial, bhp, tarif_tindakandr,
     * tarif_tindakanpr, kso, manejemen, total_byrdr, total_byrpr, total_byrdrpr,
     * kd_pj, kd_poli, status
     */
    async getPackages() {
        try {
            const packages = await this.dbService.db('jns_perawatan')
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

            return packages;
        } catch (error) {
            this.logger.error('Error fetching MCU packages from Khanza', error);
            return [];
        }
    }

    async getPackageById(id: string) {
        try {
            return this.dbService.db('jns_perawatan')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byrdr as price',
                    'kd_kategori as category',
                    'kd_poli as poliCode'
                )
                .where('kd_jenis_prw', id)
                .first();
        } catch (error) {
            this.logger.error(`Error fetching package ${id}`, error);
            return null;
        }
    }
}
