/**
 * File Upload Service for Founder Images
 * Handles saving and deleting images on Supabase Storage
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../infra/supabase/supabase.service';

const BUCKET_NAME = 'founders';

@Injectable()
export class FounderUploadService {
    private readonly logger = new Logger(FounderUploadService.name);

    constructor(private readonly supabaseService: SupabaseService) {
        this.logger.log(`FounderUploadService initialized with Supabase Storage (bucket: ${BUCKET_NAME})`);
    }

    async saveFounderImage(
        base64Image: string,
        fileName: string,
        oldImagePath?: string
    ): Promise<string> {
        try {
            // Hapus gambar lama jika ada
            if (oldImagePath) {
                await this.deleteFounderImage(oldImagePath);
            }

            // Extract content type
            let contentType = 'image/jpeg';
            const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches) {
                contentType = matches[1];
            }

            // Decode base64
            const base64Data = base64Image.replace(/^data:[^;]+;base64,/, '');

            // Upload to Supabase Storage
            const publicUrl = await this.supabaseService.uploadFile(
                BUCKET_NAME,
                fileName,
                base64Data,
                contentType
            );

            this.logger.log(`Founder image uploaded to Supabase: ${fileName}`);
            return publicUrl;
        } catch (error) {
            this.logger.error('Error saving founder image', error);
            throw error;
        }
    }

    async deleteFounderImage(imagePath: string): Promise<void> {
        try {
            if (imagePath) {
                const fileName = this.supabaseService.extractFileNameFromUrl(imagePath, BUCKET_NAME);
                if (fileName) {
                    await this.supabaseService.deleteFile(BUCKET_NAME, fileName);
                    this.logger.log(`Founder image deleted from Supabase: ${fileName}`);
                }
            }
        } catch (error) {
            this.logger.error('Error deleting founder image', error);
        }
    }
}
