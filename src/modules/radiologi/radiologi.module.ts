import { Module } from '@nestjs/common';
import { RadiologiController } from './radiologi.controller';
import { RadiologiService } from './radiologi.service';
import { DatabaseModule } from '../../infra/database/database.module';
import { TreatmentMetadataModule } from '../treatment-metadata/treatment-metadata.module';

@Module({
    imports: [DatabaseModule, TreatmentMetadataModule],
    controllers: [RadiologiController],
    providers: [RadiologiService],
    exports: [RadiologiService],
})
export class RadiologiModule { }
