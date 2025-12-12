import { Module } from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  controllers: [AppointmentController],
  providers: [AppointmentService],
  imports: [NotificationModule],
  exports: [AppointmentService], // ← Export service untuk digunakan module lain
})
export class AppointmentModule { }
