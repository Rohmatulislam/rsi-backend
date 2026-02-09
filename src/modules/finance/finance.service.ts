import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from 'src/infra/database/khanza/khanza-db.service';

@Injectable()
export class FinanceService {
    private readonly logger = new Logger(FinanceService.name);

    constructor(private readonly khanzaDB: KhanzaDBService) {
        this.khanzaDB.db.raw('DESC piutang_pasien').then(res => {
            this.logger.log('Columns in piutang_pasien: ' + JSON.stringify(res[0].map(c => c.Field)));
        }).catch(e => {
            this.logger.warn('piutang_pasien table not found or error: ' + e.message);
        });
        this.khanzaDB.db.raw('DESC billing').then(res => {
            this.logger.log('Columns in billing: ' + JSON.stringify(res[0].map(c => c.Field)));
        }).catch(e => {
            this.logger.warn('billing table not found or error: ' + e.message);
        });

        // Debug today's registration counts
        const todayStr = new Date().toISOString().split('T')[0];
        this.khanzaDB.db('reg_periksa as reg')
            .select('pj.png_jawab', this.khanzaDB.db.raw('count(*) as total'))
            .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
            .where('reg.tgl_registrasi', todayStr)
            .groupBy('pj.png_jawab')
            .then(res => {
                this.logger.log(`DIAGNOSTIC - Today's registrations: ${JSON.stringify(res)}`);
            });
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

            // Step 1: Get all registrations in period to ensure all payment methods show up
            const baseQuery = db('reg_periksa as reg')
                .select(
                    'pj.png_jawab as name',
                    db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as value')
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

            // Step 2: Handle results and filter empty ones
            const data = (results as any[]).map(row => {
                let val = Number(row.value);
                return {
                    name: row.name,
                    value: val,
                    profit: val * 0.15,
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

    private async getPaymentMethodReportFallback(period: 'daily' | 'monthly' | 'yearly', date?: string) {
        const { startDate, endDate } = this.getDateRange(period, date);
        const db = this.khanzaDB.db;
        const results = await db('reg_periksa as reg')
            .select('pj.png_jawab as name', db.raw('COUNT(*) as value'))
            .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
            .whereBetween('reg.tgl_registrasi', [startDate, endDate])
            .groupBy('pj.png_jawab');

        return (results as any[]).map(row => ({
            name: row.name,
            value: Number(row.value) * 100000, // Dummy value based on counts
            profit: Number(row.value) * 15000,
            percentage: 0
        }));
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
                .select(db.raw('SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'))
                .first();

            const inpatientRevenue = await db('reg_periksa as reg')
                .join('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .whereBetween('reg.tgl_registrasi', [startDate, endDate])
                .select(db.raw('SUM(COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as total'))
                .first();

            const drugProfit = await db('detail_pemberian_obat')
                .whereBetween('tgl_perawatan', [startDate, endDate])
                .select(db.raw('SUM(jml * (biaya_obat - h_beli)) as totalProfit'))
                .first();

            const totalRevenue = (Number((revenue as any)?.total) || 0) + (Number((inpatientRevenue as any)?.total) || 0);

            return {
                totalRevenue,
                totalProfit: Number((drugProfit as any)?.totalProfit) || 0,
                transactionCount: 0
            };
        } catch (error) {
            this.logger.error('Error fetching financial summary', error);
            return { totalRevenue: 0, totalProfit: 0, transactionCount: 0 };
        }
    }

    async getFinancialTrends() {
        try {
            const db = this.khanzaDB.db;

            // This query gets revenue trends for the last 6 months
            const results = await db('reg_periksa as reg')
                .select(
                    db.raw('DATE_FORMAT(reg.tgl_registrasi, "%b") as month'),
                    db.raw('SUM(CASE WHEN pj.png_jawab LIKE "%BPJS%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as bpjs'),
                    db.raw('SUM(CASE WHEN pj.png_jawab LIKE "%UMUM%" OR pj.png_jawab LIKE "%TUNAI%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as umum'),
                    db.raw('SUM(CASE WHEN pj.png_jawab NOT LIKE "%BPJS%" AND pj.png_jawab NOT LIKE "%UMUM%" AND pj.png_jawab NOT LIKE "%TUNAI%" THEN COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0) ELSE 0 END) as asuransi')
                )
                .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
                .leftJoin('nota_jalan as nj', 'reg.no_rawat', 'nj.no_rawat')
                .leftJoin('detail_nota_jalan as dnj', 'nj.no_rawat', 'dnj.no_rawat')
                .leftJoin('nota_inap as ni', 'reg.no_rawat', 'ni.no_rawat')
                .leftJoin('detail_nota_inap as dni', 'ni.no_rawat', 'dni.no_rawat')
                .leftJoin('piutang_pasien as pp', 'reg.no_rawat', 'pp.no_rawat')
                .where('reg.tgl_registrasi', '>=', db.raw('DATE_SUB(CURDATE(), INTERVAL 6 MONTH)'))
                .groupByRaw('DATE_FORMAT(reg.tgl_registrasi, "%Y-%m")')
                .orderByRaw('reg.tgl_registrasi ASC');

            return (results as any[]).map(row => ({
                month: row.month,
                bpjs: Number(row.bpjs) || 0,
                umum: Number(row.umum) || 0,
                asuransi: Number(row.asuransi) || 0
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
}
