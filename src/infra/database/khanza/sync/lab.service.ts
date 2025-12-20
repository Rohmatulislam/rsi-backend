import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class LabService {
    private readonly logger = new Logger(LabService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mengambil daftar pemeriksaan laboratorium dari Khanza
     * Tabel: jns_perawatan_lab
     */
    async getGuarantors() {
        try {
            const guarantors = await this.dbService.db('jns_perawatan_lab')
                .distinct('jns_perawatan_lab.kd_pj')
                .join('penjab', 'jns_perawatan_lab.kd_pj', 'penjab.kd_pj')
                .select('penjab.kd_pj as id', 'penjab.png_jawab as name')
                .where('jns_perawatan_lab.status', '1')
                .andWhere('jns_perawatan_lab.total_byr', '>', 0)
                .orderBy('penjab.png_jawab', 'asc');
            return guarantors;
        } catch (error) {
            this.logger.error('Error fetching lab guarantors from Khanza', error);
            return [];
        }
    }

    async getTests(kd_pj?: string) {
        try {
            const query = this.dbService.db('jns_perawatan_lab')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byr as price',
                    'kategori as category',
                    'kelas as class',
                    'status'
                )
                .where('status', '1');

            if (kd_pj) {
                query.andWhere('kd_pj', kd_pj);
            } else {
                query.andWhere('kd_pj', 'A09'); // Default to UMUM
            }

            const tests = await query
                .orderBy('nm_perawatan', 'asc')
                .limit(500);

            // Fetch template items for these tests
            const testIds = tests.map(t => t.id);
            const templates = await this.dbService.db('template_laboratorium')
                .whereIn('kd_jenis_prw', testIds)
                .select(
                    'kd_jenis_prw',
                    'id_template as id',
                    'Pemeriksaan as name',
                    'satuan as unit',
                    'nilai_rujukan_ld as ref_ld',
                    'nilai_rujukan_la as ref_la',
                    'nilai_rujukan_pd as ref_pd',
                    'nilai_rujukan_pa as ref_pa',
                    'biaya_item as price'
                )
                .orderBy('urut', 'asc');

            // Map templates to tests
            const testsWithTemplates = tests.map(test => ({
                ...test,
                template: templates.filter(t => t.kd_jenis_prw === test.id)
            }));

            // Filter out tests that have 0 price AND no templates with price
            return testsWithTemplates.filter(test => {
                const hasPrice = (test.price || 0) > 0;
                const hasTemplateWithPrice = test.template.some(t => (t.price || 0) > 0);
                return hasPrice || hasTemplateWithPrice;
            });
        } catch (error) {
            this.logger.error('Error fetching Lab tests from Khanza', error);
            return [];
        }
    }

    async getTestById(id: string) {
        try {
            return this.dbService.db('jns_perawatan_lab')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byr as price',
                    'kategori as category',
                    'kelas as class',
                    'status'
                )
                .where('kd_jenis_prw', id)
                .first();
        } catch (error) {
            this.logger.error(`Error fetching lab test ${id}`, error);
            return null;
        }
    }

    async getTemplateById(id: number) {
        try {
            return this.dbService.db('template_laboratorium as t')
                .join('jns_perawatan_lab as j', 't.kd_jenis_prw', 'j.kd_jenis_prw')
                .select(
                    't.kd_jenis_prw',
                    'j.nm_perawatan as parent_name',
                    'j.kategori',
                    't.id_template as id',
                    't.Pemeriksaan as name',
                    't.satuan as unit',
                    't.nilai_rujukan_ld as ref_ld',
                    't.nilai_rujukan_la as ref_la',
                    't.nilai_rujukan_pd as ref_pd',
                    't.nilai_rujukan_pa as ref_pa',
                    't.biaya_item as price'
                )
                .where('t.id_template', id)
                .first();
        } catch (error) {
            this.logger.error(`Error fetching lab template item ${id}`, error);
            return null;
        }
    }

    async getCategories(kd_pj?: string) {
        try {
            const query = this.dbService.db('jns_perawatan_lab')
                .distinct('kategori')
                .where('status', '1')
                .whereNotNull('kategori');

            if (kd_pj) {
                query.andWhere('kd_pj', kd_pj);
            } else {
                query.andWhere('kd_pj', 'A09');
            }

            const categories = await query;
            return categories.map(c => c.kategori);
        } catch (error) {
            this.logger.error('Error fetching Lab categories', error);
            return [];
        }
    }
}
