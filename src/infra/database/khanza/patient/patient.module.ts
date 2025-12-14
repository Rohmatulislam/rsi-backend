import { Module } from '@nestjs/common';
import { PatientService } from './patient.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
  providers: [PatientService, KhanzaDBService],
  exports: [PatientService],
})
export class PatientModule { }