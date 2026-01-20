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
    console.log('Checking user count...');
    const count = await prisma.user.count();
    console.log(`Total users in database: ${count}`);

    // Get latest user
    const latestUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { email: true, createdAt: true, name: true, emailVerified: true }
    });

    if (latestUser) {
        console.log('Latest user:', latestUser);
    } else {
        console.log('No users found.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
