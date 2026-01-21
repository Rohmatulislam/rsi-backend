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
    console.log('Checking specific admin user...');

    const email = 'rohmatulislam084@gmail.com';
    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            createdAt: true
        }
    });

    if (user) {
        console.log('--------------------------------------------------');
        console.log(`User Found: ${user.email}`);
        console.log(`Role: [${user.role}] (Type: ${typeof user.role})`);
        console.log(`Email Verified: ${user.emailVerified}`);
        console.log(`ID: ${user.id}`);
        console.log('--------------------------------------------------');
    } else {
        console.log(`User with email ${email} NOT FOUND.`);
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
