import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../infra/supabase/supabase.service';

const BUCKET_NAME = 'prescriptions';

@Injectable()
export class PharmacyUploadService {
    private readonly logger = new Logger(PharmacyUploadService.name);

    constructor(private readonly supabaseService: SupabaseService) {
        this.logger.log(`PharmacyUploadService initialized with Supabase Storage (bucket: ${BUCKET_NAME})`);
    }

    async savePrescriptionImage(
        base64Image: string,
        fileName: string
    ): Promise<string> {
        if (!base64Image) return '';

        try {
            // Extract content type
            let contentType = 'image/jpeg';
            if (base64Image.startsWith('data:')) {
                const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,/);
                if (matches) {
                    contentType = matches[1];
                }
            }

            // Decode base64
            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

            // Upload to Supabase Storage
            const publicUrl = await this.supabaseService.uploadFile(
                BUCKET_NAME,
                fileName,
                base64Data,
                contentType
            );

            this.logger.log(`Prescription image uploaded to Supabase: ${fileName}`);
            return publicUrl;
        } catch (error) {
            this.logger.error(`Failed to save prescription image: ${fileName}`, error);
            throw new BadRequestException('Gagal menyimpan gambar resep');
        }
    }
}
