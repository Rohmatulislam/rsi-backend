import { Module } from '@nestjs/common';
import { DiagnosticBookingService } from './diagnostic-booking.service';
import { DiagnosticBookingController } from './diagnostic-booking.controller';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [DiagnosticBookingController],
    providers: [DiagnosticBookingService],
    exports: [DiagnosticBookingService]
})
export class DiagnosticBookingModule { }
