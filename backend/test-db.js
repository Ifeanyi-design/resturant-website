const pool = require('./config/database');

async function testConnection() {
    let connection;

    try {
        connection = await pool.getConnection();

        console.log('✅ Connected to MariaDB successfully!');

        const rows = await connection.query('SELECT DATABASE() AS database_name');

        console.log('Database:', rows[0].database_name);

    } catch (error) {
        console.error('❌ Database connection failed:');
        console.error(error.message);

    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

testConnection();
