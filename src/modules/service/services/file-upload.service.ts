import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FileUploadService {
    private readonly logger = new Logger(FileUploadService.name);
    private readonly uploadPath: string;
    private readonly baseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.uploadPath = join(process.cwd(), 'uploads');
        this.ensureUploadDirectoryExists();

        const publicUrl = this.configService.get<string>('PUBLIC_API_URL');
        const apiUrl = this.configService.get<string>('API_URL') || 'http://localhost:2000';
        const resolvedUrl = publicUrl || apiUrl;
        this.baseUrl = resolvedUrl.replace(/\/api$/, '');
    }

    async saveServiceImage(
        base64Image: string,
        fileName: string,
        oldImagePath?: string | null
    ): Promise<string> {
        if (!base64Image) return '';

        try {
            if (oldImagePath) {
                await this.deleteImage(oldImagePath);
            }

            const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const fullImagePath = join(this.uploadPath, fileName);

            writeFileSync(fullImagePath, imageBuffer);
            return `${this.baseUrl}/uploads/${fileName}`;
        } catch (error) {
            this.logger.error(`Failed to save service image: ${fileName}`, error);
            throw new BadRequestException('Gagal menyimpan gambar');
        }
    }

    async deleteImage(imagePath: string): Promise<void> {
        if (!imagePath) return;
        try {
            const relativePath = imagePath.replace(this.baseUrl, '');
            const fullPath = join(process.cwd(), relativePath);
            if (existsSync(fullPath)) {
                unlinkSync(fullPath);
            }
        } catch (error) {
            this.logger.error(`Failed to delete image: ${imagePath}`, error);
        }
    }

    private ensureUploadDirectoryExists(): void {
        if (!existsSync(this.uploadPath)) {
            mkdirSync(this.uploadPath, { recursive: true });
        }
    }
}
