const db = require('../config/database');

// 1. LẤY DANH SÁCH PHIẾU
const getAllReceipts = (req, res) => {
    const query = `
        SELECT p.*, w.name as warehouse_name, u.full_name as creator_name
        FROM production_receipts p
        LEFT JOIN warehouses w ON p.warehouse_id = w.id
        LEFT JOIN users u ON p.created_by = u.id
        ORDER BY p.id DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });

        if (!rows.length) return res.status(200).json([]);

        const receiptIds = rows.map(row => row.id);
        const placeholders = receiptIds.map((_, i) => `$${i + 1}`).join(',');

        db.all(
            `SELECT pri.receipt_id, pri.product_id, pri.quantity, p.name as product_name
             FROM production_receipt_items pri
             LEFT JOIN products p ON p.id = pri.product_id
             WHERE pri.receipt_id IN (${placeholders})
             ORDER BY pri.id ASC`,
            receiptIds,
            (itemErr, items) => {
                if (itemErr) return res.status(500).json({ message: 'Lỗi máy chủ', error: itemErr.message });

                const itemsByReceipt = items.reduce((acc, item) => {
                    if (!acc[item.receipt_id]) acc[item.receipt_id] = [];
                    acc[item.receipt_id].push(item);
                    return acc;
                }, {});

                const result = rows.map(row => ({
                    ...row,
                    items: itemsByReceipt[row.id] || []
                }));

                return res.status(200).json(result);
            }
        );
    });
};

// 2. KHO TẠO YÊU CẦU (Status: PENDING)
const createRequest = (req, res) => {
    const { receipt_no, warehouse_id, receipt_date, note, items } = req.body;
    const created_by = req.user?.id || 1;

    if (!items || items.length === 0) return res.status(400).json({ message: 'Phải có sản phẩm!' });

    db.withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO production_receipts (receipt_no, warehouse_id, receipt_date, created_by, note, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING') RETURNING id`,
            [receipt_no, warehouse_id, receipt_date, created_by, note]
        );
        const receiptId = result.rows[0].id;

        for (const item of items) {
            await client.query(
                `INSERT INTO production_receipt_items (receipt_id, product_id, quantity) VALUES ($1, $2, $3)`,
                [receiptId, item.product_id, item.quantity]
            );
        }

        res.status(201).json({ message: 'Đã gửi yêu cầu cho Nhà máy!' });
    }).catch(err => {
        console.error('LỖI TẠO PHIẾU NHẬP:', err.message);
        res.status(400).json({ message: 'Lỗi tạo phiếu (Mã trùng)', error: err.message });
    });
};

// 3. NHÀ MÁY PHẢN HỒI (Status: PROCESSING hoặc REJECTED)
const factoryRespond = (req, res) => {
    const receiptId = req.params.id;
    const { action, expected_date, reason } = req.body;
    const respondentName = req.user?.full_name || req.user?.name || null;

    if (!receiptId) return res.status(400).json({ message: 'Thiếu mã phiếu cần xử lý.' });
    if (!['accept', 'reject'].includes(action)) return res.status(400).json({ message: 'Hành động không hợp lệ.' });
    if (action === 'accept' && !expected_date) return res.status(400).json({ message: 'Vui lòng chọn ngày giao dự kiến trước khi duyệt.' });

    db.get(`SELECT status, note FROM production_receipts WHERE id = $1`, [receiptId]).then(receipt => {
        if (!receipt) return res.status(404).json({ message: 'Không tìm thấy phiếu cần xử lý.' });
        if (receipt.status !== 'PENDING') return res.status(400).json({ message: `Phiếu hiện đang ở trạng thái ${receipt.status}, không thể duyệt.` });

        const newStatus = action === 'accept' ? 'PROCESSING' : 'REJECTED';
        const finalNote = `[NM Phản hồi]: ${reason || 'Không có lý do'} | Cũ: ${receipt.note || ''}`;

        return db.run(
            `UPDATE production_receipts SET status = $1, receipt_date = $2, note = $3, responded_by = $4, responded_reason = $5, expected_delivery_date = $6 WHERE id = $7`,
            [newStatus, expected_date || null, finalNote, respondentName, reason || null, expected_date || null, receiptId]
        ).then(() => {
            res.status(200).json({
                message: action === 'accept' ? 'Đã duyệt phiếu và hẹn ngày giao hàng!' : 'Đã từ chối yêu cầu nhập kho!',
            });
        });
    }).catch(err => {
        console.error('[receipt.factoryRespond] UPDATE failed', err.message);
        res.status(500).json({ message: 'Lỗi cập nhật phiếu duyệt.', error: err.message });
    });
};

// 4. KHO XÁC NHẬN ĐÃ NHẬN HÀNG (Status: COMPLETED -> CỘNG TỒN)
const confirmReceipt = (req, res) => {
    const receiptId = req.params.id;

    db.get(`SELECT status, warehouse_id FROM production_receipts WHERE id = $1`, [receiptId]).then(receipt => {
        if (!receipt || receipt.status !== 'PROCESSING') {
            return res.status(400).json({ message: 'Nhà máy chưa giao hoặc phiếu đã chốt!' });
        }

        const wId = receipt.warehouse_id;

        return db.all(`SELECT product_id, quantity FROM production_receipt_items WHERE receipt_id = $1`, [receiptId]).then(items => {
            return db.withTransaction(async (client) => {
                for (const item of items) {
                    // Update or insert inventory balance
                    const existing = await client.query(
                        `SELECT id FROM inventory_balances WHERE product_id = $1 AND warehouse_id = $2`,
                        [item.product_id, wId]
                    );

                    if (existing.rows.length > 0) {
                        await client.query(
                            `UPDATE inventory_balances SET on_hand_qty = on_hand_qty + $1, updated_at = NOW() WHERE id = $2`,
                            [item.quantity, existing.rows[0].id]
                        );
                    } else {
                        await client.query(
                            `INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty) VALUES ($1, $2, $3)`,
                            [wId, item.product_id, item.quantity]
                        );
                    }

                    await client.query(
                        `INSERT INTO inventory_transactions (warehouse_id, product_id, transaction_type, quantity, reference_type, reference_id)
                         VALUES ($1, $2, 'IN', $3, 'production_receipt', $4)`,
                        [wId, item.product_id, item.quantity, receiptId]
                    );
                }

                await client.query(`UPDATE production_receipts SET status = 'COMPLETED' WHERE id = $1`, [receiptId]);
                res.status(200).json({ message: 'Đã nhận hàng và cộng tồn kho!' });
            });
        });
    }).catch(err => {
        console.error('LỖI CONFIRM RECEIPT:', err.message);
        res.status(500).json({ message: 'Lỗi cộng kho: ' + err.message });
    });
};

module.exports = { getAllReceipts, createRequest, factoryRespond, confirmReceipt };
