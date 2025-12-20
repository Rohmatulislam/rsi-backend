import { Injectable, Logger } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class InpatientService {
    private readonly logger = new Logger(InpatientService.name);

    constructor(private readonly khanzaService: KhanzaService) { }

    /**
     * Mendapatkan ketersediaan bed secara real-time
     */
    async getBedAvailability() {
        return this.khanzaService.getBedAvailability();
    }

    async getRooms() {
        return this.khanzaService.getDetailedRooms();
    }

    /**
     * Mendapatkan daftar gedung/bangsal
     */
    async getBuildings() {
        return this.khanzaService.getInpatientBuildings();
    }
}
