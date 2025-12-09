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
  log: ['query', 'info', 'warn', 'error'],
} as any);

const categories = [
  // POLI
  { name: 'Poli Umum', slug: 'poli-umum', type: 'POLI', icon: 'Stethoscope', color: '#3B82F6', order: 1 },
  { name: 'Poli Anak', slug: 'poli-anak', type: 'POLI', icon: 'Baby', color: '#EC4899', order: 2 },
  { name: 'Poli Gigi', slug: 'poli-gigi', type: 'POLI', icon: 'Smile', color: '#10B981', order: 3 },
  
  // SPECIALIST
  { name: 'Bedah', slug: 'bedah', type: 'SPECIALIST', icon: 'Scissors', color: '#EF4444', order: 10 },
  { name: 'Jantung', slug: 'jantung', type: 'SPECIALIST', icon: 'Heart', color: '#DC2626', order: 11 },
  { name: 'Penyakit Dalam', slug: 'penyakit-dalam', type: 'SPECIALIST', icon: 'Activity', color: '#7C3AED', order: 12 },
  { name: 'Kandungan', slug: 'kandungan', type: 'SPECIALIST', icon: 'Baby', color: '#DB2777', order: 13 },
  { name: 'Anak', slug: 'anak', type: 'SPECIALIST', icon: 'Users', color: '#F59E0B', order: 14 },
  { name: 'Mata', slug: 'mata', type: 'SPECIALIST', icon: 'Eye', color: '#06B6D4', order: 15 },
  { name: 'THT', slug: 'tht', type: 'SPECIALIST', icon: 'Ear', color: '#8B5CF6', order: 16 },
  { name: 'Kulit dan Kelamin', slug: 'kulit-kelamin', type: 'SPECIALIST', icon: 'Sparkles', color: '#EC4899', order: 17 },
  { name: 'Saraf', slug: 'saraf', type: 'SPECIALIST', icon: 'Brain', color: '#6366F1', order: 18 },
  { name: 'Orthopedi', slug: 'orthopedi', type: 'SPECIALIST', icon: 'Bone', color: '#14B8A6', order: 19 },
  
  // SERVICE
  { name: 'Rawat Inap', slug: 'rawat-inap', type: 'SERVICE', icon: 'Bed', color: '#3B82F6', order: 20 },
  { name: 'Rawat Jalan', slug: 'rawat-jalan', type: 'SERVICE', icon: 'Walking', color: '#10B981', order: 21 },
  { name: 'Medical Check Up', slug: 'mcu', type: 'SERVICE', icon: 'ClipboardCheck', color: '#F59E0B', order: 22 },
  
  // FACILITY
  { name: 'Laboratorium', slug: 'laboratorium', type: 'FACILITY', icon: 'FlaskConical', color: '#06B6D4', order: 30 },
  { name: 'Radiologi', slug: 'radiologi', type: 'FACILITY', icon: 'ScanLine', color: '#8B5CF6', order: 31 },
  { name: 'Farmasi', slug: 'farmasi', type: 'FACILITY', icon: 'Pill', color: '#10B981', order: 32 },
  { name: 'Rehabilitasi Medik', slug: 'rehabilitasi-medik', type: 'FACILITY', icon: 'Dumbbell', color: '#F59E0B', order: 33 },
  
  // EMERGENCY
  { name: 'IGD', slug: 'igd', type: 'EMERGENCY', icon: 'Ambulance', color: '#EF4444', order: 40 },
  { name: 'Ambulance', slug: 'ambulance', type: 'EMERGENCY', icon: 'Truck', color: '#DC2626', order: 41 },
  
  // SUPPORT
  { name: 'Gizi', slug: 'gizi', type: 'SUPPORT', icon: 'Apple', color: '#10B981', order: 50 },
  { name: 'Fisioterapi', slug: 'fisioterapi', type: 'SUPPORT', icon: 'Activity', color: '#3B82F6', order: 51 },
  
  // FEATURED
  { name: 'Bedah Minimal Invasif', slug: 'bedah-minimal-invasif', type: 'FEATURED', icon: 'Scissors', color: '#EF4444', order: 60 },
  { name: 'ESWL', slug: 'eswl', type: 'FEATURED', icon: 'Zap', color: '#F59E0B', order: 61 },
  { name: 'Persalinan Syari', slug: 'persalinan-syari', type: 'FEATURED', icon: 'Heart', color: '#EC4899', order: 62 },
  { name: 'Poli Executive', slug: 'poli-executive', type: 'FEATURED', icon: 'Crown', color: '#8B5CF6', order: 63 },
  
  // ARTICLE_CATEGORY
  { name: 'Kesehatan Umum', slug: 'kesehatan-umum', type: 'ARTICLE_CATEGORY', icon: 'FileText', color: '#3B82F6', order: 70 },
  { name: 'Tips Kesehatan', slug: 'tips-kesehatan', type: 'ARTICLE_CATEGORY', icon: 'Lightbulb', color: '#F59E0B', order: 71 },
  { name: 'Berita', slug: 'berita', type: 'ARTICLE_CATEGORY', icon: 'Newspaper', color: '#10B981', order: 72 },
];

async function seed() {
  console.log('🌱 Starting seed categories with Prisma...');
  
  try {
    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {}, // Jika sudah ada, tidak perlu update apapun
        create: {
          name: cat.name,
          slug: cat.slug,
          type: cat.type as any, // Cast to any to avoid enum type issues in seed script for now
          icon: cat.icon,
          color: cat.color,
          order: cat.order,
          isActive: true,
        },
      });
    }
    
    console.log(`✅ Successfully seeded ${categories.length} categories!`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
