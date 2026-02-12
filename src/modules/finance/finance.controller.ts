import { Body, Controller, Delete, Get, Logger, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/budget.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('finance-stats')
@UseGuards(AdminGuard)
export class FinanceController {
    private readonly logger = new Logger(FinanceController.name);
    constructor(
        private readonly financeService: FinanceService,
        private readonly budgetService: BudgetService
    ) { }

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

    // === Budget Endpoints ===

    @Post('budget')
    async createOrUpdateBudget(@Body() dto: CreateBudgetDto) {
        this.logger.log(`POST /finance-stats/budget ${JSON.stringify(dto)}`);
        return this.budgetService.createOrUpdateBudget(dto);
    }

    @Get('budget')
    async getBudgets(
        @Query('period') period: string = 'monthly',
        @Query('year') year: string,
        @Query('month') month?: string,
    ) {
        this.logger.log(`GET /finance-stats/budget ${JSON.stringify({ period, year, month })}`);
        return this.budgetService.getBudgets(period, parseInt(year), month ? parseInt(month) : undefined);
    }

    @Get('budget/variance')
    async getBudgetVariance(
        @Query('period') period: 'monthly' | 'yearly' = 'monthly',
        @Query('year') year: string,
        @Query('month') month?: string,
    ) {
        this.logger.log(`GET /finance-stats/budget/variance ${JSON.stringify({ period, year, month })}`);
        return this.budgetService.getBudgetVariance(period, parseInt(year), month ? parseInt(month) : undefined);
    }

    @Delete('budget/:id')
    async deleteBudget(@Param('id') id: string) {
        this.logger.log(`DELETE /finance-stats/budget/${id}`);
        return this.budgetService.deleteBudget(id);
    }

    @Get('accounts-payable')
    async getAccountsPayableReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/accounts-payable ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getAccountsPayableReport(period, date, startDate, endDate);
    }

    @Get('accounts-receivable')
    async getAccountsReceivableReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/accounts-receivable ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getAccountsReceivableReport(period, date, startDate, endDate);
    }

    @Get('bpjs-performance')
    async getBPJSPerformanceReport(
        @Query('period') period: 'daily' | 'monthly' | 'yearly' = 'daily',
        @Query('date') date?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        this.logger.log(`GET /finance-stats/bpjs-performance ${JSON.stringify({ period, date, startDate, endDate })}`);
        return this.financeService.getBPJSPerformanceReport(period, date, startDate, endDate);
    }
}
