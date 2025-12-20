import { Module } from '@nestjs/common';
import { InpatientController } from './inpatient.controller';
import { InpatientService } from './inpatient.service';
import { DatabaseModule } from '../../infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [InpatientController],
    providers: [InpatientService],
})
export class InpatientModule { }
