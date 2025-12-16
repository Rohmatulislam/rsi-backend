import axios from 'axios';

const articles = [
    {
        title: 'Pentingnya Medical Check-Up Rutin',
        slug: 'pentingnya-medical-check-up',
        excerpt: 'Deteksi dini penyakit melalui MCU dapat menyelamatkan nyawa Anda. Simak mengapa pemeriksaan berkala itu krusial.',
        content: 'Medical Check-Up (MCU) adalah pemeriksaan kesehatan menyeluruh yang dilakukan secara berkala. Tujuannya adalah untuk mengetahui kondisi kesehatan terkini serta mendeteksi gejala penyakit sedini mungkin. \n\nKenapa MCU penting?\n1. Deteksi Dini: Banyak penyakit kronis seperti diabetes, hipertensi, dan kolesterol tinggi tidak menunjukkan gejala di awal.\n2. Hemat Biaya: Mencegah penyakit jauh lebih murah daripada mengobati.\n3. Perencanaan Kesehatan: Dokter dapat memberikan saran gaya hidup yang tepat berdasarkan hasil MCU Anda.\n\nKapan sebaiknya MCU?\nDisarankan melakukan MCU minimal satu kali setahun, terutama bagi Anda yang berusia di atas 40 tahun atau memiliki riwayat penyakit keluarga.',
        image: 'https://images.unsplash.com/photo-1579684385136-137af7549091?q=80&w=2000&auto=format&fit=crop',
        category: 'Kesehatan',
        author: 'Dr. Budi Santoso',
        createdAt: new Date('2024-01-15'),
    },
    {
        title: 'Tips Menjaga Kesehatan Jantung',
        slug: 'tips-menjaga-kesehatan-jantung',
        excerpt: 'Jantung sehat adalah kunci hidup bahagia. Temukan cara sederhana menjaga kesehatan organ vital ini.',
        content: 'Penyakit jantung masih menjadi penyebab kematian tertinggi di dunia. Namun, sebagian besar faktor risiko penyakit jantung dapat dicegah dengan gaya hidup sehat.\n\nBerikut tips menjaga kesehatan jantung:\n- Pola Makan Sehat: Kurangi garam dan lemak jenuh. Perbanyak sayur, buah, dan biji-bijian.\n- Olahraga Teratur: Lakukan aktivitas fisik minimal 30 menit setiap hari, seperti jalan cepat atau berenang.\n- Kelola Stres: Stres berlebihan dapat memicu tekanan darah tinggi.\n- Tidur Cukup: Kurang tidur dapat meningkatkan risiko obesitas dan serangan jantung.\n- Berhenti Merokok: Merokok merusak pembuluh darah dan mengurangi oksigen dalam darah.',
        image: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?q=80&w=2000&auto=format&fit=crop',
        category: 'Tips Sehat',
        author: 'Dr. Sarah Amalia, Sp.JP',
        createdAt: new Date('2024-02-10'),
    },
    {
        title: 'Layanan Unggulan Bedah Minimal Invasif',
        slug: 'layanan-bedah-minimal-invasif',
        excerpt: 'Operasi dengan luka sayatan kecil, nyeri minimal, dan pemulihan lebih cepat menggunakan teknologi terkini.',
        content: 'RSI bangga menghadirkan layanan Bedah Minimal Invasif (Laparoskopi). Teknik ini memungkinkan dokter bedah melakukan prosedur kompleks hanya melalui sayatan kecil (0,5 - 1 cm).\n\nKeuntungan Bedah Minimal Invasif:\n- Nyeri pasca operasi lebih ringan.\n- Bekas luka sangat kecil (kosmetik lebih baik).\n- Waktu rawat inap lebih singkat (seringkali One Day Care).\n- Pemulihan lebih cepat, pasien bisa segera kembali beraktivitas.\n\nLayanan ini tersedia untuk berbagai kasus seperti usus buntu, batu empedu, hernia, hingga bedah kandungan.',
        image: 'https://images.unsplash.com/photo-1551076805-e1869033e561?q=80&w=2000&auto=format&fit=crop',
        category: 'Layanan RS',
        author: 'Humas RSI',
        createdAt: new Date('2024-03-01'),
    },
    {
        title: 'Mengenal Poli Eksekutif RSI',
        slug: 'mengenal-poli-eksekutif',
        excerpt: 'Nikmati kenyamanan dan privasi lebih dengan layanan Poli Eksekutif kami. Tanpa antre, fasilitas premium.',
        content: 'Poli Eksekutif RSI dirancang untuk memberikan pengalaman berobat yang lebih nyaman dan privat. \n\nFasilitas Unggulan:\n- One Stop Service: Pendaftaran, pemeriksaan, pembayaran, dan farmasi dalam satu area.\n- Lounge Nyaman: Ruang tunggu eksklusif dengan snack dan minuman.\n- Appointment Tepat Waktu: Jadwal dokter yang lebih pasti dan waktu konsultasi yang lebih leluasa.\n- Dokter Spesialis Senior: Dilayani oleh dokter-dokter konsultan dan spesialis berpengalaman.\n\nCocok bagi Anda yang memiliki kesibukan tinggi dan mengutamakan kenyamanan.',
        image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2000&auto=format&fit=crop',
        category: 'Layanan RS',
        author: 'Humas RSI',
        createdAt: new Date('2024-03-20'),
    },
    {
        title: 'Jadwal Poliklinik Selama Ramadhan',
        slug: 'jadwal-poliklinik-ramadhan',
        excerpt: 'Informasi perubahan jam operasional poliklinik selama bulan suci Ramadhan.',
        content: 'Assalamualaikum Wr. Wb. Menginformasikan selama bulan Ramadhan, terdapat penyesuaian jam layanan Poliklinik:\n\n- Pendaftaran Pagi: 07.30 - 11.00 WIB\n- Pendaratan Sore: 13.00 - 16.00 WIB\n\nUntuk Layanan IGD, Farmasi, Radiologi, dan Laboratorium tetap buka 24 Jam.\n\nHarap maklum dan selamat menunaikan ibadah puasa.',
        image: 'https://images.unsplash.com/photo-1533036814249-14a515c1bd11?q=80&w=2000&auto=format&fit=crop',
        category: 'Berita',
        author: 'Admin',
        createdAt: new Date('2024-03-10'),
    }
];

async function seed() {
    console.log("Seeding articles via API...");
    for (const article of articles) {
        try {
            // Remove category as it's not in the Article model (it's a relation)
            // And DTO doesn't have it, so no validation error, but service creates passing it to Prisma causing error.
            const { category, ...payload } = article as any;

            // Also DTO might not have author if I didn't add it to DTO.
            // Check DTO again?
            // create-article.dto.ts didn't have @IsString() author.
            // If main.ts doesn't strip (whitelist: false), it passes to Prisma.
            // Article model HAS author. So it should be fine.

            await axios.post('http://localhost:2000/api/articles', payload);
            console.log(`Created: ${article.title}`);
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message;
            if (typeof msg === 'string' && (msg.includes('Unique constraint') || msg.includes('exist'))) {
                console.log(`Skipped (Exists): ${article.title}`);
            } else {
                console.log(`Failed: ${article.title}`, e.response?.data || e.message);
            }
        }
    }
}
seed();
