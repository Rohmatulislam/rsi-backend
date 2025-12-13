import { Module } from '@nestjs/common';
import { DoctorsController } from './doctors.controller';
import { DoctorModule } from '../../doctor/doctor.module';

@Module({
  imports: [DoctorModule],
  controllers: [DoctorsController],
})
export class DoctorsModule {}