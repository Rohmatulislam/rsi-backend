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
    console.log('Seeding partners...');

    // Delete existing partners first
    await prisma.partner.deleteMany({});

    const partners = [
        {
            name: 'BPJS Kesehatan',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/BPJS_Kesehatan_logo.svg',
            link: 'https://bpjs-kesehatan.go.id',
            isActive: true,
            order: 1,
        },
        {
            name: 'BPJS Ketenagakerjaan',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/id/2/20/Logo_BPJS_Ketenagakerjaan.png',
            link: 'https://www.bpjsketenagakerjaan.go.id',
            isActive: true,
            order: 2,
        },
        {
            name: 'Mandiri Inhealth',
            imageUrl: 'https://www.mandiriinhealth.co.id/assets/images/logo.png',
            link: 'https://www.mandiriinhealth.co.id',
            isActive: true,
            order: 3,
        },
        {
            name: 'Prudential Indonesia',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Prudential_plc_logo.svg/1200px-Prudential_plc_logo.svg.png',
            link: 'https://www.prudential.co.id',
            isActive: true,
            order: 4,
        },
        {
            name: 'Allianz Indonesia',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Allianz.svg/1200px-Allianz.svg.png',
            link: 'https://www.allianz.co.id',
            isActive: true,
            order: 5,
        },
        {
            name: 'AXA Mandiri',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/AXA_Logo.svg/1200px-AXA_Logo.svg.png',
            link: 'https://www.axa-mandiri.co.id',
            isActive: true,
            order: 6,
        },
    ];

    for (const partner of partners) {
        await prisma.partner.create({
            data: partner,
        });
    }

    console.log(`Seeded ${partners.length} partners.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

