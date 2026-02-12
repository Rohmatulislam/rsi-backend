import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KhanzaRehabilitationService } from '../../infra/database/khanza/rehabilitation/rehabilitation.service';

@Injectable()
export class RehabilitationService {
    private readonly logger = new Logger(RehabilitationService.name);

    constructor(private readonly khanzaRehabService: KhanzaRehabilitationService) { }

    async getRehabProgress(identifier: string) {
        this.logger.log(`Fetching rehab progress for: ${identifier}`);

        const progress = await this.khanzaRehabService.getRehabProgress(identifier);

        if (!progress) {
            throw new NotFoundException(`Data rehabilitasi dengan nomor ${identifier} tidak ditemukan`);
        }

        return progress;
    }

    async getTherapies() {
        this.logger.log('Fetching all rehab therapies');
        return this.khanzaRehabService.getRehabTherapies();
    }

    async getDoctors() {
        this.logger.log('Fetching KFR specialists');
        return this.khanzaRehabService.getRehabDoctors();
    }
}
