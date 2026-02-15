import { Module } from '@nestjs/common';
import { TreatmentMetadataService } from './treatment-metadata.service';
import { TreatmentMetadataController } from './treatment-metadata.controller';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [TreatmentMetadataController],
    providers: [TreatmentMetadataService],
    exports: [TreatmentMetadataService]
})
export class TreatmentMetadataModule { }
