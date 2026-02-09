import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../../infra/database/khanza/khanza-db.service';

@Injectable()
export class AccountingService {
    private readonly logger = new Logger(AccountingService.name);

    constructor(private readonly khanzaDB: KhanzaDBService) { }

    async getDailyJournal(startDate: string, endDate: string) {
        try {
            const db = this.khanzaDB.db;
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
                .whereBetween('j.tgl_jurnal', [startDate, endDate])
                .orderBy('j.tgl_jurnal', 'asc')
                .orderBy('j.jam_jurnal', 'asc')
                .orderBy('j.no_jurnal', 'asc');

            // Group by no_jurnal for better frontend display
            const grouped = results.reduce((acc, curr) => {
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

            return Object.values(grouped);
        } catch (error) {
            this.logger.error('Error fetching daily journal', error);
            throw error;
        }
    }

    async getGeneralLedger(kd_rek: string, startDate: string, endDate: string) {
        try {
            const db = this.khanzaDB.db;

            // Get initial balance before startDate
            const initialBalance = await db('detailjurnal as dj')
                .join('jurnal as j', 'dj.no_jurnal', 'j.no_jurnal')
                .join('rekening as r', 'dj.kd_rek', 'r.kd_rek')
                .select(
                    db.raw('SUM(dj.debet) as total_debet'),
                    db.raw('SUM(dj.kredit) as total_kredit'),
                    'r.balance'
                )
                .where('dj.kd_rek', kd_rek)
                .where('j.tgl_jurnal', '<', startDate)
                .groupBy('r.balance')
                .first();

            let balance = 0;
            if (initialBalance) {
                if (initialBalance.balance === 'D') {
                    balance = (initialBalance.total_debet || 0) - (initialBalance.total_kredit || 0);
                } else {
                    balance = (initialBalance.total_kredit || 0) - (initialBalance.total_debet || 0);
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

            const result = entries.map(entry => {
                const rowDebet = entry.debet || 0;
                const rowKredit = entry.kredit || 0;

                // Assuming we need to know the account balance type to calculate running balance correctly
                // For simplicity, we'll return debet/kredit and let frontend handle the specific ledger view
                return {
                    ...entry,
                    current_balance: balance // This is just the starting, not real running balance yet
                };
            });

            return {
                initial_balance: balance,
                entries: entries
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

            // Tipe 'R' is for Rugi Laba
            // Usually: 4=Pendapatan, 5=Beban, 6=Beban Lainnya
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

            return accounts.map(acc => {
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

            // Tipe 'N' is for Neraca
            // Usually: 1=Aset, 2=Kewajiban, 3=Modal
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

            return accounts.map(acc => {
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
}
