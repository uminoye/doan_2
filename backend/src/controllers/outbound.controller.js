const db = require('../config/database');

// =====================================================================
// 1. LẤY DANH SÁCH PHIẾU XUẤT (Để xem lịch sử)
// =====================================================================
const getAllOutbounds = (req, res) => {
    const query = `
        SELECT
            o.id,
            o.outbound_no,
            o.order_id,
            o.warehouse_id,
            o.export_date,
            o.created_by,
            o.status,
            o.note,
            o.created_at,
            o.updated_at,
            s.order_no,
            s.order_date,
            s.expected_delivery_date,
            s.actual_delivery_date,
            s.status AS order_status,
            s.note AS order_note,
            s.created_at AS order_created_at,
            c.company_name AS customer_name,
            c.phone AS customer_phone,
            c.address AS customer_address,
            w.name AS warehouse_name,
            w.warehouse_code AS warehouse_code,
            u.full_name AS creator_name,
            COALESCE(SUM(soi.quantity * COALESCE(soi.unit_price, 0)), 0) AS total_amount
        FROM stock_outbound_notes o
        LEFT JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN users u ON o.created_by = u.id
        LEFT JOIN sales_orders s ON o.order_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN stock_outbound_note_items soi ON o.id = soi.outbound_note_id
        GROUP BY o.id
        ORDER BY o.id DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi lấy danh sách', error: err.message });

        const outbounds = rows.map(row => ({
            id: row.id,
            order_no: row.order_no,
            order_date: row.order_date,
            expected_delivery_date: row.expected_delivery_date,
            actual_delivery_date: row.actual_delivery_date,
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            customer_address: row.customer_address,
            total_amount: Number(row.total_amount || 0),
            items: [],
            delivery_status: row.delivery_status,
            delivery_note: row.delivery_note,
            warehouse_note: row.warehouse_note,
            status: row.order_status,
            order_status: row.order_status,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }));

        // Load items for each outbound
        const loadItems = (outbound) => {
            return db.all(
                `SELECT soi.id, soi.product_id, p.name as product_name, p.sku as product_sku, soi.quantity
                 FROM stock_outbound_note_items soi
                 LEFT JOIN products p ON soi.product_id = p.id
                 WHERE soi.outbound_note_id = $1`,
                [outbound.id]
            ).then(items => ({ ...outbound, items }));
        };

        Promise.all(outbounds.map(loadItems)).then(results => {
            res.status(200).json(results);
        });
    });
};

// =====================================================================
// 2. THỦ KHO XÁC NHẬN XUẤT KHO
// =====================================================================
const createOutbound = (req, res) => {
    const { outbound_no, order_id, warehouse_id, export_date, note } = req.body;
    const created_by = req.user?.id || 1;

    if (!order_id || !warehouse_id) return res.status(400).json({ message: 'Thiếu thông tin đơn hàng hoặc kho xuất!' });

    db.all(
        `SELECT soi.product_id, soi.quantity, COALESCE(soi.unit_price, p.sale_price, 0) AS unit_price, p.name, p.sku
         FROM sales_order_items soi
         LEFT JOIN products p ON soi.product_id = p.id
         WHERE soi.order_id = $1`,
        [order_id]
    ).then(items => {
        if (!items || items.length === 0) return res.status(400).json({ message: 'Không tìm thấy chi tiết sản phẩm của đơn hàng này!' });

        // Check stock for all items
        const stockChecks = items.map(item =>
            db.get(
                `SELECT b.on_hand_qty, p.name FROM inventory_balances b JOIN products p ON b.product_id = p.id WHERE b.product_id = $1 AND b.warehouse_id = $2`,
                [item.product_id, warehouse_id]
            ).then(row => {
                const stock = row ? row.on_hand_qty : 0;
                if (stock < item.quantity) {
                    throw new Error(`Sản phẩm [${row ? row.name : 'ID:' + item.product_id}] chỉ còn ${stock} cái, không đủ để xuất ${item.quantity} cái!`);
                }
            })
        );

        return Promise.all(stockChecks).then(() => {
            return db.withTransaction(async (client) => {
                const result = await client.query(
                    `INSERT INTO stock_outbound_notes (outbound_no, order_id, warehouse_id, export_date, created_by, note, status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'completed') RETURNING id`,
                    [outbound_no, order_id, warehouse_id, export_date, created_by, note]
                );
                const outboundId = result.rows[0].id;

                for (const item of items) {
                    await client.query(
                        `INSERT INTO stock_outbound_note_items (outbound_note_id, product_id, quantity) VALUES ($1, $2, $3)`,
                        [outboundId, item.product_id, item.quantity]
                    );

                    await client.query(
                        `UPDATE inventory_balances SET on_hand_qty = on_hand_qty - $1, updated_at = NOW()
                         WHERE warehouse_id = $2 AND product_id = $3`,
                        [item.quantity, warehouse_id, item.product_id]
                    );

                    await client.query(
                        `INSERT INTO inventory_transactions (warehouse_id, product_id, transaction_type, quantity, reference_type, reference_id)
                         VALUES ($1, $2, 'OUT', $3, 'stock_outbound', $4)`,
                        [warehouse_id, item.product_id, item.quantity, outboundId]
                    );
                }

                await client.query(`UPDATE sales_orders SET status = 'shipping', updated_at = NOW() WHERE id = $1`, [order_id]);

                res.status(201).json({ message: 'Xuất kho thành công! Đã trừ tồn và cập nhật đơn hàng.', outbound_id: outboundId });
            });
        });
    }).catch(err => {
        if (err.message.includes('chỉ còn')) {
            res.status(400).json({ message: err.message });
        } else {
            console.error('LỖI CREATE OUTBOUND:', err.message);
            res.status(500).json({ message: 'Lỗi xuất kho: ' + err.message });
        }
    });
};

// =====================================================================
// 3. HÀM PHẢN HỒI: TỪ CHỐI HOẶC HẸN NGÀY
// =====================================================================
const respondOutbound = (req, res) => {
    const { order_id } = req.params;
    const { action, reason, expected_date } = req.body;

    const newStatus = action === 'reject' ? 'rejected' : 'delayed';
    const notePrefix = action === 'reject' ? '[KHO TỪ CHỐI]' : '[KHO HẸN GIAO]';
    const finalNote = `${notePrefix}: ${reason}`;

    db.withTransaction(async (client) => {
        await client.query(
            `UPDATE sales_orders SET status = $1, note = $2, updated_at = NOW() WHERE id = $3`,
            [newStatus, finalNote, order_id]
        );

        await client.query(
            `INSERT INTO delivery_requests (order_id, status, logistics_note, warehouse_note, updated_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [order_id, newStatus, reason || null, expected_date || null]
        );

        res.status(200).json({ message: 'Đã gửi phản hồi từ Kho thành công!' });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi cập nhật phản hồi' });
    });
};

