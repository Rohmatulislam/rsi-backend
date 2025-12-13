import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AppointmentModule } from '../appointment/appointment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DoctorsModule } from './doctors/doctors.module';

@Module({
  imports: [
    AppointmentModule,
    DashboardModule,
    AppointmentsModule,
    DoctorsModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}