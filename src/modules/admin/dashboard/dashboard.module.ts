import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { AdminService } from '../admin.service';
import { AppointmentModule } from '../../appointment/appointment.module';

@Module({
  imports: [AppointmentModule],
  controllers: [DashboardController],
  providers: [AdminService],
  exports: [AdminService],
})
export class DashboardModule {}