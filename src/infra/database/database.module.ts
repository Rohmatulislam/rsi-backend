import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { KhanzaService } from './khanza.service';

@Global()
@Module({
  providers: [PrismaService, KhanzaService],
  exports: [PrismaService, KhanzaService],
})
export class DatabaseModule {}
