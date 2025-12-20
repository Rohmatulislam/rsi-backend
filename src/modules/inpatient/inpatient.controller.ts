import { Controller, Get, Logger } from '@nestjs/common';
import { InpatientService } from './inpatient.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('inpatient')
export class InpatientController {
    private readonly logger = new Logger(InpatientController.name);

    constructor(private readonly inpatientService: InpatientService) { }

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

    @Get('buildings')
    @AllowAnonymous()
    async getBuildings() {
        return this.inpatientService.getBuildings();
    }
}
