import { Module } from '@nestjs/common';
import { LabController } from './lab.controller';
import { LabService } from './lab.service';
import { PatientLabService } from './patient-lab.service';
import { DatabaseModule } from '../../infra/database/database.module';
import { TreatmentMetadataModule } from '../treatment-metadata/treatment-metadata.module';
import { PdfModule } from '../pdf/pdf.module';
import { PatientModule } from '../../infra/database/khanza/patient/patient.module';

@Module({
    imports: [DatabaseModule, TreatmentMetadataModule, PdfModule, PatientModule],
    controllers: [LabController],
    providers: [LabService, PatientLabService],
    exports: [LabService, PatientLabService],
})
export class LabModule { }
