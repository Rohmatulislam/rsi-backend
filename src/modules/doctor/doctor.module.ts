import { Module } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { FileUploadService } from './services/file-upload.service';
import { NotificationModule } from '../notification/notification.module';
import { AppointmentModule } from '../appointment/appointment.module';
import { DoctorScheduleExceptionService } from './services/doctor-schedule-exception.service';

@Module({
  controllers: [DoctorController],
  providers: [DoctorService, FileUploadService, DoctorScheduleExceptionService],
  imports: [PrismaModule, NotificationModule, AppointmentModule],
  exports: [DoctorService, FileUploadService, DoctorScheduleExceptionService],
})
export class DoctorModule { }