// =====================================================================
// 4. LẤY ĐƠN CHỜ XUẤT (PENDING OUTBOUND)
// =====================================================================
const getPendingOutboundRequests = (req, res) => {
    const query = `
        SELECT
            s.id,
            s.order_no,
            s.order_date,
            s.expected_delivery_date,
            CASE 
                WHEN s.status IN ('canceled', 'returned') THEN NULL 
                ELSE s.actual_delivery_date 
            END AS actual_delivery_date,
            s.status AS order_status,
            s.note AS order_note,
            s.created_at,
            s.updated_at,
            c.company_name AS customer_name,
            c.phone AS customer_phone,
            c.address AS customer_address,
            COALESCE(SUM(soi.quantity * COALESCE(soi.unit_price, p.sale_price, 0)), 0) AS total_amount,
            (
                SELECT d.status FROM delivery_requests d
                WHERE d.order_id = s.id ORDER BY d.id DESC LIMIT 1
            ) AS delivery_status,
            (
                SELECT d.logistics_note FROM delivery_requests d
                WHERE d.order_id = s.id ORDER BY d.id DESC LIMIT 1
            ) AS delivery_note,
            (
                SELECT d.warehouse_note FROM delivery_requests d
                WHERE d.order_id = s.id ORDER BY d.id DESC LIMIT 1
            ) AS warehouse_note,
            (
                SELECT son.warehouse_id FROM stock_outbound_notes son
                WHERE son.order_id = s.id ORDER BY son.id DESC LIMIT 1
            ) AS warehouse_id,
            (
                SELECT w.name FROM stock_outbound_notes son
                JOIN warehouses w ON w.id = son.warehouse_id
                WHERE son.order_id = s.id ORDER BY son.id DESC LIMIT 1
            ) AS warehouse_name,
            (
                SELECT son.export_date FROM stock_outbound_notes son
                WHERE son.order_id = s.id ORDER BY son.id DESC LIMIT 1
            ) AS export_date
        FROM sales_orders s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN sales_order_items soi ON s.id = soi.order_id
        LEFT JOIN products p ON soi.product_id = p.id
        WHERE s.status IN ('warehouse_processing', 'shipping', 'completed', 'returned', 'canceled')
            OR EXISTS (
                SELECT 1 FROM delivery_requests d
                WHERE d.order_id = s.id
                    AND COALESCE(d.status, '') IN ('warehouse_processing', 'shipping', 'completed', 'returned', 'canceled')
            )
        GROUP BY s.id
        ORDER BY s.updated_at DESC, s.id DESC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi lấy danh sách đơn chờ xuất', error: err.message });

        const loadItems = (row) => {
            return db.all(
                `SELECT soi.id, soi.product_id, p.name as product_name, p.sku as product_sku, soi.quantity, COALESCE(soi.unit_price, p.sale_price, 0) as unit_price
                 FROM sales_order_items soi
                 LEFT JOIN products p ON soi.product_id = p.id
                 WHERE soi.order_id = $1`,
                [row.id]
            ).then(items => ({
                id: row.id,
                order_no: row.order_no,
                order_date: row.order_date,
                expected_delivery_date: row.expected_delivery_date,
                actual_delivery_date: row.actual_delivery_date,
                customer_name: row.customer_name,
                customer_phone: row.customer_phone,
                customer_address: row.customer_address,
                note: row.order_note || null,
                total_amount: Number(row.total_amount || 0),
                items,
                delivery_status: row.delivery_status,
                delivery_note: row.delivery_note,
                warehouse_note: row.warehouse_note,
                status: row.order_status,
                order_status: row.order_status,
                created_at: row.created_at,
                updated_at: row.updated_at,
                warehouse_id: row.warehouse_id,
                warehouse_name: row.warehouse_name,
                export_date: row.export_date,
            }));
        };

        Promise.all(rows.map(loadItems)).then(results => {
            res.status(200).json(results);
        });
    });
};

// =====================================================================
// 5. TẠO PHIẾU XUẤT TỪ ĐƠN CHỜ (From Pending List)
// =====================================================================
const createOutboundFromPending = (req, res) => {
    const { order_id, warehouse_id, export_date, note } = req.body;
    const created_by = req.user?.id || 1;

    if (!order_id || !warehouse_id) return res.status(400).json({ message: 'Thiếu thông tin đơn hàng hoặc kho xuất!' });

    db.all(
        `SELECT soi.product_id, soi.quantity, COALESCE(soi.unit_price, p.sale_price, 0) AS unit_price
         FROM sales_order_items soi
         LEFT JOIN products p ON soi.product_id = p.id
         WHERE soi.order_id = $1`,
        [order_id]
    ).then(items => {
        if (!items || items.length === 0) return res.status(400).json({ message: 'Không tìm thấy chi tiết sản phẩm của đơn hàng này!' });

        const stockChecks = items.map(item =>
            db.get(
                `SELECT b.on_hand_qty, p.name FROM inventory_balances b JOIN products p ON b.product_id = p.id WHERE b.product_id = $1 AND b.warehouse_id = $2`,
                [item.product_id, warehouse_id]
            ).then(row => {
                const stock = row ? row.on_hand_qty : 0;
                if (stock < item.quantity) {
                    throw new Error(`Sản phẩm [${row ? row.name : 'ID:' + item.product_id}] chỉ còn ${stock} cái, không đủ để xuất ${item.quantity} cái!`);
                }
            })
        );

        return Promise.all(stockChecks).then(() => {
            return db.withTransaction(async (client) => {
                const result = await client.query(
                    `INSERT INTO stock_outbound_notes (outbound_no, order_id, warehouse_id, export_date, created_by, note, status)
                     VALUES ($1, $2, $3, $4, $5, $6, 'completed') RETURNING id`,
                    [`XK-${Date.now()}`, order_id, warehouse_id, export_date || new Date().toISOString().split('T')[0], created_by, note || null]
                );
                const outboundId = result.rows[0].id;

                for (const item of items) {
                    await client.query(
                        `INSERT INTO stock_outbound_note_items (outbound_note_id, product_id, quantity) VALUES ($1, $2, $3)`,
                        [outboundId, item.product_id, item.quantity]
                    );

                    await client.query(
                        `UPDATE inventory_balances SET on_hand_qty = on_hand_qty - $1, updated_at = NOW()
                         WHERE warehouse_id = $2 AND product_id = $3`,
                        [item.quantity, warehouse_id, item.product_id]
                    );

                    await client.query(
                        `INSERT INTO inventory_transactions (warehouse_id, product_id, transaction_type, quantity, reference_type, reference_id)
                         VALUES ($1, $2, 'OUT', $3, 'stock_outbound', $4)`,
                        [warehouse_id, item.product_id, item.quantity, outboundId]
                    );
                }

                await client.query(`UPDATE sales_orders SET status = 'shipping', updated_at = NOW() WHERE id = $1`, [order_id]);

                res.status(201).json({ message: 'Xuất kho thành công! Đã trừ tồn và cập nhật đơn hàng.', outbound_id: outboundId });
            });
        });
    }).catch(err => {
        if (err.message.includes('chỉ còn')) {
            res.status(400).json({ message: err.message });
        } else {
            console.error('LỖI CREATE OUTBOUND PENDING:', err.message);
            res.status(500).json({ message: err.message });
        }
    });
};

const createOutboundFallback = (req, res) => {
    res.status(501).json({ message: 'Chưa hỗ trợ' });
};

module.exports = {
    getAllOutbounds,
    getPendingOutboundRequests,
    createOutbound,
    createOutboundFromPending,
    respondOutbound,
    createOutboundFallback
};
