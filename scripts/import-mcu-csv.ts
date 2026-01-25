import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import fs from 'fs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
} as any);

async function main() {
    const csvPath = 'd:/rsi-project/Paket MCU 2026.csv';
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // Identify header line (usually line 3, but let's find the one containing 'Deteksi Dini Diabetes')
    const headerRowIdx = lines.findIndex(l => l.includes('Deteksi Dini Diabetes'));
    if (headerRowIdx === -1) {
        throw new Error('Could not find header row');
    }

    const headers = lines[headerRowIdx].split(';').map(h => h.trim());
    const packages: { name: string; index: number; items: string[]; price: number }[] = [];

    // Columns 3 onwards are packages
    for (let i = 3; i < headers.length; i++) {
        if (headers[i]) {
            packages.push({
                name: headers[i],
                index: i,
                items: [],
                price: 0
            });
        }
    }

    // Parse data rows
    const discountRow = lines.find(l => l.toLowerCase().includes('diskon 15%'));
    const discountPrices = discountRow ? discountRow.split(';') : [];

    for (let i = headerRowIdx + 1; i < lines.length; i++) {
        const row = lines[i].split(';');
        if (row.length < 3) continue;
        if (row[0].toLowerCase().includes('diskon') || row[0].toLowerCase().includes('harga') || !row[0].trim()) continue;

        const itemName = row[0].trim();

        packages.forEach(pkg => {
            const val = row[pkg.index] ? row[pkg.index].trim() : '';
            if (val && val !== '0' && val !== '-') {
                pkg.items.push(itemName);
            }
        });
    }

    // Set prices from discount row
    packages.forEach(pkg => {
        if (discountPrices[pkg.index]) {
            const rawPrice = discountPrices[pkg.index].replace(/\./g, '').trim();
            pkg.price = parseInt(rawPrice) || 0;
        }
    });

    console.log(`Found ${packages.length} packages to import.`);

    const mcuService = await prisma.service.findUnique({ where: { slug: 'mcu' } });
    if (!mcuService) {
        throw new Error('MCU service not found in database. Please run migrations/seeds first.');
    }

    // Clear existing items if you want, or just upsert
    // For now, let's just create them. If you want to replace, uncomment below:
    // await prisma.serviceItem.deleteMany({ where: { serviceId: mcuService.id } });

    for (const pkg of packages) {
        const features = pkg.items.join(', ');

        await prisma.serviceItem.upsert({
            where: {
                // We need a unique way to identify them. Name + ServiceId should be unique usually, 
                // but schema only has ID as PK.
                id: `mcu-2026-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`
            },
            update: {
                name: pkg.name,
                description: `Paket MCU 2026: ${pkg.name}`,
                price: pkg.price,
                features: features,
                isActive: true,
                order: pkg.index
            },
            create: {
                id: `mcu-2026-${pkg.name.toLowerCase().replace(/\s+/g, '-')}`,
                serviceId: mcuService.id,
                name: pkg.name,
                description: `Paket MCU 2026: ${pkg.name}`,
                price: pkg.price,
                features: features,
                icon: 'Activity',
                isActive: true,
                order: pkg.index
            }
        });
        console.log(`Imported: ${pkg.name} - Rp${pkg.price.toLocaleString('id-ID')}`);
    }

    console.log('Import completed successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
