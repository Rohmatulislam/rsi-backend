import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
} as any);

async function main() {
    console.log('Seeding services...');

    const services = [
        {
            name: 'Medical Check Up',
            slug: 'mcu',
            title: 'Medical Check Up',
            subtitle: 'Paket Lengkap & Terjangkau',
            description: 'Investasi terbaik untuk kesehatan Anda dengan pemeriksaan menyeluruh dan akurat',
            icon: 'Stethoscope',
            isActive: true,
            order: 1,
            items: [
                {
                    name: 'Paket Basic',
                    price: 350000,
                    description: 'Pemeriksaan dasar untuk kesehatan umum',
                    features: 'Pemeriksaan Fisik Lengkap,Tekanan Darah,Gula Darah Puasa,Kolesterol Total,Urine Lengkap',
                    order: 1
                },
                {
                    name: 'Paket Standard',
                    price: 750000,
                    description: 'Pemeriksaan menengah untuk deteksi lebih detail',
                    features: 'Semua Paket Basic,Profil Lipid Lengkap,Fungsi Hati (SGOT/SGPT),Fungsi Ginjal (Ureum/Kreatinin),Asam Urat,EKG,Rontgen Dada',
                    order: 2
                },
                {
                    name: 'Paket Executive',
                    price: 1500000,
                    description: 'Pemeriksaan komprehensif untuk kesehatan optimal',
                    features: 'Semua Paket Standard,USG Abdomen,Hepatitis B (HBsAg),Tumor Marker (PSA/CA-125),Treadmill Test,Konsultasi Dokter Spesialis,Laporan Kesehatan Komprehensif',
                    order: 3
                }
            ]
        },
        {
            name: 'Rawat Inap',
            slug: 'rawat-inap',
            title: 'Fasilitas Rawat Inap',
            subtitle: 'Kenyamanan Seperti di Rumah',
            description: 'Berbagai pilihan akomodasi rawat inap mulai dari kelas 3 hingga VVIP suite',
            icon: 'Bed',
            isActive: true,
            order: 2,
            items: [
                {
                    category: 'Gedung Mina',
                    name: 'Kelas 3',
                    price: 250000,
                    description: 'Ruang perawatan ekonomis dengan fasilitas dasar yang memadai.',
                    features: 'AC Central,Kamar Mandi Dalam,TV Bersama,Nakas,Kursi Penunggu',
                    order: 1
                },
                {
                    category: 'Gedung Multazam',
                    name: 'Kelas 2',
                    price: 450000,
                    description: 'Kenyamanan lebih dengan kapasitas kamar yang lebih sedikit.',
                    features: 'AC Split,Kamar Mandi Dalam,TV LED 32",Tirai Penyekat,Nakas,Kursi Penunggu Standar',
                    order: 2
                },
                {
                    category: 'Gedung Zam-zam',
                    name: 'Kelas 1',
                    price: 650000,
                    description: 'Ruang perawatan privat untuk kenyamanan maksimal pasien dan keluarga.',
                    features: 'AC Split,Kamar Mandi Dalam (Water Heater),TV LED 32",Kulkas,Sofa Tamu,Nakas,Overbed Table',
                    order: 3
                },
                {
                    category: 'Gedung Arafah',
                    name: 'VIP A',
                    price: 1100000,
                    description: 'Kamar VIP luas dengan ruang tunggu terpisah.',
                    features: 'AC,Smart TV 43",Kulkas 2 Pintu,Dispenser,Sofa Bed,Lemari Pakaian,Kamar Mandi Luas (Water Heater),Welcome Fruit',
                    order: 4
                },
                {
                    category: 'Gedung Arafah',
                    name: 'VIP B',
                    price: 950000,
                    description: 'Kamar VIP standar dengan fasilitas lengkap.',
                    features: 'AC,TV LED 40",Kulkas 1 Pintu,Sofa Bed,Lemari Kecil,Kamar Mandi Dalam (Water Heater)',
                    order: 5
                },
                {
                    category: 'Gedung Jabal Rahmah',
                    name: 'VVIP Suite',
                    price: 2000000,
                    description: 'Suite mewah dengan ruang tamu dan pantry pribadi.',
                    features: 'AC,Smart TV 50",Private Pantry,Microwave,Kulkas Besar,Ruang Tamu Sofa Kulit,Meja Makan,Extra Bed Penunggu,Amenity Premium',
                    order: 6
                },
                {
                    category: 'Gedung Jabal Rahmah',
                    name: 'VVIP',
                    price: 1500000,
                    description: 'Kamar VVIP luas dengan fasilitas eksklusif.',
                    features: 'AC,Smart TV 43",Kulkas,Sofa Bed Premium,Meja Kerja,Amenity Lengkap',
                    order: 7
                }
            ]
        },
        {
            name: 'Laboratorium',
            slug: 'laboratorium',
            title: 'Layanan Laboratorium',
            subtitle: 'Hasil Akurat & Cepat',
            description: 'Pemeriksaan laboratorium lengkap didukung oleh tenaga ahli dan peralatan modern',
            icon: 'FlaskConical',
            isActive: true,
            order: 3
        },
        {
            name: 'Radiologi',
            slug: 'radiologi',
            title: 'Layanan Radiologi',
            subtitle: 'Teknologi Pencitraan Modern',
            description: 'Layanan pencitraan medis lengkap untuk diagnosis yang tepat dan akurat',
            icon: 'ScanLine',
            isActive: true,
            order: 4
        },
        {
            name: 'Poli Executive',
            slug: 'poli-executive',
            title: 'Poliklinik Executive',
            subtitle: 'Layanan Premium & Eksklusif',
            description: 'Konsultasi dokter spesialis dengan kenyamanan ekstra dan waktu tunggu minimal',
            icon: 'Crown',
            isActive: true,
            order: 5,
            items: [
                {
                    name: 'Executive Internal Medicine',
                    description: 'Konsultasi spesialis penyakit dalam dengan layanan prioritas.',
                    order: 1
                },
                {
                    name: 'Executive Pediatrics',
                    description: 'Layanan kesehatan anak premium dengan ruang tunggu ramah anak.',
                    order: 2
                },
                {
                    name: 'Executive Obgyn',
                    description: 'Pemeriksaan kehamilan dan kesehatan wanita eksklusif.',
                    order: 3
                },
                {
                    name: 'Executive Cardiology',
                    description: 'Pemeriksaan jantung menyeluruh dengan peralatan modern.',
                    order: 4
                }
            ]
        },
        {
            name: 'Rawat Jalan',
            slug: 'rawat-jalan',
            title: 'Poliklinik Spesialis',
            subtitle: 'Solusi Kesehatan Terpadu',
            description: 'Berbagai pilihan klinik spesialis untuk kebutuhan kesehatan Anda',
            icon: 'Stethoscope',
            isActive: true,
            order: 6,
            items: [
                {
                    name: 'Poli Penyakit Dalam',
                    description: 'Layanan spesialis untuk diagnosis dan pengobatan penyakit organ dalam pada orang dewasa.',
                    icon: 'Activity',
                    order: 1
                },
                {
                    name: 'Poli Bedah Umum',
                    description: 'Layanan konsultasi dan tindakan bedah umum oleh dokter spesialis bedah.',
                    icon: 'Scalpel',
                    order: 2
                },
                {
                    name: 'Poli Anak (Pediatri)',
                    description: 'Layanan kesehatan menyeluruh untuk bayi, anak-anak, dan remaja.',
                    icon: 'Baby',
                    order: 3
                },
                {
                    name: 'Poli Kandungan (Obgyn)',
                    description: 'Layanan kesehatan wanita, kehamilan, dan persalinan.',
                    icon: 'Baby',
                    order: 4
                },
                {
                    name: 'Poli Saraf (Neurologi)',
                    description: 'Diagnosis dan pengobatan gangguan pada sistem saraf.',
                    icon: 'Brain',
                    order: 5
                },
                {
                    name: 'Poli Mata',
                    description: 'Pemeriksaan dan pengobatan kesehatan mata.',
                    icon: 'Eye',
                    order: 6
                },
                {
                    name: 'Poli THT-KL',
                    description: 'Layanan kesehatan Telinga, Hidung, Tenggorokan, dan Bedah Kepala Leher.',
                    icon: 'Ear',
                    order: 7
                },
                {
                    name: 'Poli Gigi & Mulut',
                    description: 'Layanan kesehatan gigi dan mulut umum serta spesialis.',
                    icon: 'Smile',
                    order: 8
                },
                {
                    name: 'Poli Jantung',
                    description: 'Pemeriksaan dan perawatan kesehatan jantung dan pembuluh darah.',
                    icon: 'Heart',
                    order: 9
                },
                {
                    name: 'Poli Kulit & Kelamin',
                    description: 'Diagnosis dan pengobatan penyakit kulit dan kelamin.',
                    icon: 'Sparkles',
                    order: 10
                },
                {
                    name: 'Poli Orthopedi',
                    description: 'Layanan bedah tulang, sendi, dan jaringan ikat.',
                    icon: 'Bone',
                    order: 11
                },
                {
                    name: 'Poli Paru',
                    description: 'Layanan kesehatan sistem pernapasan dan paru-paru.',
                    icon: 'Wind',
                    order: 12
                }
            ]
        }
    ];

    for (const s of services) {
        const { items, ...serviceData } = s;
        const service = await prisma.service.upsert({
            where: { slug: s.slug },
            update: serviceData,
            create: serviceData,
        });

        if (items) {
            // Delete existing items to prevent duplicates (Idempotency)
            await prisma.serviceItem.deleteMany({
                where: { serviceId: service.id }
            });

            for (const item of items) {
                await prisma.serviceItem.create({
                    data: {
                        ...item,
                        serviceId: service.id
                    }
                });
            }
        }
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
