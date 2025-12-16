import { Module } from '@nestjs/common';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';
import { FounderUploadService } from './services/founder-upload.service';
import { PrismaModule } from '../../infra/database/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AboutController],
    providers: [AboutService, FounderUploadService],
    exports: [AboutService],
})
export class AboutModule { }
