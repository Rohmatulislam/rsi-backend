import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class KhanzaRehabilitationService {
    private readonly logger = new Logger(KhanzaRehabilitationService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mendapatkan progres rehabilitasi medik pasien
     * @param identifier No. Rawat atau No. RM
     */
    async getRehabProgress(identifier: string) {
        try {
            const db = this.dbService.db;

            // 1. Ambil data layanan rehab terbaru
            const rehab = await db('layanan_kedokteran_fisik_rehabilitasi as l')
                .select(
                    'l.no_rawat',
                    'l.tanggal',
                    'l.diagnosa_medis',
                    'l.tatalaksana',
                    'l.evaluasi',
                    'l.status_program',
                    'p.nm_pasien',
                    'p.no_rkm_medis',
                    'd.nm_dokter'
                )
                .join('reg_periksa as reg', 'l.no_rawat', 'reg.no_rawat')
                .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                .join('dokter as d', 'l.kd_dokter', 'd.kd_dokter')
                .where('l.no_rawat', identifier)
                .orWhere('p.no_rkm_medis', identifier)
                .orderBy('l.tanggal', 'desc')
                .first();

            if (!rehab) {
                return null;
            }

            // 2. Ambil catatan program tindakan
            const programs = await db('catatan_program_tindakan_rehabilitasi')
                .where('no_rawat', rehab.no_rawat)
                .orderBy('tanggal', 'asc');

            return {
                no_rawat: rehab.no_rawat,
                no_rm: rehab.no_rkm_medis,
                nama_pasien: rehab.nm_pasien,
                dokter: rehab.nm_dokter,
                tanggal_terakhir: rehab.tanggal,
                diagnosa: rehab.diagnosa_medis,
                tatalaksana: rehab.tatalaksana,
                evaluasi: rehab.evaluasi,
                status_program: rehab.status_program,
                programs: programs.map(p => ({
                    tanggal: p.tanggal,
                    program: p.program,
                    keterangan: p.keterangan || '-'
                }))
            };
        } catch (error) {
            this.logger.error('Error fetching rehab progress from Khanza', error);
            throw error;
        }
    }

    /**
     * Mendapatkan daftar terapi rehabilitasi medik dari Khanza
     * Tabel: jns_perawatan
     */
    async getRehabTherapies() {
        try {
            const db = this.dbService.db;
            return await db('jns_perawatan')
                .select(
                    'kd_jenis_prw as id',
                    'nm_perawatan as name',
                    'total_byrdr as price',
                    'kd_kategori as category'
                )
                .where('status', '1')
                .andWhere('kd_poli', 'U01') // Biasanya U01 adalah poli rehab/fisioterapi di Khanza
                .orWhere('nm_perawatan', 'like', '%Fisioterapi%')
                .orWhere('nm_perawatan', 'like', '%Terapi Wicara%')
                .orWhere('nm_perawatan', 'like', '%Terapi Okupasi%')
                .limit(100);
        } catch (error) {
            this.logger.error('Error fetching rehab therapies from Khanza', error);
            return [];
        }
    }

    /**
     * Mendapatkan daftar dokter spesialis KFR
     */
    async getRehabDoctors() {
        try {
            const db = this.dbService.db;
            return await db('dokter as d')
                .join('spesialis as s', 'd.kd_sps', 's.kd_sps')
                .select(
                    'd.kd_dokter as id',
                    'd.nm_dokter as name',
                    's.nm_sps as specialization'
                )
                .where('d.status', '1')
                .andWhere('s.nm_sps', 'like', '%Kedokteran Fisik%')
                .orWhere('s.nm_sps', 'like', '%Rehabilitasi%');
        } catch (error) {
            this.logger.error('Error fetching rehab doctors from Khanza', error);
            return [];
        }
    }
}
