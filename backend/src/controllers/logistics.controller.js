const db = require('../config/database');

const processOrder = (req, res) => {
    const { order_id, new_status, logistics_note } = req.body;
    const handled_by = req.user?.id || req.userId || null;

    if (!order_id || !new_status) {
        return res.status(400).json({ message: 'Thiếu order_id hoặc new_status' });
    }

    db.withTransaction(async (client) => {
        const result = await client.query(
            `UPDATE sales_orders SET status = $1, note = $2, updated_at = NOW() WHERE id = $3 RETURNING id`,
            [new_status, logistics_note || null, order_id]
        );

        if (result.rowCount === 0) {
            throw new Error('Không tìm thấy đơn hàng');
        }

        await client.query(
            `INSERT INTO delivery_requests (order_id, handled_by, received_at, status, logistics_note)
             VALUES ($1, $2, NOW(), $3, $4)`,
            [order_id, handled_by, new_status, logistics_note || null]
        );

        res.status(200).json({ message: 'Logistics đã xử lý đơn! Trạng thái mới: ' + new_status });
    }).catch(err => {
        if (err.message === 'Không tìm thấy đơn hàng') {
            return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
        }
        console.error('LỖI PROCESS ORDER:', err.message);
        res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
    });
};

module.exports = { processOrder };
