
import { Client } from 'pg';
import knex from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Syncing buildings from Khanza to local DB (using pg)...');

    const dbUrl = process.env.DATABASE_URL;
    const localClient = new Client({
        connectionString: dbUrl,
    });

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
        await localClient.connect();

        const khanzaUnits = await khanzaDb('bangsal')
            .select('kd_bangsal as id', 'nm_bangsal as name')
            .where('status', '1')
            .orderBy('nm_bangsal', 'asc');

        console.log(`Found ${khanzaUnits.length} units in Khanza.`);

        let synced = 0;
        for (const unit of khanzaUnits) {
            // Manual upsert into "buildings"
            const query = `
                INSERT INTO "buildings" (id, kd_bangsal, name, "order", "isActive", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                ON CONFLICT (kd_bangsal) 
                DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW()
            `;
            const id = `building-${unit.id.toLowerCase()}`;
            await localClient.query(query, [id, unit.id, unit.name, synced, true]);
            synced++;
        }

        console.log(`Successfully synced ${synced} units to local buildings table.`);

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await localClient.end();
        await khanzaDb.destroy();
    }
}

main();
