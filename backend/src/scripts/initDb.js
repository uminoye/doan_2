/**
 * Script khởi tạo database - chạy 1 lần khi deploy để tạo bảng và seed data
 * Sử dụng: node src/scripts/initDb.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function initDb() {
    console.log('Bắt đầu khởi tạo database...');

    const initSql = fs.readFileSync(
        path.resolve(__dirname, '../../database/init.sql'),
        'utf8'
    );

    try {
        // Tách từng câu lệnh và chạy riêng
        // (pg không hỗ trợ exec nhiều statements cùng lúc qua query())
        const statements = initSql
            .split(/;\s*\n/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            if (stmt.trim()) {
                try {
                    await pool.query(stmt + ';');
                } catch (e) {
                    // Bỏ qua lỗi ON CONFLICT DO NOTHING
                    if (!e.message.includes('duplicate') && !e.message.includes('already exists')) {
                        console.warn('Cảnh báo:', e.message);
                    }
                }
            }
        }

        console.log('Khởi tạo database thành công!');
    } catch (err) {
        console.error('Lỗi khởi tạo database:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

initDb();
