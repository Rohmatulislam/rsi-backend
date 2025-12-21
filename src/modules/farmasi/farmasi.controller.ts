import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { FarmasiService } from './farmasi.service';
import { SubmitPrescriptionDto } from './dto/submit-prescription.dto';

@Controller('farmasi')
export class FarmasiController {
    constructor(private readonly farmasiService: FarmasiService) { }

    @Get('prescription/status/:identifier')
    async getPrescriptionStatus(@Param('identifier') identifier: string) {
        return this.farmasiService.getPrescriptionStatus(identifier);
    }

    @Post('prescription/submit')
    async submitPrescription(@Body() dto: SubmitPrescriptionDto) {
        return this.farmasiService.submitPrescription(dto);
    }

    @Get('prescription/my/:userId')
    async getMyPrescriptions(@Param('userId') userId: string) {
        return this.farmasiService.getMyPrescriptions(userId);
    }
}
