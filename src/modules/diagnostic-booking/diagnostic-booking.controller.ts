import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { DiagnosticBookingService } from './diagnostic-booking.service';

@Controller('diagnostic')
export class DiagnosticBookingController {
    constructor(private readonly service: DiagnosticBookingService) { }

    @Post('booking')
    async createBooking(@Body() data: any) {
        try {
            return await this.service.createBooking(data);
        } catch (error: any) {
            throw new BadRequestException(error.message);
        }
    }
}
