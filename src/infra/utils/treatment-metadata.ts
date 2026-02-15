export interface TreatmentMetadata {
    description: string;
    preparation?: string[];
    estimatedTime?: string;
    isPopular?: boolean;
}

export const LAB_METADATA: Record<string, TreatmentMetadata> = {
    // Gula Darah - Contoh Kode SIMRS (KD_JENIS_PRW)
    'PR00001': {
        description: 'Pemeriksaan kadar glukosa dalam darah setelah berpuasa untuk mendeteksi diabetes.',
        preparation: ['Puasa 8-10 jam (hanya boleh minum air putih)', 'Informasikan obat-obatan yang sedang dikonsumsi'],
        estimatedTime: '60 - 90 menit',
        isPopular: true,
    },
    'PR00002': {
        description: 'Pemeriksaan kadar glukosa darah 2 jam setelah makan untuk melihat respon tubuh terhadap gula.',
        preparation: ['Dilakukan 2 jam setelah makan besar/beban glukosa'],
        estimatedTime: '120 menit',
    },
    'PR00010': {
        description: 'Cek kadar lemak total dalam darah untuk memantau risiko penyakit kardiovaskular.',
        preparation: ['Puasa 10-12 jam'],
        estimatedTime: '60 menit',
        isPopular: true,
    },
};

export const RADIO_METADATA: Record<string, TreatmentMetadata> = {
    // Thorax
    'PR00200': {
        description: 'Rontgen dada untuk mengevaluasi kondisi jantung, paru-paru, dan tulang rusuk.',
        preparation: ['Lepas perhiasan dan benda logam di area dada', 'Ganti pakaian dengan baju khusus pasien'],
        estimatedTime: '15 - 30 menit',
        isPopular: true,
    },
    // USG Abdomen
    'PR00250': {
        description: 'Pemeriksaan organ dalam perut (hati, empedu, ginjal, dll) menggunakan gelombang suara.',
        preparation: ['Puasa 6-8 jam sebelum pemeriksaan', 'Tahan kencing jika diminta untuk evaluasi kandung kemih'],
        estimatedTime: '30 - 45 menit',
        isPopular: true,
    },
};
