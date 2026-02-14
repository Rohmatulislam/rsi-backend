import { Module } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { NotificationModule } from '../notification/notification.module';
import { AppointmentSyncService } from './appointment-sync.service';

@Module({
  controllers: [AppointmentController],
  providers: [AppointmentService, AppointmentSyncService],
  imports: [NotificationModule],
  exports: [AppointmentService, AppointmentSyncService], // ← Export service untuk digunakan module lain
})
export class AppointmentModule { }
