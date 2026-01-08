/**
 * Partner Upload Service
 * Handles saving and deleting partner logos on Supabase Storage
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../infra/supabase/supabase.service';

const BUCKET_NAME = 'partners';

@Injectable()
export class PartnerUploadService {
    private readonly logger = new Logger(PartnerUploadService.name);

    constructor(private readonly supabaseService: SupabaseService) {
        this.logger.log(`PartnerUploadService initialized with Supabase Storage (bucket: ${BUCKET_NAME})`);
    }

    async savePartnerImage(
        base64Image: string,
        fileName: string,
        oldImagePath?: string | null
    ): Promise<string> {
        if (!base64Image) return '';

        try {
            if (oldImagePath) {
                await this.deleteImage(oldImagePath);
            }

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

            this.logger.log(`Partner image uploaded to Supabase: ${fileName}`);
            return publicUrl;
        } catch (error) {
            this.logger.error(`Failed to save partner image: ${fileName}`, error);
            throw new BadRequestException('Gagal menyimpan logo mitra');
        }
    }

    async deleteImage(imagePath: string): Promise<void> {
        if (!imagePath) return;
        try {
            const fileName = this.supabaseService.extractFileNameFromUrl(imagePath, BUCKET_NAME);
            if (fileName) {
                await this.supabaseService.deleteFile(BUCKET_NAME, fileName);
                this.logger.log(`Partner image deleted from Supabase: ${fileName}`);
            }
        } catch (error) {
            this.logger.error(`Failed to delete partner image: ${imagePath}`, error);
        }
    }
}
