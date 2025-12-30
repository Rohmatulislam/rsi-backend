import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AppointmentModule } from '../appointment/appointment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AdminUsersModule } from './users/admin-users.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    AppointmentModule,
    DashboardModule,
    AppointmentsModule,
    DoctorsModule,
    AdminUsersModule,
    AuditModule,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule { }