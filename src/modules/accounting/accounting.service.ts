import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../../infra/database/khanza/khanza-db.service';

@Injectable()
export class AccountingService {
    private readonly logger = new Logger(AccountingService.name);

    constructor(private readonly khanzaDB: KhanzaDBService) { }

    async getDailyJournal(startDate: string, endDate: string, page: number = 1, limit: number = 50) {
        try {
            const db = this.khanzaDB.db;
            const offset = (page - 1) * limit;

            // Get total count of unique journals
            const countResult = await db('jurnal as j')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .count('* as total')
                .first();
            const totalJournals = Number((countResult as any)?.total) || 0;

            // Get paginated journal numbers
            const journalNumbers = await db('jurnal as j')
                .select('j.no_jurnal')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .orderBy('j.tgl_jurnal', 'asc')
                .orderBy('j.jam_jurnal', 'asc')
                .offset(offset)
                .limit(limit);

            if (journalNumbers.length === 0) {
                return { data: [], pagination: { page, limit, total: totalJournals, totalPages: Math.ceil(totalJournals / limit) } };
            }

            const jnos = journalNumbers.map((j: any) => j.no_jurnal);

            const results = await db('jurnal as j')
                .select(
                    'j.no_jurnal',
                    'j.no_bukti',
                    'j.tgl_jurnal',
                    'j.jam_jurnal',
                    'j.keterangan',
                    'dj.kd_rek',
                    'r.nm_rek',
                    'dj.debet',
                    'dj.kredit'
                )
                .join('detailjurnal as dj', 'j.no_jurnal', 'dj.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .whereIn('j.no_jurnal', jnos)
                .orderBy('j.tgl_jurnal', 'asc')
                .orderBy('j.jam_jurnal', 'asc')
                .orderBy('j.no_jurnal', 'asc');

            // Group by no_jurnal
            const grouped = results.reduce((acc: any, curr: any) => {
                if (!acc[curr.no_jurnal]) {
                    acc[curr.no_jurnal] = {
                        no_jurnal: curr.no_jurnal,
                        no_bukti: curr.no_bukti,
                        tgl_jurnal: curr.tgl_jurnal,
                        jam_jurnal: curr.jam_jurnal,
                        keterangan: curr.keterangan,
                        details: []
                    };
                }
                acc[curr.no_jurnal].details.push({
                    kd_rek: curr.kd_rek,
                    nm_rek: curr.nm_rek,
                    debet: curr.debet,
                    kredit: curr.kredit
                });
                return acc;
            }, {});

            return {
                data: Object.values(grouped),
                pagination: {
                    page,
                    limit,
                    total: totalJournals,
                    totalPages: Math.ceil(totalJournals / limit)
                }
            };
        } catch (error) {
            this.logger.error('Error fetching daily journal', error);
            throw error;
        }
    }

    async getGeneralLedger(kd_rek: string, startDate: string, endDate: string) {
        try {
            const db = this.khanzaDB.db;

            // Get account info
            const accountInfo = await db('rekening')
                .where('kd_rek', kd_rek)
                .select('kd_rek', 'nm_rek', 'tipe', 'balance')
                .first();

            const balanceType = (accountInfo as any)?.balance || 'D';

            // Get initial balance before startDate
            const initialBalance = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .select(
                    db.raw('SUM(dj.debet) as total_debet'),
                    db.raw('SUM(dj.kredit) as total_kredit'),
                )
                .where('dj.kd_rek', kd_rek)
                .where('j.tgl_jurnal', '<', startDate)
                .first();

            let openingBalance = 0;
            if (initialBalance) {
                if (balanceType === 'D') {
                    openingBalance = ((initialBalance as any).total_debet || 0) - ((initialBalance as any).total_kredit || 0);
                } else {
                    openingBalance = ((initialBalance as any).total_kredit || 0) - ((initialBalance as any).total_debet || 0);
                }
            }

            const entries = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .select(
                    'j.tgl_jurnal',
                    'j.no_jurnal',
                    'j.no_bukti',
                    'j.keterangan',
                    'dj.debet',
                    'dj.kredit'
                )
                .where('dj.kd_rek', kd_rek)
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .orderBy('j.tgl_jurnal', 'asc')
                .orderBy('j.jam_jurnal', 'asc');

            // Calculate running balance
            let runningBalance = openingBalance;
            const entriesWithBalance = entries.map((entry: any) => {
                const debet = Number(entry.debet) || 0;
                const kredit = Number(entry.kredit) || 0;
                if (balanceType === 'D') {
                    runningBalance += debet - kredit;
                } else {
                    runningBalance += kredit - debet;
                }
                return {
                    tgl_jurnal: entry.tgl_jurnal,
                    no_jurnal: entry.no_jurnal,
                    no_bukti: entry.no_bukti,
                    keterangan: entry.keterangan,
                    debet,
                    kredit,
                    saldo: runningBalance
                };
            });

            return {
                account: accountInfo || { kd_rek, nm_rek: '-', tipe: '-', balance: 'D' },
                initial_balance: openingBalance,
                closing_balance: runningBalance,
                entries: entriesWithBalance
            };
        } catch (error) {
            this.logger.error('Error fetching general ledger', error);
            throw error;
        }
    }

    async getAccounts() {
        return this.khanzaDB.db('rekening').select('kd_rek', 'nm_rek', 'tipe', 'balance').orderBy('kd_rek', 'asc');
    }

    async getProfitLoss(startDate: string, endDate: string) {
        try {
            const db = this.khanzaDB.db;

            const accounts = await db('rekening as r')
                .leftJoin(db.raw('(SELECT dj.kd_rek, SUM(dj.debet) as total_debet, SUM(dj.kredit) as total_kredit FROM detailjurnal dj JOIN jurnal j ON dj.no_jurnal = j.no_jurnal WHERE j.tgl_jurnal BETWEEN ? AND ? GROUP BY dj.kd_rek) as flows', [startDate, endDate]), 'r.kd_rek', 'flows.kd_rek')
                .select(
                    'r.kd_rek',
                    'r.nm_rek',
                    'r.tipe',
                    'r.balance',
                    db.raw('COALESCE(flows.total_debet, 0) as debet'),
                    db.raw('COALESCE(flows.total_kredit, 0) as kredit')
                )
                .where('r.tipe', 'R')
                .orderBy('r.kd_rek', 'asc');

            return accounts.map((acc: any) => {
                let amount = 0;
                if (acc.balance === 'D') {
                    amount = acc.debet - acc.kredit;
                } else {
                    amount = acc.kredit - acc.debet;
                }
                return {
                    kd_rek: acc.kd_rek,
                    nm_rek: acc.nm_rek,
                    amount: amount,
                    category: acc.kd_rek.startsWith('4') ? 'PENDAPATAN' : 'BEBAN'
                };
            });
        } catch (error) {
            this.logger.error('Error calculating profit loss', error);
            throw error;
        }
    }

    async getBalanceSheet(endDate: string) {
        try {
            const db = this.khanzaDB.db;

            const accounts = await db('rekening as r')
                .leftJoin(db.raw('(SELECT dj.kd_rek, SUM(dj.debet) as total_debet, SUM(dj.kredit) as total_kredit FROM detailjurnal dj JOIN jurnal j ON dj.no_jurnal = j.no_jurnal WHERE j.tgl_jurnal <= ? GROUP BY dj.kd_rek) as balances', [endDate]), 'r.kd_rek', 'balances.kd_rek')
                .select(
                    'r.kd_rek',
                    'r.nm_rek',
                    'r.tipe',
                    'r.balance',
                    db.raw('COALESCE(balances.total_debet, 0) as debet'),
                    db.raw('COALESCE(balances.total_kredit, 0) as kredit')
                )
                .whereIn('r.tipe', ['N', 'M'])
                .orderBy('r.kd_rek', 'asc');

            return accounts.map((acc: any) => {
                let amount = 0;
                if (acc.balance === 'D') {
                    amount = acc.debet - acc.kredit;
                } else {
                    amount = acc.kredit - acc.debet;
                }

                let category = 'LAINNYA';
                if (acc.kd_rek.startsWith('1')) category = 'ASET';
                else if (acc.kd_rek.startsWith('2')) category = 'KEWAJIBAN';
                else if (acc.kd_rek.startsWith('3')) category = 'MODAL';

                return {
                    kd_rek: acc.kd_rek,
                    nm_rek: acc.nm_rek,
                    amount: amount,
                    category: category
                };
            });
        } catch (error) {
            this.logger.error('Error calculating balance sheet', error);
            throw error;
        }
    }

    async getCashFlowStatement(startDate: string, endDate: string) {
        try {
            const db = this.khanzaDB.db;

            // Cash flow from operations: revenue receipts minus operational expenses
            // Using kas/bank accounts (typically prefix 1.1) and linking to journal entries
            const operatingInflows = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .where('r.kd_rek', 'like', '4%') // Revenue accounts
                .select(db.raw('SUM(CASE WHEN r.balance = "K" THEN dj.kredit - dj.debet ELSE dj.debet - dj.kredit END) as total'))
                .first();

            const operatingOutflows = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .where(function () {
                    this.where('r.kd_rek', 'like', '5%').orWhere('r.kd_rek', 'like', '6%');
                })
                .select(db.raw('SUM(CASE WHEN r.balance = "D" THEN dj.debet - dj.kredit ELSE dj.kredit - dj.debet END) as total'))
                .first();

            // Cash flow from investing: fixed assets (typically prefix 1.2 or 1.3)
            const investingCashFlow = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .where(function () {
                    this.where('r.kd_rek', 'like', '1.2%')
                        .orWhere('r.kd_rek', 'like', '1.3%')
                        .orWhere('r.kd_rek', 'like', '1.4%')
                        .orWhere('r.kd_rek', 'like', '1.5%');
                })
                .select(db.raw('SUM(dj.kredit - dj.debet) as total'))
                .first();

            // Cash flow from financing: debt / equity (prefix 2 and 3)
            const financingCashFlow = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .where(function () {
                    this.where('r.kd_rek', 'like', '2%').orWhere('r.kd_rek', 'like', '3%');
                })
                .select(db.raw('SUM(CASE WHEN r.balance = "K" THEN dj.kredit - dj.debet ELSE dj.debet - dj.kredit END) as total'))
                .first();

            // Get cash opening balance (kas & bank, typically 1.1.x)
            const cashOpening = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .where('j.tgl_jurnal', '<', startDate)
                .where('r.kd_rek', 'like', '1.1%')
                .select(db.raw('SUM(dj.debet - dj.kredit) as total'))
                .first();

            const operasi = (Number((operatingInflows as any)?.total) || 0) - (Number((operatingOutflows as any)?.total) || 0);
            const investasi = Number((investingCashFlow as any)?.total) || 0;
            const pendanaan = Number((financingCashFlow as any)?.total) || 0;
            const saldoAwal = Number((cashOpening as any)?.total) || 0;

            return {
                operating: {
                    inflows: Number((operatingInflows as any)?.total) || 0,
                    outflows: Number((operatingOutflows as any)?.total) || 0,
                    net: operasi
                },
                investing: {
                    net: investasi
                },
                financing: {
                    net: pendanaan
                },
                openingCash: saldoAwal,
                netChange: operasi + investasi + pendanaan,
                closingCash: saldoAwal + operasi + investasi + pendanaan
            };
        } catch (error) {
            this.logger.error('Error calculating cash flow statement', error);
            return {
                operating: { inflows: 0, outflows: 0, net: 0 },
                investing: { net: 0 },
                financing: { net: 0 },
                openingCash: 0,
                netChange: 0,
                closingCash: 0
            };
        }
    }

    async getOpeningEquity(startDate: string) {
        try {
            const db = this.khanzaDB.db;

            const result = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .where('j.tgl_jurnal', '<', startDate)
                .where('r.kd_rek', 'like', '3%')
                .select(
                    db.raw('SUM(CASE WHEN r.balance = "K" THEN dj.kredit - dj.debet ELSE dj.debet - dj.kredit END) as total')
                )
                .first();

            return {
                openingEquity: Number((result as any)?.total) || 0
            };
        } catch (error) {
            this.logger.error('Error calculating opening equity', error);
            return { openingEquity: 0 };
        }
    }
}
