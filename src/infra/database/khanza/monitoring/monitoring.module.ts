import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
  providers: [MonitoringService, KhanzaDBService],
  exports: [MonitoringService],
})
export class MonitoringModule { }