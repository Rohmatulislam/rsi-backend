import { Module } from '@nestjs/common';
import { RehabilitationService } from './rehabilitation.service';
import { RehabilitationController } from './rehabilitation.controller';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [RehabilitationController],
    providers: [RehabilitationService],
})
export class RehabilitationModule { }
