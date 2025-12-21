import { Module } from '@nestjs/common';
import { KhanzaRehabilitationService } from './rehabilitation.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
    providers: [KhanzaRehabilitationService, KhanzaDBService],
    exports: [KhanzaRehabilitationService],
})
export class KhanzaRehabilitationModule { }
