import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';

import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('finance-stats')
@UseGuards(AdminGuard)
export class FinanceController {
    constructor(private readonly financeService: FinanceService) { }

    @Get('drug-profit')
    async getDrugProfitReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        console.log('GET /finance-stats/drug-profit', { period, date, startDate, endDate });
        return this.financeService.getDrugProfitReport(period, date, startDate, endDate);
    }

    @Get('payment-method')
    async getPaymentMethodReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        console.log('GET /finance-stats/payment-method', { period, date, startDate, endDate });
        return this.financeService.getPaymentMethodReport(period, date, startDate, endDate);
    }

    @Get('summary')
    async getFinancialSummary(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        console.log('GET /finance-stats/summary', { period, date, startDate, endDate });
        return this.financeService.getFinancialSummary(period, date, startDate, endDate);
    }

    @Get('trends')
    async getFinancialTrends() {
        console.log('GET /finance-stats/trends');
        return this.financeService.getFinancialTrends();
    }
}
