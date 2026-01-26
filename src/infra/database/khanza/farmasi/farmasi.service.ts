import { Injectable, Logger } from '@nestjs/common';
import { KhanzaDBService } from '../khanza-db.service';

@Injectable()
export class KhanzaFarmasiService {
    private readonly logger = new Logger(KhanzaFarmasiService.name);

    constructor(private readonly dbService: KhanzaDBService) { }

    /**
     * Mendapatkan status resep obat berdasarkan No. Resep atau No. Rawat
     * @param identifier No. Resep atau No. Rawat atau No. RM
     */
    async getPrescriptionStatus(identifier: string) {
        try {
            const db = this.dbService.db;

            // 1. Cari di resep_obat
            const resep = await db('resep_obat as r')
                .select(
                    'r.no_resep',
                    'r.no_rawat',
                    'r.tgl_perawatan',
                    'r.jam',
                    'r.status as tipe_layanan',
                    'r.tgl_penyerahan',
                    'r.jam_penyerahan',
                    'p.nm_pasien',
                    'p.no_rkm_medis',
                    'd.nm_dokter'
                )
                .join('reg_periksa as reg', 'r.no_rawat', 'reg.no_rawat')
                .join('pasien as p', 'reg.no_rkm_medis', 'p.no_rkm_medis')
                .join('dokter as d', 'r.kd_dokter', 'd.kd_dokter')
                .where('r.no_resep', identifier)
                .orWhere('r.no_rawat', identifier)
                .orWhere('p.no_rkm_medis', identifier)
                .orderBy('r.tgl_perawatan', 'desc')
                .orderBy('r.jam', 'desc')
                .first();

            if (!resep) {
                return null;
            }

            // 2. Tentukan status
            // Standard Khanza: Jika tgl_penyerahan sudah terisi, berarti sudah selesai
            let status = 'MENUNGGU'; // Default
            let statusLabel = 'Dalam Antrean';

            if (resep.tgl_penyerahan && resep.tgl_penyerahan !== '0000-00-00') {
                status = 'SELESAI';
                statusLabel = 'Siap Diambil / Sudah Diserahkan';
            } else {
                // Cek apakah sudah ada pemberian obat (artinya sedang diproses/diracik)
                const isProcessing = await db('detail_pemberian_obat')
                    .where('no_rawat', resep.no_rawat)
                    .first();

                if (isProcessing) {
                    status = 'PROSES';
                    statusLabel = 'Sedang Dirack / Disiapkan';
                }
            }

            return {
                no_resep: resep.no_resep,
                no_rawat: resep.no_rawat,
                no_rm: resep.no_rkm_medis,
                nama_pasien: resep.nm_pasien,
                dokter: resep.nm_dokter,
                tanggal: resep.tgl_perawatan,
                jam: resep.jam,
                status,
                status_label: statusLabel,
                tgl_penyerahan: resep.tgl_penyerahan,
                jam_penyerahan: resep.jam_penyerahan
            };

        } catch (error) {
            this.logger.error('Error fetching prescription status from Khanza', error);
            throw error;
        }
    }

    /**
     * Mencari data barang/obat dan stoknya
     */
    async searchMedicines(query: string) {
        try {
            const db = this.dbService.db;
            return await db('databarang as d')
                .select(
                    'd.kode_brng as id',
                    'd.nama_brng as name',
                    'd.ralan as price',
                    'd.kode_sat as unit',
                    'k.nama as category',
                    db.raw('SUM(g.stok) as total_stock')
                )
                .leftJoin('kodesatuan as s', 'd.kode_sat', 's.kode_sat')
                .leftJoin('kategori_barang as k', 'd.kode_kategori', 'k.kode')
                .leftJoin('gudangbarang as g', 'd.kode_brng', 'g.kode_brng')
                .where('d.status', '1')
                .andWhere('d.nama_brng', 'like', `%${query}%`)
                .groupBy('d.kode_brng')
                .limit(50);
        } catch (error) {
            this.logger.error('Error searching medicines in Khanza', error);
            return [];
        }
    }
}
