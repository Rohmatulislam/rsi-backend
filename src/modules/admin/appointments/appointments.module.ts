import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AdminService } from '../admin.service';
import { AppointmentModule } from '../../appointment/appointment.module';

@Module({
  imports: [AppointmentModule],
  controllers: [AppointmentsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AppointmentsModule {}