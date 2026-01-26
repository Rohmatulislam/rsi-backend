
import { PrismaClient } from '@prisma/client';
import knex from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Syncing buildings from Khanza to local DB...');

    // Prisma for local DB
    const prisma = new PrismaClient();

    // Knex for Khanza DB
    const khanzaDb = knex({
        client: 'mysql2',
        connection: {
            host: process.env.KHANZA_DB_HOST,
            port: Number(process.env.KHANZA_DB_PORT),
            user: process.env.KHANZA_DB_USER,
            password: process.env.KHANZA_DB_PASSWORD,
            database: process.env.KHANZA_DB_NAME,
        },
    });

    try {
        const khanzaUnits = await khanzaDb('bangsal')
            .select('kd_bangsal as id', 'nm_bangsal as name')
            .where('status', '1')
            .orderBy('nm_bangsal', 'asc');

        console.log(`Found ${khanzaUnits.length} units in Khanza.`);

        let synced = 0;
        for (const unit of khanzaUnits) {
            await prisma.building.upsert({
                where: { kd_bangsal: unit.id },
                create: {
                    kd_bangsal: unit.id,
                    name: unit.name,
                    order: synced,
                    isActive: true,
                },
                update: {
                    name: unit.name,
                },
            });
            synced++;
        }

        console.log(`Successfully synced ${synced} units to local buildings table.`);

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await prisma.$disconnect();
        await khanzaDb.destroy();
    }
}

main();
