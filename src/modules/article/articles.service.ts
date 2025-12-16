import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { PrismaService } from '../../infra/database/prisma.service';
import { FileUploadService } from './services/file-upload.service';

@Injectable()
export class ArticleService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly fileUploadService: FileUploadService
    ) { }

    async create(createArticleDto: CreateArticleDto) {
        let imagePath = createArticleDto.image;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `article-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveArticleImage(imagePath, fileName);
        }

        return this.prisma.article.create({
            data: {
                ...createArticleDto,
                image: imagePath
            },
        });
    }

    async findAll() {
        return this.prisma.article.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(slug: string) {
        const article = await this.prisma.article.findUnique({
            where: { slug },
        });
        if (!article) throw new NotFoundException(`Article with slug ${slug} not found`);
        return article;
    }

    async update(slug: string, updateArticleDto: UpdateArticleDto) {
        const existing = await this.prisma.article.findUnique({ where: { slug } });
        if (!existing) throw new NotFoundException(`Article with slug ${slug} not found`);

        let imagePath = updateArticleDto.image;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            // Use ID if available, or timestamp
            const fileName = `article-${existing.id}-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveArticleImage(
                imagePath,
                fileName,
                existing.image || undefined
            );
        }

        // Handle case where we only update part of DTO, preserving existing image if param is undefined
        const dataToUpdate = { ...updateArticleDto };
        if (imagePath) {
            dataToUpdate.image = imagePath;
        }

        return this.prisma.article.update({
            where: { slug },
            data: dataToUpdate,
        });
    }

    async remove(slug: string) {
        const existing = await this.prisma.article.findUnique({ where: { slug } });
        if (existing && existing.image && existing.image.startsWith('/uploads')) {
            await this.fileUploadService.deleteArticleImage(existing.image);
        }
        return this.prisma.article.delete({ where: { slug } });
    }
}
