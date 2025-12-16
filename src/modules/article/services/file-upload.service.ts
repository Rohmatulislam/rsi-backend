import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FileUploadService {
    private readonly logger = new Logger(FileUploadService.name);
    private readonly uploadPath: string;

    constructor(private configService: ConfigService) {
        this.uploadPath = join(process.cwd(), 'uploads', 'articles');
        // Buat folder uploads/articles jika belum ada
        if (!existsSync(this.uploadPath)) {
            mkdirSync(this.uploadPath, { recursive: true });
        }
    }

    async saveArticleImage(
        base64Image: string,
        fileName: string,
        oldImagePath?: string
    ): Promise<string> {
        try {
            // Hapus gambar lama jika ada
            if (oldImagePath) {
                // Handle case where oldImagePath includes '/uploads/articles/' or just filename
                // Database usually stores '/uploads/articles/filename.jpg'
                // fullImagePath needs process.cwd() + oldImagePath (if starts with /)
                const oldImagePathFull = join(process.cwd(), oldImagePath);
                if (existsSync(oldImagePathFull)) {
                    unlinkSync(oldImagePathFull);
                }
            }

            // Decode base64 dan simpan
            // Handle data URI prefix
            const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            // If valid base64 with prefix
            const imageBuffer = matches
                ? Buffer.from(matches[2], 'base64')
                : Buffer.from(base64Image, 'base64');

            // Tentukan full path
            const fullImagePath = join(this.uploadPath, fileName);

            // Simpan file
            writeFileSync(fullImagePath, imageBuffer);

            // Kembalikan path relatif untuk disimpan di database
            return `/uploads/articles/${fileName}`;
        } catch (error) {
            this.logger.error('Error saving article image', error);
            throw error;
        }
    }

    async deleteArticleImage(imagePath: string): Promise<void> {
        try {
            if (imagePath) {
                const fullImagePath = join(process.cwd(), imagePath);
                if (existsSync(fullImagePath)) {
                    unlinkSync(fullImagePath);
                }
            }
        } catch (error) {
            this.logger.error('Error deleting article image', error);
            // Non-blocking error
        }
    }
}
