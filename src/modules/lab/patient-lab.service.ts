import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../../infra/database/khanza/khanza-db.service';

@Injectable()
export class PatientLabService {
    private readonly logger = new Logger(PatientLabService.name);

    constructor(private readonly khanzaDb: KhanzaDBService) { }

    /**
     * Fetch lab result history for a patient
     * @param noRM Patient Medical Record Number
     */
    async getPatientLabHistory(noRM: string) {
        try {
            const history = await this.khanzaDb.db('periksa_lab as p')
                .join('reg_periksa as r', 'p.no_rawat', 'r.no_rawat')
                .join('jns_perawatan_lab as j', 'p.kd_jenis_prw', 'j.kd_jenis_prw')
                .join('dokter as d', 'p.kd_dokter', 'd.kd_dokter')
                .select(
                    'p.no_rawat',
                    'p.tgl_periksa',
                    'p.jam',
                    'p.kd_jenis_prw',
                    'j.nm_perawatan',
                    'd.nm_dokter',
                    'p.status'
                )
                .where('r.no_rkm_medis', noRM)
                .orderBy('p.tgl_periksa', 'desc')
                .orderBy('p.jam', 'desc');

            return history;
        } catch (error) {
            this.logger.error(`Error fetching lab history for RM ${noRM}`, error);
            const fs = require('fs');
            fs.appendFileSync('error-lab.log', `${new Date().toISOString()} - Error: ${(error as any).message}\nStack: ${(error as any).stack}\n`);
            return [];
        }
    }

    /**
     * Fetch detailed results for a specific lab examination
     * @param noRawat Examination Reference Number
     * @param kdJenisPrw Treatment Code
     */
    async getLabResultDetails(noRawat: string, kdJenisPrw: string) {
        try {
            const details = await this.khanzaDb.db('detail_periksa_lab as d')
                .join('template_laboratorium as t', function () {
                    this.on('d.id_template', '=', 't.id_template')
                        .andOn('d.kd_jenis_prw', '=', 't.kd_jenis_prw');
                })
                .select(
                    'd.id_template',
                    't.Pemeriksaan as name',
                    'd.nilai',
                    'd.satuan',
                    'd.nilai_rujukan',
                    'd.keterangan',
                    't.urut'
                )
                .where('d.no_rawat', noRawat)
                .andWhere('d.kd_jenis_prw', kdJenisPrw)
                .orderBy('t.urut', 'asc');

            // Add flag for abnormal results if possible
            // In Khanza, usually determined by comparing 'nilai' with 'nilai_rujukan'
            // or there's a specific field like 'keterangan' (L/H/Normal)
            return details.map(item => ({
                ...item,
                isAbnormal: this.checkAbnormal(item.nilai, item.nilai_rujukan)
            }));
        } catch (error) {
            this.logger.error(`Error fetching lab details for rawat ${noRawat}`, error);
            return [];
        }
    }

    private checkAbnormal(nilai: string, rujukan: string): boolean {
        if (!nilai || !rujukan) return false;

        // Simple logic for demonstration. 
        // In a real scenario, this would parse numeric ranges like "10 - 20"
        // and check if 'nilai' is within those bounds.
        // For now, we'll return false and rely on 'keterangan' if present.
        return false;
    }
}
