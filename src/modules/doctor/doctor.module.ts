import { Module } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { FileUploadService } from './services/file-upload.service';

@Module({
  controllers: [DoctorController],
  providers: [DoctorService, FileUploadService],
  imports: [PrismaModule],
  exports: [DoctorService, FileUploadService],
})
export class DoctorModule {}
