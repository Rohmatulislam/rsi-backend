import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
  providers: [ValidationService, KhanzaDBService],
  exports: [ValidationService],
})
export class ValidationModule { }