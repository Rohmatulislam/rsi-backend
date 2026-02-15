import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../infra/database/prisma.service';

@Module({
    imports: [ConfigModule],
    providers: [PaymentService, PrismaService],
    controllers: [PaymentController],
    exports: [PaymentService],
})
export class PaymentModule { }
