import { Module } from '@nestjs/common';
import { McuController } from './mcu.controller';
import { McuApiService } from './mcu.service';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [McuController],
    providers: [McuApiService],
    exports: [McuApiService],
})
export class McuModule { }
