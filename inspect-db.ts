
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { KhanzaService } from './src/infra/database/khanza.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const khanzaService = app.get(KhanzaService);

    try {
        const columns = await khanzaService.db('poliklinik').columnInfo();
        console.log('--- POLIKLINIK COLUMNS ---');
        console.log(JSON.stringify(Object.keys(columns), null, 2));

        const rows = await khanzaService.db('poliklinik').limit(5);
        console.log('--- POLIKLINIK ROWS ---');
        console.log(JSON.stringify(rows, null, 2));

    } catch (error) {
        console.error('Error fetching data:', error);
    } finally {
        await app.close();
    }
}

bootstrap();
