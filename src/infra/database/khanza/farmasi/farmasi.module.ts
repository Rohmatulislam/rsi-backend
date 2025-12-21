import { Module } from '@nestjs/common';
import { KhanzaFarmasiService } from './farmasi.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
    providers: [KhanzaFarmasiService, KhanzaDBService],
    exports: [KhanzaFarmasiService],
})
export class KhanzaFarmasiModule { }
