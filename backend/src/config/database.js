/**
 * Database configuration for PostgreSQL (Neon)
 * Wrapper để giữ API tương tự sqlite3: db.get(), db.all(), db.run()
 * Sử dụng pg Pool với auto-transaction helper
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace('&channel_binding=require', ''),
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Wrapper hứng kết quả từ pg
const query = (text, params) => pool.query(text, params);

// ============ Wrapper methods ============

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result.rows[0] || null);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve(result.rows || []);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve({ lastID: result.rows[0]?.id || result.insertId, changes: result.rowCount });
    });
  });
};

// Run raw SQL (no return)
const dbExec = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) return reject(err);
      resolve({ changes: result.rowCount });
    });
  });
};

// Transaction helper - nhận function async (client) => { ... }
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// db.get - synchronous-style (legacy compat)
const get = (sql, params = []) => dbGet(sql, params);

// db.all - synchronous-style (legacy compat)
const all = (sql, params = []) => dbAll(sql, params);

// db.run - synchronous-style (legacy compat)
// Lưu ý: pg không có lastID, dùng RETURNING id
const run = (sql, params = []) => dbRun(sql, params);

module.exports = {
  pool,
  query,
  dbGet,
  dbAll,
  dbRun,
  dbExec,
  withTransaction,
  get,
  all,
  run,
};
