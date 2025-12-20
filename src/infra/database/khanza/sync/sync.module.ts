import { Module } from '@nestjs/common';
import { PoliklinikService } from './poliklinik.service';
import { DokterService } from './dokter.service';
import { McuService } from './mcu.service';
import { LabService } from './lab.service';
import { RadiologiService } from './radiologi.service';
import { KhanzaDBService } from '../khanza-db.service';
import { InpatientService } from './inpatient.service';

@Module({
  providers: [DokterService, LabService, PoliklinikService, McuService, RadiologiService, InpatientService],
  exports: [DokterService, LabService, PoliklinikService, McuService, RadiologiService, InpatientService],
})
export class SyncModule { }