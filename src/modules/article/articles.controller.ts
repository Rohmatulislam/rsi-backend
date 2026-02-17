import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Logger, Req, BadRequestException, Query } from '@nestjs/common';
import { ArticleService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Request } from 'express';

@Controller('articles')
export class ArticleController {
    private readonly logger = new Logger(ArticleController.name);

    constructor(private readonly articleService: ArticleService) { }

    @Post()
    @UseGuards(AdminGuard)
    create(@Body() createArticleDto: CreateArticleDto) {
        return this.articleService.create(createArticleDto);
    }

    @Get(['', '/'])
    @AllowAnonymous()
    findAll(@Req() req: Request, @Query('search') search?: string) {
        return this.articleService.findAll(search);
    }

    @Get(':slug')
    @AllowAnonymous()
    findOne(@Param('slug') slug: string, @Req() req: Request) {
        this.logger.log(`GET articles/:slug - Slug: [${slug}], Method: ${req.method}, URL: ${req.url}`);

        // Handle trailing slash that might come in as empty slug or literal slash
        if (!slug || slug.trim() === '' || slug === '/' || slug === 'undefined' || slug === 'null') {
            this.logger.log(`Empty/Invalid slug detected, falling back to findAll`);
            return this.articleService.findAll();
        }
        return this.articleService.findOne(slug);
    }

    @Get(':slug/related')
    @AllowAnonymous()
    getRelated(@Param('slug') slug: string) {
        return this.articleService.getRelated(slug);
    }

    @Patch(':slug')
    @UseGuards(AdminGuard)
    update(@Param('slug') slug: string, @Body() updateArticleDto: UpdateArticleDto) {
        return this.articleService.update(slug, updateArticleDto);
    }

    @Patch(['', '/'])
    @UseGuards(AdminGuard)
    updateRoot(@Body() updateArticleDto: UpdateArticleDto) {
        this.logger.warn(`PATCH /articles called without slug. Body: ${JSON.stringify(updateArticleDto)}`);
        // Try to recover if slug is in body
        if (updateArticleDto.slug) {
            this.logger.log(`Recovering slug from body: ${updateArticleDto.slug}`);
            // Note: This only works if slug is NOT being changed. 
            // If slug is changing, this will fail with 404 because we are looking up by NEW slug.
            return this.articleService.update(updateArticleDto.slug, updateArticleDto);
        }
        throw new BadRequestException('Article slug is required for update');
    }

    @Delete(['', '/'])
    @UseGuards(AdminGuard)
    removeRoot() {
        this.logger.warn(`DELETE /articles called without slug. Cleaning up article with empty slug.`);
        return this.articleService.remove("");
    }

    @Delete(':slug')
    @UseGuards(AdminGuard)
    remove(@Param('slug') slug: string) {
        return this.articleService.remove(slug);
    }
}
