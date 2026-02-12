import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';

import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('finance-stats')
@UseGuards(AdminGuard)
export class FinanceController {
    private readonly logger = new Logger(FinanceController.name);
    constructor(private readonly financeService: FinanceService) { }

    @Get('drug-profit')
    async getDrugProfitReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/drug-profit ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getDrugProfitReport(period, date, startDate, endDate);
    }

    @Get('payment-method')
    async getPaymentMethodReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/payment-method ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getPaymentMethodReport(period, date, startDate, endDate);
    }

    @Get('summary')
    async getFinancialSummary(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/summary ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getFinancialSummary(period, date, startDate, endDate);
    }

    @Get('trends')
    async getFinancialTrends() {
        this.logger.log('GET /finance-stats/trends');
        return this.financeService.getFinancialTrends();
    }

    @Get('expenses')
    async getExpenseSummary(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/expenses ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getExpenseSummary(period, date, startDate, endDate);
    }

    @Get('period-comparison')
    async getPeriodComparison(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'monthly',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/period-comparison ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getPeriodComparison(period, date, startDate, endDate);
    }
}
