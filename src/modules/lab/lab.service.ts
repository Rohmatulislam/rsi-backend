import { Injectable, Logger } from '@nestjs/common';
import { LabService as KhanzaLabService } from '../../infra/database/khanza/sync/lab.service';

@Injectable()
export class LabService {
    private readonly logger = new Logger(LabService.name);

    constructor(private readonly khanzaLabService: KhanzaLabService) { }

    async getGuarantors() {
        return this.khanzaLabService.getGuarantors();
    }

    async getTests(kd_pj?: string) {
        return this.khanzaLabService.getTests(kd_pj);
    }

    async getTemplateById(id: number) {
        return this.khanzaLabService.getTemplateById(id);
    }

    async getCategories(kd_pj?: string) {
        return this.khanzaLabService.getCategories(kd_pj);
    }

    async getTestsByCategory(category: string, kd_pj?: string) {
        const allTests = await this.khanzaLabService.getTests(kd_pj);
        return allTests.filter(test => test.category === category);
    }
}
