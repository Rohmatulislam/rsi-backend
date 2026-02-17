import { Controller, Get, Post, Patch, Param, Body, Logger, Delete, UseGuards } from '@nestjs/common';
import { InpatientService } from './inpatient.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('inpatient')
@UseGuards(JwtAuthGuard)
export class InpatientController {
    private readonly logger = new Logger(InpatientController.name);

    constructor(private readonly inpatientService: InpatientService) { }

    // ============ BED & ROOM (from SIMRS Khanza) ============

    @Get('bed-availability')
    @AllowAnonymous()
    async getBedAvailability() {
        return this.inpatientService.getBedAvailability();
    }

    @Get('rooms')
    @AllowAnonymous()
    async getRooms() {
        return this.inpatientService.getRooms();
    }

    // ============ BUILDINGS (local database with override) ============

    @Get('buildings')
    @AllowAnonymous()
    async getUnits() {
        return this.inpatientService.findAllUnits();
    }

    @Get('buildings/active')
    @AllowAnonymous()
    async getActiveUnits() {
        return this.inpatientService.findActiveUnits();
    }

    @Get('buildings/:id')
    @AllowAnonymous()
    async getUnit(@Param('id') id: string) {
        return this.inpatientService.findOneUnit(id);
    }

    @Post('buildings/sync')
    @UseGuards(AdminGuard)
    async syncUnits() {
        return this.inpatientService.syncUnitsFromKhanza();
    }

    @Patch('buildings/reorder/bulk')
    @UseGuards(AdminGuard)
    async reorderUnits(@Body() orders: { id: string; order: number }[]) {
        return this.inpatientService.reorderUnits(orders);
    }

    @Patch('buildings/:id')
    @UseGuards(AdminGuard)
    async updateUnit(
        @Param('id') id: string,
        @Body() data: { name?: string; description?: string; imageUrl?: string; order?: number; isActive?: boolean }
    ) {
        return this.inpatientService.updateUnit(id, data);
    }

    // ============ BED EXCLUSIONS ============

    @Get('beds/exclude')
    @UseGuards(AdminGuard)
    async getExcludedBeds() {
        return this.inpatientService.getExcludedBeds();
    }

    @Post('beds/exclude')
    @UseGuards(AdminGuard)
    async excludeBed(@Body() data: { id: string; reason?: string }) {
        return this.inpatientService.excludeBed(data);
    }

    @Delete('beds/exclude/:id')
    @UseGuards(AdminGuard)
    async unexcludeBed(@Param('id') id: string) {
        return this.inpatientService.unexcludeBed(id);
    }
}
