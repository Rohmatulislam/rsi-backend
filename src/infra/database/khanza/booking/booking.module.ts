import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { KhanzaDBService } from '../khanza-db.service';

@Module({
  providers: [BookingService, KhanzaDBService],
  exports: [BookingService],
})
export class BookingModule { }