import { Injectable, Logger } from '@nestjs/common';
import { RadiologiService as KhanzaRadiologiService } from '../../infra/database/khanza/sync/radiologi.service';
import { TreatmentMetadataService } from '../treatment-metadata/treatment-metadata.service';

@Injectable()
export class RadiologiService {
    private readonly logger = new Logger(RadiologiService.name);

    constructor(
        private readonly khanzaRadiologiService: KhanzaRadiologiService,
        private readonly metadataService: TreatmentMetadataService
    ) { }

    async getTests(kd_pj?: string) {
        const tests = await this.khanzaRadiologiService.getTests(kd_pj);

        return Promise.all(
            tests.map(async (test) => {
                const metadata = await this.metadataService.getMergedMetadata(test.id, test.name);
                return {
                    ...test,
                    ...metadata,
                    category: this.categorizeTest(test.name),
                };
            })
        );
    }

    async getGuarantors() {
        return this.khanzaRadiologiService.getGuarantors();
    }

    async getTestById(id: string) {
        const test = await this.khanzaRadiologiService.getTestById(id);
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
        if (upperName.includes('CT SCAN')) return 'CT Scan';
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
