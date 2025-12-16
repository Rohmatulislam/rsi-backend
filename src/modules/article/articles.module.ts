import { Module } from '@nestjs/common';
import { ArticleService } from './articles.service';
import { ArticleController } from './articles.controller';
import { DatabaseModule } from '../../infra/database/database.module';
import { FileUploadService } from './services/file-upload.service';

@Module({
    imports: [DatabaseModule],
    controllers: [ArticleController],
    providers: [ArticleService, FileUploadService],
})
export class ArticleModule { }
