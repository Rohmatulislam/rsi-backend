import { Module } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
  controllers: [DoctorController],
  providers: [DoctorService],
  imports: [PrismaModule],
})
export class DoctorModule {}
