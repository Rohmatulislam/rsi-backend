const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

async function checkUsers() {
    try {
        const res = await pool.query('SELECT id, email, name, "emailVerified", "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 20');
        console.log('Recent Users:');
        console.table(res.rows);
    } catch (err) {
        console.error('Error checking users:', err.message);
        if (err.message.includes('relation "User" does not exist')) {
            console.log('Error: Table "User" not found. Checking all tables...');
            const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log('Existing tables:', tables.rows.map(t => t.table_name));
        }
    } finally {
        await pool.end();
    }
}

checkUsers();
