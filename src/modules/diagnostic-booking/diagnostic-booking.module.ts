import { Module } from '@nestjs/common';
import { DiagnosticBookingService } from './diagnostic-booking.service';
import { DiagnosticBookingController } from './diagnostic-booking.controller';
import { DatabaseModule } from '../../infra/database/database.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
    imports: [DatabaseModule, PaymentModule],
    controllers: [DiagnosticBookingController],
    providers: [DiagnosticBookingService],
    exports: [DiagnosticBookingService]
})
export class DiagnosticBookingModule { }
