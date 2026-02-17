import { Module } from '@nestjs/common';
import { RatingService } from './rating.service';
import { RatingController } from './rating.controller';
import { PrismaModule } from 'src/infra/database/prisma.module';
import { RatingStatus } from '@prisma/client';
import { PrismaService } from 'src/infra/database/prisma.service';

@Module({
    imports: [PrismaModule],
    controllers: [RatingController],
    providers: [RatingService],
    exports: [RatingService],
})
export class RatingModule { }
