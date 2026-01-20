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
    console.log('Updating partner logos with valid URLs...');

    // Update partners with valid logo URLs
    const updates = [
        {
            name: 'BPJS Kesehatan',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/BPJS_Kesehatan_logo.svg/220px-BPJS_Kesehatan_logo.svg.png',
        },
        {
            name: 'BPJS Ketenagakerjaan',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/id/thumb/2/20/Logo_BPJS_Ketenagakerjaan.png/220px-Logo_BPJS_Ketenagakerjaan.png',
        },
        {
            name: 'Mandiri Inhealth',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Mandiri_logo.svg/220px-Mandiri_logo.svg.png',
        },
        {
            name: 'Prudential Indonesia',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Prudential_plc_logo.svg/220px-Prudential_plc_logo.svg.png',
        },
        {
            name: 'Allianz Indonesia',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/50/Allianz.svg/220px-Allianz.svg.png',
        },
        {
            name: 'AXA Mandiri',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/AXA_Logo.svg/220px-AXA_Logo.svg.png',
        },
    ];

    for (const update of updates) {
        try {
            await prisma.partner.updateMany({
                where: { name: update.name },
                data: { imageUrl: update.imageUrl },
            });
            console.log(`Updated: ${update.name}`);
        } catch (e) {
            console.log(`Skipped: ${update.name} - not found`);
        }
    }

    console.log('Partner logos updated.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
