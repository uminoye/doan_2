require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const customerRoutes = require('./routes/customer.routes');
const orderRoutes = require('./routes/order.routes');
const receiptRoutes = require('./routes/receipt.routes');
const logisticsRoutes = require('./routes/logistics.routes');
const outboundRoutes = require('./routes/outbound.routes');
const reportRoutes = require('./routes/report.routes');
const warehouseRoutes = require('./routes/warehouse.routes');
const uploadRoutes = require('./routes/upload.routes');

const app = express();

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://doan-2.vercel.app',
    'https://doan-2-le3ra5jot-minhthu.vercel.app',
    'https://doan-2-frontend.vercel.app',
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
app.use(express.json());

// Health check - truly validates DB connection
const db = require('./config/database');
app.get('/api/health', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ status: 'db_error', error: err.message });
    }
});
app.get('/api/test', async (req, res) => {
    try {
        await db.query('SELECT 1');
        res.json({
            message: 'Server Backend đã hoạt động!',
            database: 'Kết nối PostgreSQL (Neon) thành công.',
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(500).json({
            message: 'Server hoạt động nhưng database lỗi!',
            error: err.message,
        });
    }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/receipts', receiptRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/outbounds', outboundRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/uploads', uploadRoutes);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// Error handler
app.use((err, req, res, next) => {
    console.error('ERROR:', err.stack);
    res.status(500).json({ message: 'Đã có lỗi xảy ra trên server!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server chạy tại: http://localhost:${PORT}`);
    console.log(`API Test: http://localhost:${PORT}/api/test`);
});
