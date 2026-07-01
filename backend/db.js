const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err, client) => {
  console.warn('Unexpected error on idle client', err.message)
});

const initDB = async () => {
  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        processing_time VARCHAR(255) NOT NULL,
        fee VARCHAR(255) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS applications (
        id VARCHAR(255) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        cnic VARCHAR(255) NOT NULL,
        phone VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        service_type VARCHAR(255) NOT NULL,
        district VARCHAR(255) NOT NULL,
        additional_notes TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed services if empty
    const res = await client.query('SELECT COUNT(*) FROM services');
    if (parseInt(res.rows[0].count) === 0) {
      const services = [
        ["srv_001", "Birth Certificate", "Apply for a new birth certificate or request a duplicate.", "7-10 working days", "Rs. 200"],
        ["srv_002", "Domicile Certificate", "Proof of residence for the district of Mardan.", "14 working days", "Rs. 300"],
        ["srv_003", "CNIC Registration", "Apply for a new National Identity Card.", "30 working days", "Rs. 500"],
        ["srv_004", "Business License", "Register a new local business or renew existing license.", "21 working days", "Rs. 2000"],
        ["srv_005", "Property Registration", "Register land or property within municipal limits.", "45 working days", "Varies (percent basis)"],
        ["srv_006", "Utility Connection Request", "Request new water or sanitation utility connections.", "14 working days", "Rs. 1500"]
      ];
      for (const srv of services) {
        await client.query(
          'INSERT INTO services (id, name, description, processing_time, fee) VALUES ($1, $2, $3, $4, $5)',
          srv
        );
      }
      console.log('Seeded initial services.');
    }
    console.log('Database initialized successfully.');
    return true;
  } catch (err) {
    console.warn('Error initializing database:', err.message);
    return false;
  }
  finally {
    if (client) client.release();
  }
};

module.exports = {
  pool,
  initDB
};
