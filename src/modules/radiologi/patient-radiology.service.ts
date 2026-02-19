import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../../infra/database/khanza/khanza-db.service';

@Injectable()
export class PatientRadiologyService {
    private readonly logger = new Logger(PatientRadiologyService.name);

    constructor(private readonly khanzaDb: KhanzaDBService) { }

    /**
     * Fetch radiology result history for a patient
     * @param noRM Patient Medical Record Number
     */
    async getPatientRadiologyHistory(noRM: string) {
        try {
            const history = await this.khanzaDb.db('periksa_radiologi as p')
                .join('jns_perawatan_radiologi as j', 'p.kd_jenis_prw', 'j.kd_jenis_prw')
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
                .where('p.no_rkm_medis', noRM)
                .orderBy('p.tgl_periksa', 'desc')
                .orderBy('p.jam', 'desc');

            return history;
        } catch (error) {
            this.logger.error(`Error fetching radiology history for RM ${noRM}`, error);
            const fs = require('fs');
            fs.appendFileSync('error-rad.log', `${new Date().toISOString()} - Error: ${(error as any).message}\nStack: ${(error as any).stack}\n`);
            return [];
        }
    }

    /**
     * Fetch detailed results (expertise) for a specific radiology examination
     * @param noRawat Examination Reference Number
     * @param tgl Examination Date
     * @param jam Examination Time
     */
    async getRadiologyResultDetails(noRawat: string, tgl: string, jam: string) {
        try {
            const result = await this.khanzaDb.db('hasil_radiologi')
                .select('hasil')
                .where('no_rawat', noRawat)
                .andWhere('tgl_periksa', tgl)
                .andWhere('jam', jam)
                .first();

            return result ? result.hasil : null;
        } catch (error) {
            this.logger.error(`Error fetching radiology results for rawat ${noRawat}`, error);
            return null;
        }
    }
}
