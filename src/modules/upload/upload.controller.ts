import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseService } from '../../infra/supabase/supabase.service';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('upload')
export class UploadController {
    constructor(private readonly supabaseService: SupabaseService) { }

    @Post()
    @AllowAnonymous()
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        // Validate file type
        if (!file.mimetype.startsWith('image/')) {
            throw new BadRequestException('File must be an image');
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            throw new BadRequestException('File size must be less than 5MB');
        }

        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExt = file.originalname.split('.').pop();
        const fileName = `banner-${timestamp}-${randomString}.${fileExt}`;

        // Convert buffer to base64
        const base64Data = file.buffer.toString('base64');

        // Upload to Supabase
        const url = await this.supabaseService.uploadFile(
            'banners',
            fileName,
            base64Data,
            file.mimetype,
        );

        return {
            url,
            filename: fileName,
        };
    }
}
