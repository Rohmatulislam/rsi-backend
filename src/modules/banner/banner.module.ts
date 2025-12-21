import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { BannerController } from './banner.controller';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [BannerController],
    providers: [BannerService],
    exports: [BannerService],
})
export class BannerModule { }
