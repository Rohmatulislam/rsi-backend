import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KhanzaDBService } from 'src/infra/database/khanza/khanza-db.service';

@Injectable()
export class FinanceService implements OnModuleInit {
    private readonly logger = new Logger(FinanceService.name);

    constructor(private readonly khanzaDB: KhanzaDBService) { }

    async onModuleInit() {
        try {
            const isConnected = await this.khanzaDB.testConnection();
            if (isConnected) {
                this.logger.log('FinanceService connected to Khanza DB.');
            }
        } catch (error) {
            this.logger.warn('FinanceService: Khanza DB not available at startup.');
        }
    }

    async getDrugProfitReport(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;

            const results = await db('detail_pemberian_obat as d')
                .select(
                    db.raw('COALESCE(poli.nm_poli, bangsal.nm_bangsal, "Farmasi / Lainnya") as unit'),
                    db.raw('SUM(d.jml * d.biaya_obat) as totalSales'),
                    db.raw('SUM(d.jml * d.h_beli) as cost'),
                    db.raw('SUM(d.jml * (d.biaya_obat - d.h_beli)) as profit')
                )
                .join('reg_periksa as reg', 'd.no_rawat', 'reg.no_rawat')
                .leftJoin('poliklinik as poli', 'reg.kd_poli', 'poli.kd_poli')
                .leftJoin('kamar_inap as ki', function () {
                    this.on('reg.no_rawat', '=', 'ki.no_rawat').andOn('ki.stts_pulang', '=', db.raw("'-'"))
                })
                .leftJoin('kamar', 'ki.kd_kamar', 'kamar.kd_kamar')
                .leftJoin('bangsal', 'kamar.kd_bangsal', 'bangsal.kd_bangsal')
                .whereBetween('d.tgl_perawatan', [startDate, endDate])
                .groupBy('unit')
                .orderBy('profit', 'desc');

            return (results as any[]).map(row => ({
                unit: row.unit,
                totalSales: Number(row.totalSales),
                cost: Number(row.cost),
                profit: Number(row.profit)
            }));
        } catch (error) {
            this.logger.error('Error fetching drug profit report', error);
            throw error;
        }
    }

    async getPaymentMethodReport(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;

            const baseQuery = db('reg_periksa as reg')
                .select(
                    'pj.png_jawab as name',
                    db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as value'),
                    db.raw('COUNT(DISTINCT reg.no_rawat) as totalTransactions')
                )
                .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
                .leftJoin('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                .leftJoin('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .whereBetween('reg.tgl_registrasi', [startDate, endDate])
                .groupBy('pj.png_jawab');

            const results = await baseQuery;

            const data = (results as any[]).map(row => {
                const val = Number(row.value);
                return {
                    name: row.name,
                    value: val,
                    transactions: Number(row.totalTransactions),
                    percentage: 0
                };
            }).filter(item => item.value > 0);

            const total = data.reduce((acc, curr) => acc + curr.value, 0);
            return data.map(item => ({
                ...item,
                percentage: total > 0 ? (item.value / total) * 100 : 0
            })).sort((a, b) => b.value - a.value);

        } catch (error) {
            this.logger.error('Error fetching payment method report', error);
            throw error;
        }
    }

    async getExpenseSummary(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;

            // Beban from jurnal: rekening prefix 5 and 6 (Beban Operasional & Beban Lain)
            const result = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .where('r.tipe', 'R')
                .where(function () {
                    this.where('r.kd_rek', 'like', '5%').orWhere('r.kd_rek', 'like', '6%');
                })
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .select(
                    db.raw('SUM(CASE WHEN r.balance = "D" THEN dj.debet - dj.kredit ELSE dj.kredit - dj.debet END) as totalExpenses'),
                    db.raw('COUNT(DISTINCT j.no_jurnal) as entryCount')
                )
                .first();

            // Get top expense categories
            const categories = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .where('r.tipe', 'R')
                .where(function () {
                    this.where('r.kd_rek', 'like', '5%').orWhere('r.kd_rek', 'like', '6%');
                })
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .select(
                    'r.kd_rek',
                    'r.nm_rek',
                    db.raw('SUM(CASE WHEN r.balance = "D" THEN dj.debet - dj.kredit ELSE dj.kredit - dj.debet END) as amount')
                )
                .groupBy('r.kd_rek', 'r.nm_rek')
                .orderBy('amount', 'desc')
                .limit(10);

            return {
                totalExpenses: Number((result as any)?.totalExpenses) || 0,
                entryCount: Number((result as any)?.entryCount) || 0,
                topCategories: (categories as any[]).map(c => ({
                    kd_rek: c.kd_rek,
                    nm_rek: c.nm_rek,
                    amount: Number(c.amount)
                }))
            };
        } catch (error) {
            this.logger.error('Error fetching expense summary', error);
            return { totalExpenses: 0, entryCount: 0, topCategories: [] };
        }
    }

    async getFinancialSummary(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;

            const revenue = await db('reg_periksa as reg')
                .join('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .whereBetween('reg.tgl_registrasi', [startDate, endDate])
                .select(
                    db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'),
                    db.raw('COUNT(DISTINCT reg.no_rawat) as txCount')
                )
                .first();

            const inpatientRevenue = await db('reg_periksa as reg')
                .join('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .whereBetween('reg.tgl_registrasi', [startDate, endDate])
                .select(
                    db.raw('SUM(COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'),
                    db.raw('COUNT(DISTINCT reg.no_rawat) as txCount')
                )
                .first();

            const drugProfit = await db('detail_pemberian_obat')
                .whereBetween('tgl_perawatan', [startDate, endDate])
                .select(db.raw('SUM(jml * (biaya_obat - h_beli)) as totalProfit'))
                .first();

            // Get real expenses from jurnal
            const expenses = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .where('r.tipe', 'R')
                .where(function () {
                    this.where('r.kd_rek', 'like', '5%').orWhere('r.kd_rek', 'like', '6%');
                })
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .select(db.raw('SUM(CASE WHEN r.balance = "D" THEN dj.debet - dj.kredit ELSE dj.kredit - dj.debet END) as totalExpenses'))
                .first();

            const totalRevenue = (Number((revenue as any)?.total) || 0) + (Number((inpatientRevenue as any)?.total) || 0);
            const totalExpenses = Number((expenses as any)?.totalExpenses) || 0;
            const transactionCount = (Number((revenue as any)?.txCount) || 0) + (Number((inpatientRevenue as any)?.txCount) || 0);

            // Get previous period for comparison
            const prevRange = this.getPreviousPeriodRange(period, date, customStart, customEnd);
            let previousRevenue = 0;
            if (prevRange) {
                const prevRev = await db('reg_periksa as reg')
                    .join('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                    .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                    .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                    .whereBetween('reg.tgl_registrasi', [prevRange.startDate, prevRange.endDate])
                    .select(db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'))
                    .first();

                const prevInpRev = await db('reg_periksa as reg')
                    .join('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                    .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                    .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                    .whereBetween('reg.tgl_registrasi', [prevRange.startDate, prevRange.endDate])
                    .select(db.raw('SUM(COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'))
                    .first();

                previousRevenue = (Number((prevRev as any)?.total) || 0) + (Number((prevInpRev as any)?.total) || 0);
            }

            const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

            return {
                totalRevenue,
                totalExpenses,
                totalProfit: Number((drugProfit as any)?.totalProfit) || 0,
                netIncome: totalRevenue - totalExpenses,
                transactionCount,
                revenueGrowth: Math.round(revenueGrowth * 10) / 10,
                previousRevenue,
            };
        } catch (error) {
            this.logger.error('Error fetching financial summary', error);
            return { totalRevenue: 0, totalExpenses: 0, totalProfit: 0, netIncome: 0, transactionCount: 0, revenueGrowth: 0, previousRevenue: 0 };
        }
    }

    async getFinancialTrends() {
        try {
            const db = this.khanzaDB.db;

            const results = await db('reg_periksa as reg')
                .select(
                    db.raw('DATE_FORMAT(reg.tgl_registrasi, "%b") as month'),
                    db.raw('DATE_FORMAT(reg.tgl_registrasi, "%Y-%m") as sortKey'),
                    db.raw('SUM(CASE WHEN pj.png_jawab LIKE "%BPJS%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as bpjs'),
                    db.raw('SUM(CASE WHEN pj.png_jawab LIKE "%UMUM%" OR pj.png_jawab LIKE "%TUNAI%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as umum'),
                    db.raw('SUM(CASE WHEN pj.png_jawab NOT LIKE "%BPJS%" AND pj.png_jawab NOT LIKE "%UMUM%" AND pj.png_jawab NOT LIKE "%TUNAI%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as asuransi'),
                    db.raw('COUNT(DISTINCT reg.no_rawat) as totalTransactions')
                )
                .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
                .leftJoin('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                .leftJoin('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .where('reg.tgl_registrasi', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL 6 MONTH)'))
                .groupByRaw('DATE_FORMAT(reg.tgl_registrasi, "%Y-%m")')
                .orderByRaw('sortKey ASC');

            return (results as any[]).map(row => ({
                month: row.month,
                bpjs: Number(row.bpjs) || 0,
                umum: Number(row.umum) || 0,
                asuransi: Number(row.asuransi) || 0,
                totalTransactions: Number(row.totalTransactions) || 0,
            }));
        } catch (error) {
            this.logger.error('Error fetching financial trends', error);
            return [];
        }
    }

    private getDateRange(period: string, dateStr?: string, customStart?: string, customEnd?: string) {
        if (customStart && customEnd) {
            return { startDate: customStart, endDate: customEnd };
        }

        const date = dateStr ? new Date(dateStr) : new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        let startDate: string;
        let endDate: string;

        if (period === 'daily') {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            endDate = startDate;
        } else if (period === 'monthly') {
            startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        } else {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
        }

        return { startDate, endDate };
    }

    private getPreviousPeriodRange(period: string, dateStr?: string, customStart?: string, customEnd?: string) {
        if (customStart && customEnd) {
            const start = new Date(customStart);
            const end = new Date(customEnd);
            const diff = end.getTime() - start.getTime();
            const prevEnd = new Date(start.getTime() - 1); // day before customStart
            const prevStart = new Date(prevEnd.getTime() - diff);
            return {
                startDate: prevStart.toISOString().split('T')[0],
                endDate: prevEnd.toISOString().split('T')[0]
            };
        }

        const date = dateStr ? new Date(dateStr) : new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.getDate();

        if (period === 'daily') {
            const prev = new Date(year, month, day - 1);
            const d = prev.toISOString().split('T')[0];
            return { startDate: d, endDate: d };
        } else if (period === 'monthly') {
            const prevMonth = month === 0 ? 11 : month - 1;
            const prevYear = month === 0 ? year - 1 : year;
            const firstDay = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
            return {
                startDate: firstDay,
                endDate: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            };
        } else {
            return {
                startDate: `${year - 1}-01-01`,
                endDate: `${year - 1}-12-31`
            };
        }
    }

    async getPeriodComparison(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const current = this.getDateRange(period, date, customStart, customEnd);
            const previous = this.getPreviousPeriodRange(period, date, customStart, customEnd);
            if (!previous) return null;

            const db = this.khanzaDB.db;

            const fetchPeriodData = async (start: string, end: string) => {
                // Revenue
                const rev = await db('reg_periksa as reg')
                    .join('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                    .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                    .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                    .whereBetween('reg.tgl_registrasi', [start, end])
                    .select(
                        db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'),
                        db.raw('COUNT(DISTINCT reg.no_rawat) as txCount')
                    )
                    .first();

                const inpRev = await db('reg_periksa as reg')
                    .join('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                    .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                    .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                    .whereBetween('reg.tgl_registrasi', [start, end])
                    .select(
                        db.raw('SUM(COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'),
                        db.raw('COUNT(DISTINCT reg.no_rawat) as txCount')
                    )
                    .first();

                // Expenses
                const exp = await db('detailjurnal as dj')
                    .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                    .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                    .where('r.tipe', 'R')
                    .where(function () { this.where('r.kd_rek', 'like', '5%').orWhere('r.kd_rek', 'like', '6%'); })
                    .whereBetween('j.tgl_jurnal', [start, end])
                    .select(db.raw('SUM(CASE WHEN r.balance = "D" THEN dj.debet - dj.kredit ELSE dj.kredit - dj.debet END) as totalExpenses'))
                    .first();

                // Drug Profit
                const drug = await db('detail_pemberian_obat')
                    .whereBetween('tgl_perawatan', [start, end])
                    .select(db.raw('SUM(jml * (biaya_obat - h_beli)) as totalProfit'))
                    .first();

                const revenue = (Number((rev as any)?.total) || 0) + (Number((inpRev as any)?.total) || 0);
                const transactions = (Number((rev as any)?.txCount) || 0) + (Number((inpRev as any)?.txCount) || 0);

                return {
                    revenue,
                    expenses: Number((exp as any)?.totalExpenses) || 0,
                    drugProfit: Number((drug as any)?.totalProfit) || 0,
                    transactions,
                    netIncome: revenue - (Number((exp as any)?.totalExpenses) || 0),
                };
            };

            const currentData = await fetchPeriodData(current.startDate, current.endDate);
            const previousData = await fetchPeriodData(previous.startDate, previous.endDate);

            const pctChange = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : (curr > 0 ? 100 : 0);

            return {
                current: { ...currentData, startDate: current.startDate, endDate: current.endDate },
                previous: { ...previousData, startDate: previous.startDate, endDate: previous.endDate },
                changes: {
                    revenue: pctChange(currentData.revenue, previousData.revenue),
                    expenses: pctChange(currentData.expenses, previousData.expenses),
                    drugProfit: pctChange(currentData.drugProfit, previousData.drugProfit),
                    transactions: pctChange(currentData.transactions, previousData.transactions),
                    netIncome: pctChange(currentData.netIncome, previousData.netIncome),
                }
            };
        } catch (error) {
            this.logger.error('Error fetching period comparison', error);
            return null;
        }
    }
}
