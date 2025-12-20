import { Controller, Get, Param, Query } from '@nestjs/common';
import { LabService } from './lab.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('lab')
export class LabController {
    constructor(private readonly labService: LabService) { }

    @Get('guarantors')
    @AllowAnonymous()
    async getGuarantors() {
        return this.labService.getGuarantors();
    }

    @Get('tests')
    @AllowAnonymous()
    async getTests(@Query('kd_pj') kd_pj?: string) {
        return this.labService.getTests(kd_pj);
    }

    @Get('categories')
    @AllowAnonymous()
    async getCategories(@Query('kd_pj') kd_pj?: string) {
        return this.labService.getCategories(kd_pj);
    }

    @Get('tests/category/:category')
    @AllowAnonymous()
    async getTestsByCategory(
        @Param('category') category: string,
        @Query('kd_pj') kd_pj?: string
    ) {
        return this.labService.getTestsByCategory(category, kd_pj);
    }

    @Get('template/:id')
    @AllowAnonymous()
    async getTemplateById(@Param('id') id: string) {
        return this.labService.getTemplateById(parseInt(id));
    }
}
