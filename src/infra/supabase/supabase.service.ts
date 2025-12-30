import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
    private readonly logger = new Logger(SupabaseService.name);
    private readonly supabase: SupabaseClient;
    private readonly supabaseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
        const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_KEY') || '';

        if (!this.supabaseUrl || !supabaseKey) {
            this.logger.warn('Supabase credentials not configured. File uploads will fail.');
            // @ts-ignore
            this.supabase = null;
        } else {
            this.supabase = createClient(this.supabaseUrl, supabaseKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            });
        }
    }

    /**
     * Upload file ke Supabase Storage
     * @param bucket - Nama bucket (doctors, founders, articles, services)
     * @param fileName - Nama file
     * @param base64Data - Data file dalam format base64
     * @param contentType - MIME type (image/jpeg, image/png, dll)
     * @returns URL publik file yang diupload
     */
    async uploadFile(
        bucket: string,
        fileName: string,
        base64Data: string,
        contentType: string = 'image/jpeg'
    ): Promise<string> {
        try {
            // Convert base64 ke buffer
            const buffer = Buffer.from(base64Data, 'base64');

            // Upload ke Supabase Storage
            const { data, error } = await this.supabase.storage
                .from(bucket)
                .upload(fileName, buffer, {
                    contentType,
                    upsert: true // Overwrite jika file sudah ada
                });

            if (error) {
                this.logger.error(`Failed to upload to Supabase: ${error.message}`);
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from(bucket)
                .getPublicUrl(fileName);

            this.logger.log(`File uploaded successfully: ${urlData.publicUrl}`);
            return urlData.publicUrl;

        } catch (error) {
            this.logger.error(`Upload error: ${error}`);
            throw error;
        }
    }

    /**
     * Hapus file dari Supabase Storage
     * @param bucket - Nama bucket
     * @param filePath - Path file di bucket
     */
    async deleteFile(bucket: string, filePath: string): Promise<void> {
        try {
            const { error } = await this.supabase.storage
                .from(bucket)
                .remove([filePath]);

            if (error) {
                this.logger.error(`Failed to delete from Supabase: ${error.message}`);
            }
        } catch (error) {
            this.logger.error(`Delete error: ${error}`);
        }
    }

    /**
     * Extract filename dari URL Supabase
     * @param url - URL lengkap Supabase Storage
     * @param bucket - Nama bucket
     * @returns Filename saja
     */
    extractFileNameFromUrl(url: string, bucket: string): string | null {
        if (!url || !url.includes(this.supabaseUrl)) return null;

        const pattern = new RegExp(`/storage/v1/object/public/${bucket}/(.+)$`);
        const match = url.match(pattern);
        return match ? match[1] : null;
    }

    get client(): SupabaseClient {
        return this.supabase;
    }
}
