import { Module } from '@nestjs/common';
import { RadiologiController } from './radiologi.controller';
import { RadiologiService } from './radiologi.service';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [RadiologiController],
    providers: [RadiologiService],
    exports: [RadiologiService],
})
export class RadiologiModule { }
