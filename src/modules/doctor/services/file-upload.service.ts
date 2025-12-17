/**
 * File Upload Service for Doctor Images
 * Handles saving and deleting image files on the filesystem
 * 
 * @module modules/doctor/services/file-upload.service
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

// =============================================================================
// Constants
// =============================================================================

/** Maximum allowed image size in bytes (5MB) */
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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
  private readonly uploadPath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Initialize upload directory
    this.uploadPath = join(process.cwd(), 'uploads');
    this.ensureUploadDirectoryExists();

    // Configure base URL for serving files
    // Priority: PUBLIC_API_URL > API_URL > default
    // PUBLIC_API_URL should be the network-accessible URL (e.g., http://192.168.10.159:2000)
    const publicUrl = this.configService.get<string>('PUBLIC_API_URL');
    const apiUrl = this.configService.get<string>('API_URL') || 'http://192.168.10.159:2000';

    // Use PUBLIC_API_URL if set, otherwise use API_URL
    const resolvedUrl = publicUrl || apiUrl;

    // Remove /api suffix if present to get base URL for static files
    this.baseUrl = resolvedUrl.replace(/\/api$/, '');

    this.logger.log(`FileUploadService initialized. Base URL: ${this.baseUrl}`);
  }

  /**
   * Saves a doctor profile image from base64 data
   * @param base64Image - Base64 encoded image data (with or without data URI prefix)
   * @param fileName - Desired filename for the saved image
   * @param oldImagePath - Optional path to previous image for cleanup
   * @returns Absolute URL of the saved image
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

    // Validate image format from data URI
    if (base64Image.startsWith('data:')) {
      const mimeMatch = base64Image.match(/^data:([^;]+);base64,/);
      if (mimeMatch && !ALLOWED_IMAGE_TYPES.includes(mimeMatch[1])) {
        throw new BadRequestException(ERRORS.INVALID_FORMAT);
      }
    }

    try {
      // Clean up old image if exists
      if (oldImagePath) {
        await this.safeDeleteImage(oldImagePath);
      }

      // Decode and save image
      const imageBuffer = this.decodeBase64Image(base64Image);

      // Validate size
      if (imageBuffer.length > MAX_IMAGE_SIZE_BYTES) {
        throw new BadRequestException(ERRORS.FILE_TOO_LARGE);
      }

      const fullImagePath = join(this.uploadPath, fileName);
      writeFileSync(fullImagePath, imageBuffer);

      this.logger.log(`Image saved successfully: ${fileName}`);

      // Return absolute URL
      return `${this.baseUrl}/uploads/${fileName}`;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to save image: ${fileName}`, error);
      throw new BadRequestException(ERRORS.SAVE_FAILED);
    }
  }

  /**
   * Deletes a doctor image from the filesystem
   * @param imagePath - Path or URL of the image to delete
   */
  async deleteDoctorImage(imagePath: string): Promise<void> {
    if (!imagePath) return;

    try {
      await this.safeDeleteImage(imagePath);
      this.logger.log(`Image deleted: ${imagePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete image: ${imagePath}`, error);
      throw new BadRequestException(ERRORS.DELETE_FAILED);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Ensures the upload directory exists
   */
  private ensureUploadDirectoryExists(): void {
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadPath}`);
    }
  }

  /**
   * Safely deletes an image file if it exists
   * @param imagePath - Path or URL to the image
   */
  private async safeDeleteImage(imagePath: string): Promise<void> {
    // Handle both absolute URLs and relative paths
    const relativePath = imagePath.replace(this.baseUrl, '');
    const fullPath = join(process.cwd(), relativePath);

    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  /**
   * Decodes a base64 image string to Buffer
   * @param base64Image - Base64 string with or without data URI prefix
   * @returns Buffer containing the image data
   */
  private decodeBase64Image(base64Image: string): Buffer {
    // Remove data URI prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }
}