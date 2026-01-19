import { PrismaClient, ArticleStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// Create connection pool using DIRECT_URL for session mode
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const adapter = pool ? new PrismaPg(pool) : undefined;

const prisma = new PrismaClient({ adapter } as any);

const articles = [
    {
        title: 'Tips Menjaga Kesehatan Jantung di Usia Produktif',
        slug: 'tips-menjaga-kesehatan-jantung',
        content: `
      <p>Penyakit jantung merupakan salah satu penyebab kematian tertinggi di Indonesia. Namun, dengan gaya hidup sehat, risiko penyakit jantung dapat dikurangi secara signifikan.</p>
      <h2>1. Olahraga Teratur</h2>
      <p>Lakukan aktivitas fisik minimal 30 menit setiap hari.</p>
      <h2>2. Pola Makan Seimbang</h2>
      <p>Konsumsi makanan rendah lemak jenuh, tinggi serat.</p>
      <h2>3. Hindari Rokok dan Alkohol</h2>
      <p>Merokok merusak pembuluh darah.</p>
      <h2>4. Kelola Stres</h2>
      <p>Stres berlebihan dapat mempengaruhi kesehatan jantung.</p>
    `,
        excerpt: 'Pelajari cara menjaga kesehatan jantung dengan tips sederhana.',
        status: ArticleStatus.PUBLISHED,
    },
    {
        title: 'Pentingnya Medical Check Up Rutin',
        slug: 'pentingnya-medical-check-up-rutin',
        content: `
      <p>Medical check up atau pemeriksaan kesehatan berkala sangat penting untuk mendeteksi dini berbagai penyakit.</p>
      <h2>Kapan Harus Melakukan MCU?</h2>
      <p>Disarankan untuk melakukan MCU setahun sekali.</p>
    `,
        excerpt: 'Ketahui pentingnya pemeriksaan kesehatan berkala.',
        status: ArticleStatus.PUBLISHED,
    },
    {
        title: 'RSI Siti Hajar Mataram Hadirkan Layanan Telemedicine',
        slug: 'layanan-telemedicine-rsi-siti-hajar',
        content: `
      <p>RSI Siti Hajar Mataram kini menghadirkan layanan telemedicine.</p>
      <h2>Keunggulan Telemedicine</h2>
      <ul>
        <li>Konsultasi dari rumah</li>
        <li>Menghemat waktu dan biaya</li>
      </ul>
    `,
        excerpt: 'RSI Siti Hajar menghadirkan layanan konsultasi online.',
        status: ArticleStatus.PUBLISHED,
    },
    {
        title: 'Mengenal Gejala Diabetes Sejak Dini',
        slug: 'mengenal-gejala-diabetes-sejak-dini',
        content: `
      <p>Diabetes mellitus adalah penyakit kronis yang ditandai dengan kadar gula darah tinggi.</p>
      <h2>Gejala Umum Diabetes</h2>
      <ul>
        <li>Sering buang air kecil</li>
        <li>Sering merasa haus</li>
        <li>Penurunan berat badan</li>
      </ul>
    `,
        excerpt: 'Kenali gejala diabetes sejak dini.',
        status: ArticleStatus.PUBLISHED,
    },
];

async function seedArticles() {
    console.log('🌱 Seeding articles...');

    for (const article of articles) {
        await prisma.article.upsert({
            where: { slug: article.slug },
            update: {
                title: article.title,
                content: article.content,
                excerpt: article.excerpt,
                status: article.status,
                publishedAt: new Date(),
            },
            create: {
                title: article.title,
                slug: article.slug,
                content: article.content,
                excerpt: article.excerpt,
                status: article.status,
                publishedAt: new Date(),
                viewCount: Math.floor(Math.random() * 500) + 100,
            },
        });
        console.log(`✅ Created article: ${article.title}`);
    }

    console.log(`🎉 Seeded ${articles.length} articles`);
}

async function main() {
    try {
        await seedArticles();
    } catch (error) {
        console.error('Error seeding articles:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        if (pool) await pool.end();
    }
}

main();
