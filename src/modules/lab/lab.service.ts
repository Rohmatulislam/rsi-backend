import { Injectable, Logger } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class LabService {
    private readonly logger = new Logger(LabService.name);

    constructor(private readonly khanzaService: KhanzaService) { }

    async getGuarantors() {
        return this.khanzaService.getLabGuarantors();
    }

    async getTests(kd_pj?: string) {
        return this.khanzaService.getLabTests(kd_pj);
    }

    async getTemplateById(id: number) {
        return this.khanzaService.getLabTemplateById(id);
    }

    async getCategories(kd_pj?: string) {
        return this.khanzaService.getLabCategories(kd_pj);
    }

    async getTestsByCategory(category: string, kd_pj?: string) {
        const allTests = await this.khanzaService.getLabTests(kd_pj);
        return allTests.filter(test => test.category === category);
    }
}
