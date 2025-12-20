import { Module } from '@nestjs/common';
import { ServiceService } from './service.service';
import { ServiceController } from './service.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { FileUploadService } from './services/file-upload.service';

@Module({
    imports: [PrismaModule],
    controllers: [ServiceController],
    providers: [ServiceService, FileUploadService],
    exports: [ServiceService],
})
export class ServiceModule { }
