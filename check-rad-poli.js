const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        const res = await prisma.$queryRawUnsafe('SELECT kd_poli, nm_poli FROM poliklinik WHERE nm_poli LIKE ?', '%Rad%');
        console.log('Poliklinik Radiologi:', res);

        const all = await prisma.$queryRawUnsafe('SELECT kd_poli, nm_poli FROM poliklinik LIMIT 20');
        console.log('Semua Poliklinik (sample):', all);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

run();
