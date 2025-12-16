import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ArticleService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller('articles')
export class ArticleController {
    constructor(private readonly articleService: ArticleService) { }

    @Post()
    create(@Body() createArticleDto: CreateArticleDto) {
        return this.articleService.create(createArticleDto);
    }

    @Get()
    @AllowAnonymous()
    findAll() {
        return this.articleService.findAll();
    }

    @Get(':slug')
    @AllowAnonymous()
    findOne(@Param('slug') slug: string) {
        return this.articleService.findOne(slug);
    }

    @Patch(':slug')
    update(@Param('slug') slug: string, @Body() updateArticleDto: UpdateArticleDto) {
        return this.articleService.update(slug, updateArticleDto);
    }

    @Delete(':slug')
    remove(@Param('slug') slug: string) {
        return this.articleService.remove(slug);
    }
}
