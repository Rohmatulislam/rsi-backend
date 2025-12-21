import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { KhanzaService } from './khanza.service';
import { KhanzaDBService } from './khanza/khanza-db.service';
import { BookingModule } from './khanza/booking/booking.module';
import { PatientModule } from './khanza/patient/patient.module';
import { SyncModule } from './khanza/sync/sync.module';
import { ValidationModule } from './khanza/validation/validation.module';
import { MonitoringModule } from './khanza/monitoring/monitoring.module';
import { KhanzaFarmasiModule } from './khanza/farmasi/farmasi.module';
import { KhanzaRehabilitationModule } from './khanza/rehabilitation/rehabilitation.module';

@Global()
@Module({
  imports: [
    BookingModule,
    PatientModule,
    SyncModule,
    ValidationModule,
    MonitoringModule,
    KhanzaFarmasiModule,
    KhanzaRehabilitationModule,
  ],
  providers: [PrismaService, KhanzaDBService, KhanzaService],
  exports: [
    PrismaService,
    KhanzaDBService,
    KhanzaService,
    BookingModule,
    PatientModule,
    SyncModule,
    ValidationModule,
    MonitoringModule,
    KhanzaFarmasiModule,
    KhanzaRehabilitationModule,
  ],
})
export class DatabaseModule { }
