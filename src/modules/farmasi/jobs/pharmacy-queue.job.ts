import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KhanzaService } from '../../../infra/database/khanza.service';
import { PharmacyGateway } from '../pharmacy.gateway';

@Injectable()
export class PharmacyQueueJob {
    private readonly logger = new Logger(PharmacyQueueJob.name);
    private processedResepIds = new Set<string>();
    private lastResetDate = '';

    constructor(
        private readonly khanzaService: KhanzaService,
        private readonly pharmacyGateway: PharmacyGateway,
    ) { }

    @Cron('*/10 * * * * *') // Every 10 seconds
    async handleCron() {
        const today = new Date().toISOString().split('T')[0];

        // Reset tracking if day changes
        if (this.lastResetDate !== today) {
            this.processedResepIds.clear();
            this.lastResetDate = today;
            this.logger.log(`Queue tracker reset for new date: ${today}`);
        }

        try {
            const db = this.khanzaService.db;

            // Fetch prescriptions validated today that haven't been processed yet
            // In Khanza, tgl_penyerahan is set when prescription is ready/done
            const readyPrescriptions = await db('resep_obat as r')
                .select('r.no_resep', 'p.nm_pasien', 'r.no_rawat')
                .join('reg_periksa as reg', 'r.no_rawat', 'reg.no_rawat')
                .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                .where('r.tgl_penyerahan', today)
                .whereNotIn('r.no_resep', Array.from(this.processedResepIds));

            if (readyPrescriptions.length > 0) {
                this.logger.log(`Found ${readyPrescriptions.length} new ready prescriptions`);

                for (const resep of readyPrescriptions) {
                    this.pharmacyGateway.broadcastPrescriptionReady({
                        no_resep: resep.no_resep,
                        nama_pasien: resep.nm_pasien,
                        no_rawat: resep.no_rawat,
                    });

                    this.processedResepIds.add(resep.no_resep);
                }
            }
        } catch (error) {
            this.logger.error('Error polling pharmacy queue from Khanza', error);
        }
    }
}
