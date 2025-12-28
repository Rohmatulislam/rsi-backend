import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { McuApiService } from './mcu.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('mcu')
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
