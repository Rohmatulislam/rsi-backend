import { Module } from '@nestjs/common';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [PartnerController],
    providers: [PartnerService],
    exports: [PartnerService],
})
export class PartnerModule { }
