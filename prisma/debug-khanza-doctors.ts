import 'dotenv/config';
import { KhanzaDBService } from '../src/infra/database/khanza/khanza-db.service';
import { ConfigService } from '@nestjs/config';

async function main() {
    const config = new ConfigService();
    const dbService = new KhanzaDBService(config);

    console.log('--- Searching for doctors with "Taufiq" in name ---');
    const doctors = await dbService.db('dokter')
        .where('nm_dokter', 'like', '%Taufiq%');
    console.log(JSON.stringify(doctors, null, 2));

    console.log('\n--- Checking total count in k_dokter ---');
    const count = await dbService.db('dokter').count('kd_dokter as count').where('status', '1');
    console.log('Total active doctors in Khanza:', count[0].count);
}

main()
    .catch(err => console.error('Error:', err))
    .finally(() => process.exit());
