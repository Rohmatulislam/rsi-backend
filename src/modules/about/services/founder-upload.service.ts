import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FounderUploadService {
    private readonly logger = new Logger(FounderUploadService.name);
    private readonly uploadPath: string;

    constructor() {
        this.uploadPath = join(process.cwd(), 'uploads', 'founders');
        if (!existsSync(this.uploadPath)) {
            mkdirSync(this.uploadPath, { recursive: true });
        }
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

            // Decode base64 dan simpan
            const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            const imageBuffer = matches
                ? Buffer.from(matches[2], 'base64')
                : Buffer.from(base64Image, 'base64');

            const fullImagePath = join(this.uploadPath, fileName);
            writeFileSync(fullImagePath, imageBuffer);

            return `/uploads/founders/${fileName}`;
        } catch (error) {
            this.logger.error('Error saving founder image', error);
            throw error;
        }
    }

    async deleteFounderImage(imagePath: string): Promise<void> {
        try {
            if (imagePath && imagePath.startsWith('/uploads/founders')) {
                const fullImagePath = join(process.cwd(), imagePath);
                if (existsSync(fullImagePath)) {
                    unlinkSync(fullImagePath);
                }
            }
        } catch (error) {
            this.logger.error('Error deleting founder image', error);
        }
    }
}
