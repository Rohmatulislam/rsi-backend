import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadPath: string;

  constructor(private configService: ConfigService) {
    this.uploadPath = join(process.cwd(), 'uploads');
    // Buat folder uploads jika belum ada
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async saveDoctorImage(
    base64Image: string, 
    fileName: string, 
    oldImagePath?: string
  ): Promise<string> {
    try {
      // Hapus gambar lama jika ada
      if (oldImagePath) {
        const oldImagePathFull = join(process.cwd(), oldImagePath);
        if (existsSync(oldImagePathFull)) {
          unlinkSync(oldImagePathFull);
        }
      }

      // Decode base64 dan simpan
      const imageBuffer = Buffer.from(base64Image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      
      // Tentukan full path
      const fullImagePath = join(this.uploadPath, fileName);
      
      // Simpan file
      writeFileSync(fullImagePath, imageBuffer);
      
      // Kembalikan path relatif untuk disimpan di database
      return `/uploads/${fileName}`;
    } catch (error) {
      this.logger.error('Error saving doctor image', error);
      throw error;
    }
  }

  // Hapus gambar dari filesystem
  async deleteDoctorImage(imagePath: string): Promise<void> {
    try {
      if (imagePath) {
        const fullImagePath = join(process.cwd(), imagePath);
        if (existsSync(fullImagePath)) {
          unlinkSync(fullImagePath);
        }
      }
    } catch (error) {
      this.logger.error('Error deleting doctor image', error);
      throw error;
    }
  }
}