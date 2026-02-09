import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AccountingService } from './accounting.service';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('accounting')
@UseGuards(AdminGuard)
export class AccountingController {
    constructor(private readonly accountingService: AccountingService) { }

    @Get('journal')
    async getDailyJournal(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.accountingService.getDailyJournal(startDate, endDate);
    }

    @Get('accounts')
    async getAccounts() {
        return this.accountingService.getAccounts();
    }

    @Get('ledger')
    async getGeneralLedger(
        @Query('kd_rek') kd_rek: string,
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.accountingService.getGeneralLedger(kd_rek, startDate, endDate);
    }

    @Get('profit-loss')
    async getProfitLoss(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.accountingService.getProfitLoss(startDate, endDate);
    }

    @Get('balance-sheet')
    async getBalanceSheet(
        @Query('endDate') endDate: string,
    ) {
        return this.accountingService.getBalanceSheet(endDate);
    }
}
