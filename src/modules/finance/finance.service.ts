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
                revenue: currentData.revenue,
                expenses: currentData.expenses,
                drugProfit: currentData.drugProfit,
                transactions: currentData.transactions,
                netIncome: currentData.netIncome,
                startDate: current.startDate,
                endDate: current.endDate,
                previous: {
                    revenue: previousData.revenue,
                    expenses: previousData.expenses,
                    drugProfit: previousData.drugProfit,
                    transactions: previousData.transactions,
                    netIncome: previousData.netIncome,
                    startDate: previous.startDate,
                    endDate: previous.endDate,
                },
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

    async getAccountsPayableReport(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;
            const today = new Date();

            // 1. Get all unpaid or partially paid purchase orders
            const orders = await db('pemesanan as p')
                .select(
                    'p.no_faktur',
                    'p.kode_suplier',
                    's.nama_suplier',
                    'p.tgl_pesan',
                    'p.tgl_faktur',
                    'p.tgl_tempo',
                    'p.tagihan as totalAmount',
                    'p.status'
                )
                .join('datasuplier as s', 'p.kode_suplier', 's.kode_suplier')
                .whereNot('p.status', 'Sudah Dibayar')
                .whereBetween('p.tgl_faktur', [startDate, endDate]);

            // 2. Get all payments for these orders
            const invoiceNumbers = orders.map(o => o.no_faktur);
            const payments = await db('bayar_pemesanan')
                .select('no_faktur')
                .sum('besar_bayar as totalPaid')
                .whereIn('no_faktur', invoiceNumbers)
                .groupBy('no_faktur');

            const paymentMap = new Map(payments.map(p => [p.no_faktur, Number(p.totalPaid) || 0]));

            // 3. Process data and calculate aging
            const agedData = orders.map(order => {
                const totalPaid = paymentMap.get(order.no_faktur) || 0;
                const balance = order.totalAmount - totalPaid;

                if (balance <= 0) return null;

                const dueDate = new Date(order.tgl_tempo);
                const diffTime = today.getTime() - dueDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let agingSegment = '0-30 Hari';
                if (diffDays > 90) agingSegment = '90+ Hari';
                else if (diffDays > 60) agingSegment = '61-90 Hari';
                else if (diffDays > 30) agingSegment = '31-60 Hari';
                else if (diffDays <= 0) agingSegment = 'Belum Jatuh Tempo';

                return {
                    ...order,
                    totalPaid,
                    balance,
                    diffDays,
                    agingSegment
                };
            }).filter(Boolean);

            // 4. Summarize by supplier and aging
            const summaryBySupplier = agedData.reduce((acc: any, curr: any) => {
                if (!acc[curr.kode_suplier]) {
                    acc[curr.kode_suplier] = {
                        kode_suplier: curr.kode_suplier,
                        nama_suplier: curr.nama_suplier,
                        totalDebt: 0,
                        invoiceCount: 0
                    };
                }
                acc[curr.kode_suplier].totalDebt += curr.balance;
                acc[curr.kode_suplier].invoiceCount += 1;
                return acc;
            }, {});

            const agingSummary = agedData.reduce((acc: any, curr: any) => {
                acc[curr.agingSegment] = (acc[curr.agingSegment] || 0) + curr.balance;
                return acc;
            }, {
                'Belum Jatuh Tempo': 0,
                '0-30 Hari': 0,
                '31-60 Hari': 0,
                '61-90 Hari': 0,
                '90+ Hari': 0
            });

            return {
                totalDebt: agedData.reduce((sum, item) => sum + item.balance, 0),
                overdueDebt: agedData.reduce((sum, item) => item.diffDays > 0 ? sum + item.balance : sum, 0),
                invoiceCount: agedData.length,
                agingSummary: Object.entries(agingSummary).map(([name, value]) => ({ name, value })),
                supplierSummary: Object.values(summaryBySupplier).sort((a: any, b: any) => b.totalDebt - a.totalDebt),
                details: agedData.sort((a, b) => b.diffDays - a.diffDays)
            };

        } catch (error) {
            this.logger.error('Error fetching accounts payable report', error);
            throw error;
        }
    }

    async getAccountsReceivableReport(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;
            const todayStr = new Date().toISOString().split('T')[0];

            // 1. Get Main Aggregates (Total AR, Overdue AR, Count)
            const mainSummary = await db('piutang_pasien as p')
                .select(
                    db.raw('SUM(sisapiutang) as totalAR'),
                    db.raw('SUM(CASE WHEN tgltempo < ? THEN sisapiutang ELSE 0 END) as overdueAR', [todayStr]),
                    db.raw('COUNT(DISTINCT no_rkm_medis) as patientCount'),
                    db.raw('COUNT(*) as invoiceCount')
                )
                .where('status', 'Belum Lunas')
                .andWhere('sisapiutang', '>', 0)
                .whereBetween('tgl_piutang', [startDate, endDate])
                .first();

            // 2. Get Aging Summary (Aggregated in SQL)
            const agingRes = await db('piutang_pasien as p')
                .select(
                    db.raw(`
                        CASE 
                            WHEN DATEDIFF(?, tgltempo) > 90 THEN "90+ Hari"
                            WHEN DATEDIFF(?, tgltempo) > 60 THEN "61-90 Hari"
                            WHEN DATEDIFF(?, tgltempo) > 30 THEN "31-60 Hari"
                            WHEN DATEDIFF(?, tgltempo) > 0 THEN "0-30 Hari"
                            ELSE "Belum Jatuh Tempo"
                        END as name`, [todayStr, todayStr, todayStr, todayStr]
                    ),
                    db.raw('SUM(sisapiutang) as value')
                )
                .where('status', 'Belum Lunas')
                .andWhere('sisapiutang', '>', 0)
                .whereBetween('tgl_piutang', [startDate, endDate])
                .groupBy('name');

            // 3. Get Insurance Summary (Aggregated in SQL)
            const insuranceRes = await db('piutang_pasien as p')
                .select(
                    db.raw('IFNULL(dp.nama_bayar, "UMUM/LAINNYA") as name'),
                    db.raw('SUM(p.sisapiutang) as value')
                )
                .leftJoin('detail_piutang_pasien as dp', 'p.no_rawat', 'dp.no_rawat')
                .where('p.status', 'Belum Lunas')
                .andWhere('p.sisapiutang', '>', 0)
                .whereBetween('p.tgl_piutang', [startDate, endDate])
                .groupBy('name')
                .orderBy('value', 'desc')
                .limit(10); // Top 10 insurance providers

            // 4. Get Top 1000 Details (Ordered by most overdue)
            const details = await db('piutang_pasien as p')
                .select(
                    'p.no_rawat',
                    'p.no_rkm_medis',
                    'pas.nm_pasien',
                    'p.tgl_piutang',
                    'p.tgltempo',
                    'p.totalpiutang as totalAmount',
                    'p.sisapiutang as balance',
                    'p.status',
                    'dp.nama_bayar as penjab'
                )
                .join('pasien as pas', 'p.no_rkm_medis', 'pas.no_rkm_medis')
                .leftJoin('detail_piutang_pasien as dp', 'p.no_rawat', 'dp.no_rawat')
                .where('p.status', 'Belum Lunas')
                .andWhere('p.sisapiutang', '>', 0)
                .whereBetween('p.tgl_piutang', [startDate, endDate])
                .orderBy('p.tgltempo', 'asc') // Most overdue first
                .limit(1000);

            // Post-process details to add agingSegment and diffDays (for UI)
            const processedDetails = details.map(row => {
                const today = new Date();
                const dueDate = new Date(row.tgltempo);
                const diffTime = today.getTime() - dueDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                let agingSegment = '0-30 Hari';
                if (diffDays > 90) agingSegment = '90+ Hari';
                else if (diffDays > 60) agingSegment = '61-90 Hari';
                else if (diffDays > 30) agingSegment = '31-60 Hari';
                else if (diffDays <= 0) agingSegment = 'Belum Jatuh Tempo';

                return {
                    ...row,
                    diffDays,
                    agingSegment,
                    penjab: row.penjab || 'UMUM/LAINNYA'
                };
            });

            // Ensure all aging buckets exist for the chart even if empty
            const agingOrder = ['Belum Jatuh Tempo', '0-30 Hari', '31-60 Hari', '61-90 Hari', '90+ Hari'];
            const agingMap = new Map((agingRes as any[]).map(i => [i.name, Number(i.value)]));
            const finalAgingSummary = agingOrder.map(name => ({
                name,
                value: agingMap.get(name) || 0
            }));

            return {
                totalAR: Number((mainSummary as any).totalAR) || 0,
                overdueAR: Number((mainSummary as any).overdueAR) || 0,
                patientCount: Number((mainSummary as any).patientCount) || 0,
                invoiceCount: Number((mainSummary as any).invoiceCount) || 0,
                agingSummary: finalAgingSummary,
                insuranceSummary: (insuranceRes as any[]).map(i => ({ ...i, value: Number(i.value) })),
                details: processedDetails
            };

        } catch (error) {
            this.logger.error('Error fetching accounts receivable report', error);
            throw error;
        }
    }

    async getBPJSPerformanceReport(period: 'daily' | 'monthly' | 'yearly', date?: string, customStart?: string, customEnd?: string) {
        try {
            const { startDate, endDate } = this.getDateRange(period, date, customStart, customEnd);
            const db = this.khanzaDB.db;

            // 1. SEP Volume Trends (Last 6 Months)
            // We keep trends at 6 months regardless of period for context
            const volumeTrends = await db('bridging_sep')
                .select(db.raw('DATE_FORMAT(tglsep, "%Y-%m") as month'))
                .count('* as count')
                .groupBy('month')
                .orderBy('month', 'desc')
                .limit(6);

            // 2. Clinical Analysis: Top 10 Diagnoses
            const topDiagnoses = await db('bridging_sep')
                .select('diagawal as code', 'nmdiagnosaawal as name')
                .count('* as count')
                .whereNot('nmdiagnosaawal', '-')
                .whereBetween('tglsep', [startDate, endDate])
                .groupBy('diagawal', 'nmdiagnosaawal')
                .orderBy('count', 'desc')
                .limit(10);

            // 3. Demographic: Participant Distribution
            const participantDist = await db('bridging_sep')
                .select('peserta as name')
                .count('* as value')
                .whereBetween('tglsep', [startDate, endDate])
                .groupBy('peserta')
                .orderBy('value', 'desc');

            // 4. Class Distribution
            const classDist = await db('bridging_sep')
                .select('klsrawat as name')
                .count('* as value')
                .whereBetween('tglsep', [startDate, endDate])
                .groupBy('klsrawat')
                .orderBy('name', 'asc');

            // 5. Service Type (Ralan vs Ranap)
            // jnspelayanan: 1 = Ranap, 2 = Ralan
            const serviceTypeDist = await db('bridging_sep')
                .select(db.raw('CASE WHEN jnspelayanan = "1" THEN "Rawat Inap" ELSE "Rawat Jalan" END as name'))
                .count('* as value')
                .whereBetween('tglsep', [startDate, endDate])
                .groupBy('name');

            // 6. Recent SEPs in range
            const recentSEPs = await db('bridging_sep')
                .select(
                    'no_sep',
                    'no_rawat',
                    'nomr',
                    'nama_pasien',
                    'tglsep',
                    'nmdiagnosaawal as diagnosa',
                    'nmpolitujuan as poli'
                )
                .whereBetween('tglsep', [startDate, endDate])
                .orderBy('tglsep', 'desc')
                .limit(50);

            return {
                summary: {
                    totalSEP: await db('bridging_sep').whereBetween('tglsep', [startDate, endDate]).count('* as total').then(r => r[0].total),
                    periodSEP: await db('bridging_sep').whereBetween('tglsep', [startDate, endDate]).count('* as total').then(r => r[0].total),
                    topDiagnosis: topDiagnoses[0]?.name || '-',
                },
                trends: (volumeTrends as any[]).reverse(),
                diagnoses: topDiagnoses,
                participants: participantDist,
                classes: classDist,
                services: serviceTypeDist,
                recent: recentSEPs,
                startDate,
                endDate
            };

        } catch (error) {
            this.logger.error('Error fetching BPJS performance report', error);
            throw error;
        }
    }
}
