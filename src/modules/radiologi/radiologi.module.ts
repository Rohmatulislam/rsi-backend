import { Module } from '@nestjs/common';
import { RadiologiController } from './radiologi.controller';
import { RadiologiService } from './radiologi.service';
import { PatientRadiologyService } from './patient-radiology.service';
import { DatabaseModule } from '../../infra/database/database.module';
import { TreatmentMetadataModule } from '../treatment-metadata/treatment-metadata.module';
import { PdfModule } from '../pdf/pdf.module';

@Module({
    imports: [DatabaseModule, TreatmentMetadataModule, PdfModule],
    controllers: [RadiologiController],
    providers: [RadiologiService, PatientRadiologyService],
    exports: [RadiologiService, PatientRadiologyService],
})
export class RadiologiModule { }
