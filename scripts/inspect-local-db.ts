
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Checking local DB for excluded beds...');

    // Attempt to parse DATABASE_URL from .env manually to be sure
    const dbUrl = process.env.DATABASE_URL;
    console.log('Using DATABASE_URL:', dbUrl?.split('@')[1] || 'Not found');

    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        const res = await client.query('SELECT COUNT(*) FROM "excluded_beds"');
        console.log('--- EXCLUDED BED COUNT ---');
        console.log(JSON.stringify(res.rows, null, 2));

        const samples = await client.query('SELECT * FROM "excluded_beds" LIMIT 5');
        console.log('--- SAMPLE EXCLUDED BEDS ---');
        console.log(JSON.stringify(samples.rows, null, 2));

        const buildings = await client.query('SELECT id, name, "isActive" FROM "buildings"');
        console.log('--- BUILDINGS (Units) ---');
        console.log(JSON.stringify(buildings.rows, null, 2));

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await client.end();
    }
}

main();
