import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { BudgetService } from './budget.service';
import { DatabaseModule } from 'src/infra/database/database.module';

@Module({
    imports: [DatabaseModule],
    controllers: [FinanceController],
    providers: [FinanceService, BudgetService],
    exports: [FinanceService, BudgetService],
})
export class FinanceModule { }
