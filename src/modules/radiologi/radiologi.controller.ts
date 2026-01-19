import { Controller, Get, Param, Query } from '@nestjs/common';
import { RadiologiService } from './radiologi.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('radiologi')
export class RadiologiController {
    constructor(private readonly radiologiService: RadiologiService) { }

    @Get('tests')
    @AllowAnonymous()
    async getTests(@Query('kd_pj') kd_pj?: string) {
        return this.radiologiService.getTests(kd_pj);
    }

    @Get('guarantors')
    @AllowAnonymous()
    async getGuarantors() {
        return this.radiologiService.getGuarantors();
    }

    @Get('categories')
    @AllowAnonymous()
    async getCategories(@Query('kd_pj') kd_pj?: string) {
        return this.radiologiService.getCategories(kd_pj);
    }

    @Get('test/:id')
    @AllowAnonymous()
    async getTestById(@Param('id') id: string) {
        return this.radiologiService.getTestById(id);
    }
}
