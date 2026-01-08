import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { PrismaModule } from '../../infra/database/prisma.module';
import { PartnerUploadService } from './services/partner-upload.service';

@Module({
    imports: [PrismaModule],
    controllers: [PartnerController],
    providers: [PartnerService, PartnerUploadService],
    exports: [PartnerService],
})
export class PartnerModule { }
