import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import { FinanceService } from './finance.service';

@Injectable()
export class BudgetService {
    private readonly logger = new Logger(BudgetService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly financeService: FinanceService
    ) { }

    async createOrUpdateBudget(dto: CreateBudgetDto) {
        return this.prisma.budget.upsert({
            where: {
                category_period_month_year: {
                    category: dto.category,
                    period: dto.period,
                    month: dto.month || 0,
                    year: dto.year,
                },
            },
            update: {
                amount: dto.amount,
                notes: dto.notes,
            },
            create: {
                category: dto.category,
                amount: dto.amount,
                period: dto.period,
                month: dto.month || 0,
                year: dto.year,
                notes: dto.notes,
            },
        });
    }

    async getBudgets(period: string, year: number, month?: number) {
        return this.prisma.budget.findMany({
            where: {
                period,
                year,
                month: month || 0,
                isActive: true,
            },
        });
    }

    async getBudgetVariance(period: 'monthly' | 'yearly', year: number, month?: number) {
        const date = `${year}-${String(month || 1).padStart(2, '0')}-01`;
        const budgets = await this.getBudgets(period, year, month);
        const expenses = await this.financeService.getExpenseSummary(period, date);

        // Map budgets with actual values
        const variance = budgets.map(budget => {
            let actual = 0;

            if (budget.category === 'Total Pengeluaran') {
                actual = expenses.totalExpenses;
            } else {
                // Try to find matching category in topCategories
                const match = expenses.topCategories.find(c =>
                    c.nm_rek.toLowerCase().includes(budget.category.toLowerCase()) ||
                    budget.category.toLowerCase().includes(c.nm_rek.toLowerCase())
                );
                actual = match ? match.amount : 0;
            }

            return {
                id: budget.id,
                category: budget.category,
                budget: budget.amount,
                actual,
                variance: budget.amount - actual,
                percentage: budget.amount > 0 ? (actual / budget.amount) * 100 : 0,
                notes: budget.notes
            };
        });

        return variance;
    }

    async deleteBudget(id: string) {
        return this.prisma.budget.delete({ where: { id } });
    }
}
