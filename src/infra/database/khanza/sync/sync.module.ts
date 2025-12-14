import { Module } from '@nestjs/common';
import { PoliklinikService } from './poliklinik.service';
import { DokterService } from './dokter.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
  providers: [PoliklinikService, DokterService, KhanzaDBService],
  exports: [PoliklinikService, DokterService],
})
export class SyncModule { }