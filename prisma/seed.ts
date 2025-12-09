import { execSync } from 'child_process';

async function main() {
  try {
    console.log('🚀 Starting Full Database Seed...');

    // 1. Seed Categories
    console.log('\n📝 Seeding Categories...');
    execSync('npx tsx prisma/seed-categories.ts', { stdio: 'inherit' });

    // 2. Seed Doctors
    console.log('\n👨‍⚕️ Seeding Doctors...');
    execSync('npx tsx prisma/seed-doctors.ts', { stdio: 'inherit' });

    console.log('\n✅ All seeds completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed.');
    process.exit(1);
  }
}

main();
