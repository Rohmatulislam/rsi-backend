import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PatientModule } from 'src/infra/database/khanza/patient/patient.module';

@Module({
    imports: [PatientModule],
    controllers: [UserController],
    providers: [UserService, PrismaService],
    exports: [UserService],
})
export class UserModule { }
