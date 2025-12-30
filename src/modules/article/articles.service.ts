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
        const { categoryIds, ...articleData } = createArticleDto;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `article-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveArticleImage(imagePath, fileName);
        }

        return this.prisma.article.create({
            data: {
                ...articleData,
                image: imagePath,
                categories: categoryIds ? {
                    connect: categoryIds.map(id => ({ id }))
                } : undefined
            },
            include: { categories: true }
        });
    }

    async findAll() {
        return this.prisma.article.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: { categories: true }
        });
    }

    async findOne(slug: string) {
        const article = await this.prisma.article.findUnique({
            where: { slug },
            include: { categories: true }
        });
        if (!article) throw new NotFoundException(`Article with slug ${slug} not found`);
        return article;
    }

    async update(slug: string, updateArticleDto: UpdateArticleDto) {
        const existing = await this.prisma.article.findUnique({
            where: { slug },
            include: { categories: true }
        });
        if (!existing) throw new NotFoundException(`Article with slug ${slug} not found`);

        let imagePath = updateArticleDto.image;
        const { categoryIds, ...articleData } = updateArticleDto;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `article-${existing.id}-${Date.now()}.${ext}`;
            imagePath = await this.fileUploadService.saveArticleImage(
                imagePath,
                fileName,
                existing.image || undefined
            );
        }

        const dataToUpdate: any = { ...articleData };
        if (imagePath) {
            dataToUpdate.image = imagePath;
        }

        if (categoryIds) {
            dataToUpdate.categories = {
                set: categoryIds.map(id => ({ id }))
            };
        }

        return this.prisma.article.update({
            where: { slug },
            data: dataToUpdate,
            include: { categories: true }
        });
    }

    async getRelated(slug: string, limit: number = 3) {
        const article = await this.prisma.article.findUnique({
            where: { slug },
            include: { categories: true }
        });

        if (!article) throw new NotFoundException(`Article with slug ${slug} not found`);

        const categoryIds = article.categories.map(c => c.id);

        return this.prisma.article.findMany({
            where: {
                slug: { not: slug },
                isActive: true,
                status: 'PUBLISHED',
                categories: {
                    some: {
                        id: { in: categoryIds }
                    }
                }
            },
            take: limit,
            orderBy: {
                publishedAt: 'desc'
            },
            include: {
                categories: true
            }
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
