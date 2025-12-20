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
                    features: 'AC Split,Kamar Mandi Dalam,TV LED 32",Tirai Penyekat,Nakas',
                    order: 2
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
            order: 5
        },
        {
            name: 'Rawat Jalan',
            slug: 'rawat-jalan',
            title: 'Poliklinik Spesialis',
            subtitle: 'Solusi Kesehatan Terpadu',
            description: 'Berbagai pilihan klinik spesialis untuk kebutuhan kesehatan Anda',
            icon: 'Stethoscope',
            isActive: true,
            order: 6
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
