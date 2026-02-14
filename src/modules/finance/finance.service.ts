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

    private readonly TREATMENT_REGISTRY: any[] = [
        { table: 'rawat_jl_dr', type: 'ralan', performer: 'dr', cat: 'ralan', master: 'jns_perawatan' },
        { table: 'rawat_jl_pr', type: 'ralan', performer: 'pr', cat: 'ralan', master: 'jns_perawatan' },
        { table: 'rawat_jl_drpr', type: 'ralan', performer: 'drpr', cat: 'ralan', master: 'jns_perawatan' },
        { table: 'rawat_inap_dr', type: 'ranap', performer: 'dr', cat: 'ranap', master: 'jns_perawatan_inap' },
        { table: 'rawat_inap_pr', type: 'ranap', performer: 'pr', cat: 'ranap', master: 'jns_perawatan_inap' },
        { table: 'rawat_inap_drpr', type: 'ranap', performer: 'drpr', cat: 'ranap', master: 'jns_perawatan_inap' },
        {
            table: 'operasi', type: 'ranap', performer: 'special', cat: 'operasi', master: 'paket_operasi',
            code: 't.kode_paket', masterCode: 'jns.kode_paket', date: 't.tgl_operasi',
            time: 'DATE_FORMAT(t.tgl_operasi, "%H:%i:%s")', cost: 'operasi'
        },
        { table: 'periksa_radiologi', type: 'both', performer: 'special', cat: 'radiologi', master: 'jns_perawatan_radiologi', date: 't.tgl_periksa', time: 't.jam' },
        { table: 'periksa_lab', type: 'both', performer: 'special', cat: 'laborat', master: 'jns_perawatan_lab', date: 't.tgl_periksa', time: 't.jam' },
        { table: 'periksa_utd', type: 'both', performer: 'special', cat: 'utd', master: 'jns_perawatan_utd', date: 't.tgl_periksa', time: 't.jam' },
        {
            table: 'detail_periksa_lab', type: 'both', performer: 'special', cat: 'laborat', master: 'template_laboratorium',
            name: 'jns.Pemeriksaan', date: 't.tgl_periksa', time: 't.jam', cost: 'detail_periksa_lab'
        },
        { table: 'detail_pemberian_obat', type: 'custom', performer: 'custom', cat: 'farmasi' },
        { table: 'tambahan_biaya', type: 'custom', performer: 'custom', cat: 'tambahan' },
        { table: 'pengurangan_biaya', type: 'custom', performer: 'custom', cat: 'potongan' }
    ];

    async getTreatmentDetailReport(params: {
        period: string,
        date?: string,
        startDate?: string,
        endDate?: string,
        search?: string,
        category?: string,
        limit?: number,
        offset?: number
    }) {
        try {
            const { startDate, endDate } = this.getDateRange(params.period, params.date, params.startDate, params.endDate);
            const category = params.category || 'all';
            this.logger.log(`Fetching treatment details for range: ${startDate} to ${endDate} (category: ${category}, search: ${params.search})`);
            const db = this.khanzaDB.db;
            const limit = params.limit || 100;
            const offset = params.offset || 0;

            const getQueryFromConfig = (config: any) => {
                const { table, type, performer, cat, master, code, masterCode, name, date, time, cost } = config;

                // Handle Custom: Farmasi
                if (cat === 'farmasi') {
                    return db('detail_pemberian_obat as t')
                        .join('reg_periksa as reg', 't.no_rawat', 'reg.no_rawat')
                        .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                        .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
                        .join('databarang as jns', 't.kode_brng', 'jns.kode_brng')
                        .select(
                            db.raw('jns.nama_brng as nm_perawatan'),
                            db.raw('CASE WHEN t.status = "Ralan" THEN "Farmasi Ralan" ELSE "Farmasi Ranap" END as unitName'),
                            db.raw('NULL as performerName'), db.raw('NULL as secondaryPerformerName'),
                            't.no_rawat', 'reg.no_rkm_medis', 'p.nm_pasien',
                            db.raw('t.kode_brng as kd_jenis_prw'),
                            db.raw('t.tgl_perawatan as tgl_perawatan'), db.raw('t.jam as jam_rawat'),
                            'pj.png_jawab as caraBayar',
                            db.raw('0 as jasaSarana'), db.raw('0 as paketBHP'),
                            db.raw('0 as jmDokter'), db.raw('0 as jmPetugas'),
                            db.raw('0 as kso'), db.raw('0 as menejemen'),
                            db.raw('t.biaya_obat as biaya_obat'),
                            db.raw('t.jml as jml'),
                            db.raw('t.embalase as embalase'),
                            db.raw('t.tuslah as tuslah'),
                            't.total as total', db.raw("'farmasi' as source")
                        ).where(db.raw(`DATE(t.tgl_perawatan)`), 'between', [startDate, endDate])
                        .modify((q) => {
                            if (params.search) q.where(function () {
                                this.where('p.nm_pasien', 'like', `%${params.search}%`).orWhere('reg.no_rkm_medis', 'like', `%${params.search}%`)
                                    .orWhere('t.no_rawat', 'like', `%${params.search}%`).orWhere('jns.nama_brng', 'like', `%${params.search}%`);
                            });
                        });
                }

                // Handle Custom: Tambahan/Potongan
                if (cat === 'tambahan' || cat === 'potongan') {
                    const nameCol = cat === 'tambahan' ? 'nama_biaya' : 'nama_pengurangan';
                    const priceCol = cat === 'tambahan' ? 'besar_biaya' : 'besar_pengurangan';
                    return db(table + ' as t')
                        .join('reg_periksa as reg', 't.no_rawat', 'reg.no_rawat')
                        .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                        .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj')
                        .select(
                            db.raw(`t.${nameCol} as nm_perawatan`), db.raw(`'${cat.toUpperCase()}' as unitName`),
                            db.raw('NULL as performerName'), db.raw('NULL as secondaryPerformerName'),
                            't.no_rawat', 'reg.no_rkm_medis', 'p.nm_pasien',
                            db.raw(`'${cat.toUpperCase()}' as kd_jenis_prw`),
                            db.raw('reg.tgl_registrasi as tgl_perawatan'), db.raw("'00:00:00' as jam_rawat"),
                            'pj.png_jawab as caraBayar',
                            db.raw('0 as jasaSarana'), db.raw('0 as paketBHP'),
                            db.raw('0 as jmDokter'), db.raw('0 as jmPetugas'),
                            db.raw('0 as kso'), db.raw('0 as menejemen'),
                            db.raw('NULL as biaya_obat'), db.raw('NULL as jml'),
                            db.raw('NULL as embalase'), db.raw('NULL as tuslah'),
                            db.raw(`t.${priceCol} ${cat === 'potongan' ? '* -1' : ''} as total`),
                            db.raw(`'${cat}' as source`)
                        ).whereBetween('reg.tgl_registrasi', [startDate, endDate])
                        .modify((q) => {
                            if (params.search) q.where(function () {
                                this.where('p.nm_pasien', 'like', `%${params.search}%`).orWhere('reg.no_rkm_medis', 'like', `%${params.search}%`)
                                    .orWhere('t.no_rawat', 'like', `%${params.search}%`).orWhere(`${cat === 'tambahan' ? 't.nama_biaya' : 't.nama_pengurangan'}`, 'like', `%${params.search}%`);
                            });
                        });
                }

                // General Treatment Handler
                const q = db(table + ' as t')
                    .join('reg_periksa as reg', 't.no_rawat', 'reg.no_rawat')
                    .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                    .join('penjab as pj', 'reg.kd_pj', 'pj.kd_pj');

                // Master Join
                const tCode = code || 't.kd_jenis_prw';
                const mCode = masterCode || 'jns.kd_jenis_prw';
                const mName = name || 'jns.nm_perawatan';
                q.leftJoin(`${master} as jns`, tCode, mCode)
                    .select(db.raw(`COALESCE(${mName}, "Tindakan") as nm_perawatan`));

                // Unit/Location Join
                if (type === 'ralan') {
                    q.leftJoin('poliklinik as pol', 'reg.kd_poli', 'pol.kd_poli')
                        .select(db.raw('COALESCE(pol.nm_poli, "Ralan") as unitName'));
                } else if (type === 'ranap') {
                    q.leftJoin('kamar_inap as ki', 'reg.no_rawat', 'ki.no_rawat')
                        .leftJoin('kamar as km', 'ki.kd_kamar', 'km.kd_kamar')
                        .leftJoin('bangsal as b', 'km.kd_bangsal', 'b.kd_bangsal')
                        .select(db.raw('COALESCE(b.nm_bangsal, "Ranap") as unitName'));
                } else {
                    q.select(db.raw('CASE WHEN reg.kd_poli != "-" THEN "Penunjang Ralan" ELSE "Penunjang Ranap" END as unitName'));
                }

                // Performers Join
                if (performer === 'dr') {
                    q.leftJoin('dokter as d', 't.kd_dokter', 'd.kd_dokter').select(db.raw('COALESCE(d.nm_dokter, "-") as performerName'), db.raw('NULL as secondaryPerformerName'));
                } else if (performer === 'pr') {
                    q.leftJoin('petugas as pt', 't.nip', 'pt.nip').select(db.raw('COALESCE(pt.nama, "-") as performerName'), db.raw('NULL as secondaryPerformerName'));
                } else if (performer === 'drpr') {
                    q.leftJoin('dokter as d', 't.kd_dokter', 'd.kd_dokter').leftJoin('petugas as pt', 't.nip', 'pt.nip')
                        .select(db.raw('COALESCE(d.nm_dokter, "-") as performerName'), db.raw('COALESCE(pt.nama, "-") as secondaryPerformerName'));
                } else if (performer === 'special') {
                    if (table === 'operasi') {
                        q.leftJoin('dokter as d', 't.operator1', 'd.kd_dokter').select(db.raw('COALESCE(d.nm_dokter, "-") as performerName'), db.raw('NULL as secondaryPerformerName'));
                    } else if (table === 'periksa_radiologi' || table === 'periksa_lab' || table === 'periksa_utd') {
                        q.leftJoin('dokter as d', 't.kd_dokter', 'd.kd_dokter').leftJoin('petugas as pt', 't.nip', 'pt.nip')
                            .select(db.raw('COALESCE(d.nm_dokter, "-") as performerName'), db.raw('COALESCE(pt.nama, "-") as secondaryPerformerName'));
                    } else if (table === 'detail_periksa_lab') {
                        q.leftJoin('periksa_lab as pl', function () {
                            this.on('t.no_rawat', '=', 'pl.no_rawat').andOn('t.kd_jenis_prw', '=', 'pl.kd_jenis_prw').andOn('t.tgl_periksa', '=', 'pl.tgl_periksa').andOn('t.jam', '=', 'pl.jam')
                        }).leftJoin('dokter as d', 'pl.kd_dokter', 'd.kd_dokter').leftJoin('petugas as pt', 'pl.nip', 'pt.nip')
                            .select(db.raw('COALESCE(d.nm_dokter, "-") as performerName'), db.raw('COALESCE(pt.nama, "-") as secondaryPerformerName'));
                    }
                }

                // Dates & Costs Mapping
                const dF = date || 't.tgl_perawatan';
                const tF = time || 't.jam_rawat';
                let sarana = ['periksa_radiologi', 'periksa_lab', 'detail_periksa_lab', 'periksa_utd', 'operasi'].includes(table) ? 't.bagian_rs' : 't.material';
                let bhp = 't.bhp', kso = 't.kso', mnj = 't.menejemen', dr = '0', pr = '0', tot: any = 't.biaya_rawat';

                if (table === 'operasi') {
                    bhp = kso = mnj = '0'; dr = 't.biayaoperator1'; pr = 't.biayabidan';
                    tot = db.raw(`(COALESCE(t.biayaoperator1,0) + COALESCE(t.biayaoperator2,0) + COALESCE(t.biayaoperator3,0) + COALESCE(t.biayaasisten_operator1,0) + COALESCE(t.biayaasisten_operator2,0) + COALESCE(t.biayaasisten_operator3,0) + COALESCE(t.biayainstrumen,0) + COALESCE(t.biayadokter_anak,0) + COALESCE(t.biayaperawaat_resusitas,0) + COALESCE(t.biayadokter_anestesi,0) + COALESCE(t.biayaasisten_anestesi,0) + COALESCE(t.biayaasisten_anestesi2,0) + COALESCE(t.biayabidan,0) + COALESCE(t.biayabidan2,0) + COALESCE(t.biayabidan3,0) + COALESCE(t.biayaperawat_luar,0) + COALESCE(t.biayaalat,0) + COALESCE(t.biayasewaok,0) + COALESCE(t.akomodasi,0) + COALESCE(t.bagian_rs,0) + COALESCE(t.biaya_omloop,0) + COALESCE(t.biaya_omloop2,0) + COALESCE(t.biaya_omloop3,0) + COALESCE(t.biaya_omloop4,0) + COALESCE(t.biaya_omloop5,0) + COALESCE(t.biayasarpras,0) + COALESCE(t.biaya_dokter_pjanak,0) + COALESCE(t.biaya_dokter_umum,0))`);
                } else if (table === 'detail_periksa_lab') {
                    dr = 't.bagian_dokter'; pr = 't.bagian_laborat'; tot = 't.biaya_item';
                } else if (table === 'periksa_radiologi' || table === 'periksa_lab' || table === 'periksa_utd') {
                    dr = 't.tarif_tindakan_dokter'; pr = 't.tarif_tindakan_petugas'; tot = 't.biaya';
                } else {
                    if (performer === 'dr') dr = 't.tarif_tindakandr';
                    else if (performer === 'pr') pr = 't.tarif_tindakanpr';
                    else if (performer === 'drpr') { dr = 't.tarif_tindakandr'; pr = 't.tarif_tindakanpr'; }
                }

                return q.select(
                    't.no_rawat', 'reg.no_rkm_medis', 'p.nm_pasien',
                    db.raw(`${tCode} as kd_jenis_prw`), db.raw(`${dF} as tgl_perawatan`), db.raw(`${typeof tF === 'string' ? tF : tF.toString()} as jam_rawat`),
                    'pj.png_jawab as caraBayar', db.raw(`COALESCE(${sarana}, 0) as jasaSarana`),
                    db.raw(`COALESCE(${bhp}, 0) as paketBHP`), db.raw(`COALESCE(${dr}, 0) as jmDokter`),
                    db.raw(`COALESCE(${pr}, 0) as jmPetugas`), db.raw(`COALESCE(${kso}, 0) as kso`),
                    db.raw(`COALESCE(${mnj}, 0) as menejemen`),
                    db.raw('NULL as biaya_obat'), db.raw('NULL as jml'),
                    db.raw('NULL as embalase'), db.raw('NULL as tuslah'),
                    db.raw(`${tot} as total`), db.raw(`'${table}' as source`)
                ).where(db.raw(`DATE(${dF})`), 'between', [startDate, endDate])
                    .modify((q) => {
                        if (params.search) q.where(function () {
                            this.where('p.nm_pasien', 'like', `%${params.search}%`)
                                .orWhere('reg.no_rkm_medis', 'like', `%${params.search}%`)
                                .orWhere('t.no_rawat', 'like', `%${params.search}%`)
                                .orWhere(mName, 'like', `%${params.search}%`);
                        });
                    });
            };

            let filteredConfigs = category === 'all' ? this.TREATMENT_REGISTRY : this.TREATMENT_REGISTRY.filter(c => c.cat === category);

            // Special case for UTD: if cat is empty or standard, include blood-related items from other categories
            const bloodKeywords = ['DARAH', 'UTD', 'TRANSFUSI', 'KROSCEK', 'CROSSMATCH', 'GOLONGAN'];

            if (category === 'utd') {
                // If UTD table is empty (common in some installs), we pull from Lab, Ralan, and Ranap where name contains blood keywords
                const relevantSources = this.TREATMENT_REGISTRY.filter(c =>
                    ['ralan', 'ranap', 'laborat', 'utd'].includes(c.cat)
                );

                const queries = relevantSources.map(config => {
                    const q = getQueryFromConfig(config);
                    // Add mandatory blood keyword filter for non-utd tables
                    if (config.cat !== 'utd') {
                        const mName = config.name || 'jns.nm_perawatan';
                        q.where(function () {
                            bloodKeywords.forEach(kw => this.orWhere(mName, 'like', `%${kw}%`));
                        });
                    }
                    return q;
                });

                const unionQuery = queries[0];
                if (queries.length > 1) {
                    queries.slice(1).forEach(q => unionQuery.unionAll(q));
                }

                const results = await db.select('*').from(unionQuery.as('u'))
                    .orderBy('tgl_perawatan', 'desc').orderBy('jam_rawat', 'desc')
                    .limit(limit).offset(offset);

                const countResult = await db.from(unionQuery.as('u')).count('* as total').first();
                const summaryResult = await db.from(unionQuery.as('u'))
                    .select(
                        db.raw('SUM(jasaSarana) as totalSarana'),
                        db.raw('SUM(paketBHP) as totalBHP'),
                        db.raw('SUM(jmDokter) as totalDR'),
                        db.raw('SUM(jmPetugas) as totalPR'),
                        db.raw('SUM(kso) as totalKSO'),
                        db.raw('SUM(menejemen) as totalMNJ'),
                        db.raw('SUM(total) as totalAll')
                    ).first();

                return this.formatReportResponse(results, countResult, summaryResult, limit, offset);
            }

            if (filteredConfigs.length === 0) return { data: [], total: 0, limit, offset };

            const unionQuery = getQueryFromConfig(filteredConfigs[0]);
            if (filteredConfigs.length > 1) {
                unionQuery.unionAll(filteredConfigs.slice(1).map(c => getQueryFromConfig(c)));
            }

            const results = await db.select('*').from(unionQuery.as('u'))
                .orderBy('tgl_perawatan', 'desc').orderBy('jam_rawat', 'desc')
                .limit(limit).offset(offset);

            const countResult = await db.from(unionQuery.as('u')).count('* as total').first();
            const summaryResult = await db.from(unionQuery.as('u'))
                .select(
                    db.raw('SUM(jasaSarana) as totalSarana'),
                    db.raw('SUM(paketBHP) as totalBHP'),
                    db.raw('SUM(jmDokter) as totalDR'),
                    db.raw('SUM(jmPetugas) as totalPR'),
                    db.raw('SUM(kso) as totalKSO'),
                    db.raw('SUM(menejemen) as totalMNJ'),
                    db.raw('SUM(total) as totalAll')
                ).first();

            return this.formatReportResponse(results, countResult, summaryResult, limit, offset);
        } catch (error) {
            this.logger.error(`Error fetching treatment details: ${error}`);
            throw error;
        }
    }

    private formatReportResponse(results: any[], countResult: any, summaryResult: any, limit: number, offset: number) {
        return {
            data: (results as any[]).map(r => ({
                ...r,
                jasaSarana: Number(r.jasaSarana), paketBHP: Number(r.paketBHP), jmDokter: Number(r.jmDokter),
                jmPetugas: Number(r.jmPetugas), kso: Number(r.kso), mnj: Number(r.menejemen),
                menejemen: Number(r.menejemen), total: Number(r.total)
            })),
            total: Number((countResult as any)?.total || 0),
            summary: {
                jasaSarana: Number((summaryResult as any)?.totalSarana || 0),
                paketBHP: Number((summaryResult as any)?.totalBHP || 0),
                jmDokter: Number((summaryResult as any)?.totalDR || 0),
                jmPetugas: Number((summaryResult as any)?.totalPR || 0),
                kso: Number((summaryResult as any)?.totalKSO || 0),
                menejemen: Number((summaryResult as any)?.totalMNJ || 0),
                total: Number((summaryResult as any)?.totalAll || 0)
            },
            limit, offset
        };
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
                current: {
                    revenue: currentData.revenue,
                    expenses: currentData.expenses,
                    drugProfit: currentData.drugProfit,
                    transactions: currentData.transactions,
                    netIncome: currentData.netIncome,
                    startDate: current.startDate,
                    endDate: current.endDate,
                },
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
