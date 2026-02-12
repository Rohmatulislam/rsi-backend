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
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '50',
    ) {
        return this.accountingService.getDailyJournal(startDate, endDate, Number(page), Number(limit));
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

    @Get('cash-flow')
    async getCashFlowStatement(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
    ) {
        return this.accountingService.getCashFlowStatement(startDate, endDate);
    }

    @Get('opening-equity')
    async getOpeningEquity(
        @Query('startDate') startDate: string,
    ) {
        return this.accountingService.getOpeningEquity(startDate);
    }
}
