import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { McuApiService } from './mcu.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('mcu')
@UseGuards(JwtAuthGuard)
export class McuController {
    constructor(private readonly mcuService: McuApiService) { }

    @Get('packages')
    @AllowAnonymous()
    async getPackages() {
        return this.mcuService.getPackages();
    }

    @Get('packages/:id')
    @AllowAnonymous()
    async getPackageById(@Param('id') id: string) {
        return this.mcuService.getPackageById(id);
    }

    @Post('booking')
    async createBooking(
        @Body() body: any,
    ) {
        return this.mcuService.createBooking(body);
    }
}
