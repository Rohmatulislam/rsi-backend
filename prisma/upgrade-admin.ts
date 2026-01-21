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
    const email = 'rohmatulislam084@gmail.com';
    console.log(`Upgrading user ${email} to ADMIN...`);

    // Check if user exists
    const user = await prisma.user.findUnique({
        where: { email },
    });

    if (!user) {
        console.error('User not found!');
        return;
    }

    console.log(`Current role: ${user.role}`);

    // Update role
    const updatedUser = await prisma.user.update({
        where: { email },
        data: { role: 'admin' },
    });

    console.log(`New role: ${updatedUser.role}`);
    console.log('User upgraded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
