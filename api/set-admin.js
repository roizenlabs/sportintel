import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setAdmin() {
  try {
    const result = await pool.query(
      "UPDATE users SET is_admin = true WHERE email = 'shawnsonnier04@gmail.com' RETURNING id, email, is_admin"
    );
    console.log('Updated user:', result.rows);
    if (result.rows.length === 0) {
      console.log('No user found with that email');
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

setAdmin();
