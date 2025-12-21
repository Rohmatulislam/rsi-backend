import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class RehabilitationService {
    private readonly logger = new Logger(RehabilitationService.name);

    constructor(private readonly khanzaService: KhanzaService) { }

    async getRehabProgress(identifier: string) {
        this.logger.log(`Fetching rehab progress for: ${identifier}`);

        const progress = await this.khanzaService.getRehabProgress(identifier);

        if (!progress) {
            throw new NotFoundException(`Data rehabilitasi dengan nomor ${identifier} tidak ditemukan`);
        }

        return progress;
    }

    async getTherapies() {
        this.logger.log('Fetching all rehab therapies');
        return this.khanzaService.rehabilitationService.getRehabTherapies();
    }

    async getDoctors() {
        this.logger.log('Fetching KFR specialists');
        return this.khanzaService.rehabilitationService.getRehabDoctors();
    }
}
