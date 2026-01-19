import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// Create connection pool using DIRECT_URL for session mode
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString }) : null;
const adapter = pool ? new PrismaPg(pool) : undefined;

const prisma = new PrismaClient({ adapter } as any);

// Supabase client for file upload
const supabaseUrl = process.env.SUPABASE_URL || 'https://vpncigkytgwjlhqzvcbt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const founders = [
    {
        name: 'H. Lalu Mahsun',
        role: 'Ketua Yayasan',
        description: 'Pendiri dan ketua yayasan RSI Siti Hajar Mataram.',
        order: 1,
    },
    {
        name: 'Hj. Baiq Nurhayati',
        role: 'Wakil Ketua Yayasan',
        description: 'Wakil ketua yayasan.',
        order: 2,
    },
    {
        name: 'dr. H. Lalu Ahmad Zaini',
        role: 'Direktur Utama',
        description: 'Direktur utama rumah sakit.',
        order: 3,
    },
    {
        name: 'H. Muhammad Husni',
        role: 'Sekretaris Yayasan',
        description: 'Sekretaris yayasan.',
        order: 4,
    },
    {
        name: 'Hj. Siti Rahmah',
        role: 'Bendahara Yayasan',
        description: 'Bendahara yayasan.',
        order: 5,
    },
    {
        name: 'dr. Baiq Fitria',
        role: 'Direktur Medis',
        description: 'Direktur pelayanan medis.',
        order: 6,
    },
    {
        name: 'H. Lalu Suparman',
        role: 'Anggota Pengurus',
        description: 'Anggota pengurus yayasan.',
        order: 7,
    },
    {
        name: 'Hj. Nurul Hidayah',
        role: 'Anggota Pengurus',
        description: 'Anggota pengurus yayasan.',
        order: 8,
    },
];

async function uploadFounderImage(localPath: string, founderName: string): Promise<string | null> {
    try {
        const fileName = `${founderName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}.jpeg`;
        const fileBuffer = fs.readFileSync(localPath);

        const { error } = await supabase.storage
            .from('founders')
            .upload(fileName, fileBuffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) {
            console.error(`Error uploading ${founderName}:`, error.message);
            return null;
        }

        const { data: publicUrl } = supabase.storage
            .from('founders')
            .getPublicUrl(fileName);

        return publicUrl.publicUrl;
    } catch (error) {
        console.error(`Error reading file for ${founderName}:`, error);
        return null;
    }
}

async function seedFounders() {
    console.log('🌱 Seeding founders...');

    const uploadsDir = path.join(__dirname, '..', 'uploads', 'founders');
    let imageFiles: string[] = [];

    try {
        imageFiles = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg') || f.endsWith('.png'));
        console.log(`📷 Found ${imageFiles.length} founder images`);
    } catch (error) {
        console.log('⚠️ No uploads/founders directory found');
    }

    for (let i = 0; i < founders.length; i++) {
        const founder = founders[i];
        let image: string | null = null;

        if (imageFiles[i]) {
            const imagePath = path.join(uploadsDir, imageFiles[i]);
            image = await uploadFounderImage(imagePath, founder.name);
        }

        await prisma.founder.upsert({
            where: { id: `founder-seed-${i + 1}` },
            update: {
                name: founder.name,
                role: founder.role,
                description: founder.description,
                image,
                order: founder.order,
                isActive: true,
            },
            create: {
                id: `founder-seed-${i + 1}`,
                name: founder.name,
                role: founder.role,
                description: founder.description,
                image,
                order: founder.order,
                isActive: true,
            },
        });

        console.log(`✅ Created founder: ${founder.name}${image ? ' (with image)' : ''}`);
    }

    console.log(`🎉 Seeded ${founders.length} founders`);
}

async function main() {
    try {
        await seedFounders();
    } catch (error) {
        console.error('Error seeding founders:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        if (pool) await pool.end();
    }
}

main();
