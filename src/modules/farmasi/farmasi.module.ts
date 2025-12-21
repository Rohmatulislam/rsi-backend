import { Module } from '@nestjs/common';
import { FarmasiService } from './farmasi.service';
import { FarmasiController } from './farmasi.controller';
import { DatabaseModule } from '../../infra/database/database.module';
import { SupabaseModule } from '../../infra/supabase/supabase.module';
import { PharmacyUploadService } from './services/pharmacy-upload.service';

@Module({
    imports: [DatabaseModule, SupabaseModule],
    controllers: [FarmasiController],
    providers: [FarmasiService, PharmacyUploadService],
})
export class FarmasiModule { }
