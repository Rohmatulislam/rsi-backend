const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
    adapter,
});

async function run() {
    try {
        const service = await prisma.service.findUnique({
            where: { slug: 'rawat-inap' }
        });

        if (!service) {
            console.error('Service rawat-inap not found');
            return;
        }

        const buildingMappings = [
            { name: "Gedung Safa", simrs: "R. Safa", classes: ["Kelas VVIP", "Kelas VIP", "Kelas 1", "Kelas 2", "Kelas 3"] },
            { name: "Gedung Mina", simrs: "R. Mina", classes: ["Kelas VVIP", "Kelas VIP"] },
            { name: "Gedung Zam-zam", simrs: "R. Zam Zam", classes: ["Kelas VIP", "Kelas 1", "Kelas 3"] },
            { name: "Gedung Multazam", simrs: "R. Multazam", classes: ["Kelas 2"] },
            { name: "Gedung Arafah", simrs: "R.Arafah", classes: ["Kelas VIP"] },
            { name: "Gedung Jabal Rahmah", simrs: "R. Jabal Rahmah", classes: ["Kelas Utama", "Kelas VIP", "Kelas 1"] },
            { name: "Gedung Muzdalifah", simrs: "R. Muzdalifah", classes: ["Kelas 3"] },
            { name: "Gedung Marwah", simrs: "R. Marwah", classes: ["Kelas 3"] },
            { name: "Gedung ICU", simrs: "R. ICU", classes: ["Kelas Utama"] },
            { name: "Gedung ICCU", simrs: "R. ICCU", classes: ["Kelas Utama"] },
            { name: "Gedung NICU", simrs: "R. NICU", classes: ["Kelas Utama"] },
            { name: "Gedung HCU", simrs: "R. HCU", classes: ["Kelas Utama"] },
            { name: "Gedung Bayi Safa", simrs: "By. Safa", classes: ["Kelas VIP", "Kelas 1", "Kelas 2", "Kelas 3"] }
        ];

        const classDetails = {
            "Kelas VVIP": { name: "VVIP / Suite", price: 1500000, features: "AC, TV 43, Sofa, Refrigerator, Private Lounge, Deluxe Bathroom" },
            "Kelas VIP": { name: "VIP", price: 1000000, features: "AC, TV 32, Sofa, Refrigerator, Bathroom" },
            "Kelas Utama": { name: "Kelas Utama", price: 850000, features: "AC, TV, Sofa Bed, Refrigerator, Bathroom" },
            "Kelas 1": { name: "Kelas 1", price: 650000, features: "AC, TV, Sofa Bed, Bathroom" },
            "Kelas 2": { name: "Kelas 2", price: 450000, features: "AC, TV (Shared), Bathroom" },
            "Kelas 3": { name: "Kelas 3", price: 250000, features: "Fan/AC, Shared Facilities" }
        };

        console.log('Clearing existing items for rawat-inap...');
        await prisma.serviceItem.deleteMany({
            where: { serviceId: service.id }
        });

        console.log('Seeding new items...');
        let count = 0;
        for (const mapping of buildingMappings) {
            for (const className of mapping.classes) {
                const details = classDetails[className];
                await prisma.serviceItem.create({
                    data: {
                        serviceId: service.id,
                        name: details.name,
                        category: mapping.name,
                        price: details.price,
                        description: `Fasilitas perawatan bed ${details.name} di ${mapping.name}`,
                        features: details.features,
                        isActive: true
                    }
                });
                count++;
            }
        }

        console.log(`Successfully seeded ${count} items across ${buildingMappings.length} buildings`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

run();
