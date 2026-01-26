
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log('Checking local DB for rawat-inap service...');

    const dbUrl = process.env.DATABASE_URL;
    const client = new Client({
        connectionString: dbUrl,
    });

    try {
        await client.connect();
        const service = await client.query("SELECT * FROM \"Service\" WHERE slug = 'rawat-inap'");
        console.log('--- RAWAT-INAP SERVICE ---');
        console.log(JSON.stringify(service.rows, null, 2));

        if (service.rows.length > 0) {
            const items = await client.query("SELECT * FROM \"ServiceItem\" WHERE \"serviceId\" = $1", [service.rows[0].id]);
            console.log('--- SERVICE ITEMS ---');
            console.log(JSON.stringify(items.rows, null, 2));
        }

    } catch (error) {
        console.error('Error during execution:', error);
    } finally {
        await client.end();
    }
}

main();
