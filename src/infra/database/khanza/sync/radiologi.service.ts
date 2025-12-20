import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class RadiologiService {
    private readonly logger = new Logger(RadiologiService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mengambil daftar penjamin yang memiliki pemeriksaan radiologi
     * Tabel: jns_perawatan_radiologi
     */
    async getGuarantors() {
        try {
            const guarantors = await this.dbService.db('jns_perawatan_radiologi')
                .distinct('jns_perawatan_radiologi.kd_pj')
                .join('penjab', 'jns_perawatan_radiologi.kd_pj', 'penjab.kd_pj')
                .select('penjab.kd_pj as id', 'penjab.png_jawab as name')
                .where('jns_perawatan_radiologi.status', '1')
                .andWhere('jns_perawatan_radiologi.total_byr', '>', 0)
                .orderBy('penjab.png_jawab', 'asc');
            return guarantors;
        } catch (error) {
            this.logger.error('Error fetching radiology guarantors from Khanza', error);
            return [];
        }
    }

    /**
     * Mengambil daftar pemeriksaan radiologi
     */
    async getTests(kd_pj?: string) {
        try {
            const query = this.dbService.db('jns_perawatan_radiologi')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byr as price',
                    'kelas as class',
                    'status'
                )
                .where('status', '1');

            if (kd_pj) {
                query.andWhere('kd_pj', kd_pj);
            } else {
                query.andWhere('kd_pj', 'A09'); // Default to UMUM
            }

            return query.orderBy('nm_perawatan', 'asc').limit(500);
        } catch (error) {
            this.logger.error('Error fetching radiology tests from Khanza', error);
            return [];
        }
    }

    async getTestById(id: string) {
        try {
            return this.dbService.db('jns_perawatan_radiologi')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byr as price',
                    'kelas as class',
                    'status'
                )
                .where('kd_jenis_prw', id)
                .first();
        } catch (error) {
            this.logger.error(`Error fetching radiology test ${id}`, error);
            return null;
        }
    }
}
