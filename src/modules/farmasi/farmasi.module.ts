import { Module } from '@nestjs/common';
import { FarmasiService } from './farmasi.service';
import { FarmasiController } from './farmasi.controller';
import { DatabaseModule } from '../../infra/database/database.module';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { PharmacyUploadService } from './services/pharmacy-upload.service';
import { PharmacyGateway } from './pharmacy.gateway';
import { PharmacyQueueJob } from './jobs/pharmacy-queue.job';

@Module({
    imports: [DatabaseModule, SupabaseModule],
    controllers: [FarmasiController],
    providers: [
        FarmasiService,
        PharmacyUploadService,
        PharmacyGateway,
        PharmacyQueueJob
    ],
})
export class FarmasiModule { }
