import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { SupabaseModule } from '../../infra/supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [UploadController],
})
export class UploadModule { }
