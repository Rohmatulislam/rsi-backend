/**
 * File Upload Service for Doctor Images
 * Handles saving and deleting image files on Supabase Storage
 * 
 * @module modules/doctor/services/file-upload.service
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../../infra/supabase/supabase.service';

// =============================================================================
// Constants
// =============================================================================

/** Maximum allowed image size in bytes (5MB) */
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Storage bucket name */
const BUCKET_NAME = 'doctors';

/** Error messages */
const ERRORS = {
  INVALID_FORMAT: 'Format gambar tidak valid. Gunakan JPG, PNG, GIF, atau WebP',
  FILE_TOO_LARGE: 'Ukuran file terlalu besar. Maksimal 5MB',
  SAVE_FAILED: 'Gagal menyimpan gambar',
  DELETE_FAILED: 'Gagal menghapus gambar',
  NO_IMAGE_DATA: 'Data gambar tidak ditemukan',
} as const;

// =============================================================================
// Service
// =============================================================================

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(private readonly supabaseService: SupabaseService) {
    this.logger.log(`FileUploadService initialized with Supabase Storage (bucket: ${BUCKET_NAME})`);
  }

  /**
   * Saves a doctor profile image to Supabase Storage
   * @param base64Image - Base64 encoded image data (with or without data URI prefix)
   * @param fileName - Desired filename for the saved image
   * @param oldImagePath - Optional path to previous image for cleanup
   * @returns Public URL of the saved image
   * @throws BadRequestException if image data is invalid
   */
  async saveDoctorImage(
    base64Image: string,
    fileName: string,
    oldImagePath?: string | null
  ): Promise<string> {
    // Validate input
    if (!base64Image) {
      throw new BadRequestException(ERRORS.NO_IMAGE_DATA);
    }

    // Extract content type from data URI
    let contentType = 'image/jpeg';
    if (base64Image.startsWith('data:')) {
      const mimeMatch = base64Image.match(/^data:([^;]+);base64,/);
      if (mimeMatch) {
        if (!ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) {
          throw new BadRequestException(ERRORS.INVALID_FORMAT);
        }
        contentType = mimeMatch[1];
      }
    }

    try {
      // Clean up old image if exists
      if (oldImagePath) {
        await this.deleteDoctorImage(oldImagePath);
      }

      // Decode base64 image
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Validate size
      if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
        throw new BadRequestException(ERRORS.FILE_TOO_LARGE);
      }

      // Upload to Supabase Storage
      const publicUrl = await this.supabaseService.uploadFile(
        BUCKET_NAME,
        fileName,
        base64Data,
        contentType
      );

      this.logger.log(`Image uploaded successfully to Supabase: ${fileName}`);
      return publicUrl;

    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to upload image: ${fileName}`, error);
      throw new BadRequestException(ERRORS.SAVE_FAILED);
    }
  }

  /**
   * Deletes a doctor image from Supabase Storage
   * @param imagePath - URL of the image to delete
   */
  async deleteDoctorImage(imagePath: string): Promise<void> {
    if (!imagePath) return;

    try {
      const fileName = this.supabaseService.extractFileNameFromUrl(imagePath, BUCKET_NAME);
      if (fileName) {
        await this.supabaseService.deleteFile(BUCKET_NAME, fileName);
        this.logger.log(`Image deleted from Supabase: ${fileName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to delete image: ${imagePath}`, error);
      // Don't throw error on delete failure - just log it
    }
  }
}