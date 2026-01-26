import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { FarmasiService } from './farmasi.service';
import { SubmitPrescriptionDto } from './dto/submit-prescription.dto';
import { PharmacyGateway } from './pharmacy.gateway';

@Controller('farmasi')
export class FarmasiController {
    constructor(
        private readonly farmasiService: FarmasiService,
        private readonly pharmacyGateway: PharmacyGateway
    ) { }

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

    @Get('search')
    async searchMedicines(@Query('q') query: string) {
        return this.farmasiService.searchMedicines(query);
    }

    @Get('categories')
    async getCategories() {
        return this.farmasiService.getCategories();
    }

    @Get('items/:category')
    async getItemsByCategory(@Param('category') category: string) {
        return this.farmasiService.getItemsByCategory(category);
    }
}
