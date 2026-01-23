const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('--- Checking Doctor Records ---');
    const doctors = await prisma.doctor.findMany({
        where: {
            OR: [
                { name: { contains: 'Philip' } },
                { slug: { contains: 'philip' } }
            ]
        },
        select: {
            id: true,
            name: true,
            slug: true,
            kd_dokter: true,
            bio: true,
            description: true,
            specialization: true,
        },
    });

    console.log(JSON.stringify(doctors, null, 2));
    console.log(`Total doctors: ${doctors.length}`);

    const withoutSlug = doctors.filter(d => !d.slug);
    console.log(`Doctors without slug: ${withoutSlug.length}`);
    if (withoutSlug.length > 0) {
        console.log('Sample docs without slug:', JSON.stringify(withoutSlug.slice(0, 5), null, 2));
    }

    const withoutKdDokter = doctors.filter(d => !d.kd_dokter);
    console.log(`Doctors without kd_dokter: ${withoutKdDokter.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
