import { Controller, Post, Body, BadRequestException, Get, Param, UseGuards } from '@nestjs/common';
import { DiagnosticBookingService } from './diagnostic-booking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('diagnostic')
@UseGuards(JwtAuthGuard)
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

    @Get('orders')
    @UseGuards(AdminGuard)
    async getOrders() {
        return this.service.findAllOrders();
    }

    @Get('orders/:id')
    @UseGuards(AdminGuard)
    async getOrder(@Param('id') id: string) {
        return this.service.findOrderById(id);
    }

    @Post('orders/:id/payment')
    async createPaymentToken(@Param('id') id: string) {
        try {
            return await this.service.createPaymentToken(id);
        } catch (error: any) {
            throw new BadRequestException(error.message);
        }
    }
}
