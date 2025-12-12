import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AppointmentModule } from '../appointment/appointment.module';

@Module({
  imports: [AppointmentModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}