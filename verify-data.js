const mysql = require('mysql2/promise');

async function verify() {
    const connection = await mysql.createConnection({
        host: '192.168.10.159',
        user: 'sitihajar',
        password: 'timit007',
        database: 'sik_rsi'
    });

    const today = '2026-01-15';
    console.log(`Verifying data for: ${today} (Historical check for insurance)`);

    // Query mimicking FinanceService logic
    const [results] = await connection.execute(`
        SELECT 
            pj.png_jawab as name,
            SUM(COALESCE(dnj.besar_bayar, 0) + COALESCE(dni.besar_bayar, 0) + COALESCE(pp.totalpiutang, 0)) as value
        FROM reg_periksa reg
        JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        LEFT JOIN nota_jalan nj ON reg.no_rawat = nj.no_rawat
        LEFT JOIN detail_nota_jalan dnj ON nj.no_rawat = dnj.no_rawat
        LEFT JOIN nota_inap ni ON reg.no_rawat = ni.no_rawat
        LEFT JOIN detail_nota_inap dni ON ni.no_rawat = dni.no_rawat
        LEFT JOIN piutang_pasien pp ON reg.no_rawat = pp.no_rawat
        WHERE reg.tgl_registrasi = ?
        GROUP BY pj.png_jawab
    `, [today]);

    console.log('--- BREAKDOWN BY PAYMENT METHOD ---');
    results.forEach(row => {
        if (Number(row.value) > 0) {
            console.log(`${row.name}: Rp ${Number(row.value).toLocaleString()}`);
        }
    });

    // Query for patient counts
    const [counts] = await connection.execute(`
        SELECT pj.png_jawab as name, COUNT(*) as patient_count
        FROM reg_periksa reg
        JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        WHERE reg.tgl_registrasi = ?
        GROUP BY pj.png_jawab
    `, [today]);

    console.log('\n--- PATIENT COUNTS TODAY ---');
    counts.forEach(row => {
        console.log(`${row.name}: ${row.patient_count} patients`);
    });

    await connection.end();
}

verify().catch(console.error);
