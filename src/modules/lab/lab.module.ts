import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { DatabaseModule } from '../../infra/database/database.module';
import { TreatmentMetadataModule } from '../treatment-metadata/treatment-metadata.module';

@Module({
    imports: [DatabaseModule, TreatmentMetadataModule],
    controllers: [LabController],
    providers: [LabService],
    exports: [LabService],
})
export class LabModule { }
