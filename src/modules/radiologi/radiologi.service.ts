import { Injectable, Logger } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class RadiologiService {
    private readonly logger = new Logger(RadiologiService.name);

    constructor(private readonly khanzaService: KhanzaService) { }

    async getTests(kd_pj?: string) {
        const tests = await this.khanzaService.radiologiService.getTests(kd_pj);

        // Apply smart categorization
        return tests.map(test => ({
            ...test,
            category: this.categorizeTest(test.name)
        }));
    }

    async getGuarantors() {
        return this.khanzaService.radiologiService.getGuarantors();
    }

    async getTestById(id: string) {
        const test = await this.khanzaService.radiologiService.getTestById(id);
        if (!test) return null;

        return {
            ...test,
            category: this.categorizeTest(test.name)
        };
    }

    async getCategories(kd_pj?: string) {
        const tests = await this.getTests(kd_pj);
        const categories = [...new Set(tests.map(t => (t as any).category))].filter(Boolean) as string[];
        return categories.sort();
    }

    private categorizeTest(name: string): string {
        const upperName = name.toUpperCase();
        if (upperName.includes('USG')) return 'USG';
        if (upperName.includes('MRI')) return 'MRI';
        if (upperName.includes('CT SCAN') || upperName.includes('CT SCAN')) return 'CT Scan';
        if (
            upperName.includes('THORAX') ||
            upperName.includes('FOTO') ||
            upperName.includes('WRIST') ||
            upperName.includes('GENU') ||
            upperName.includes('SHOULDER') ||
            upperName.includes('PELVIS') ||
            upperName.includes('EXTREMITAS') ||
            upperName.includes('DENTO') ||
            upperName.includes('PANORAMIC')
        ) return 'X-Ray / Foto';
        return 'Lain-lain';
    }
}
