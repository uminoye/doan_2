const db = require('../config/database');

// 1. Lấy danh sách tất cả đơn hàng kèm chi tiết sản phẩm
const getAllOrders = (req, res) => {
    const query = `
        SELECT
            o.id,
            o.order_no,
            o.customer_id,
            c.company_name as customer_name,
            o.order_date,
            o.expected_delivery_date,
            o.actual_delivery_date,
            o.created_by,
            o.status,
            o.note,
            o.created_at,
            o.updated_at,
            oi.id as item_id,
            oi.product_id,
            oi.quantity,
            oi.unit_price,
            p.name as product_name,
            p.sku as product_sku
        FROM sales_orders o
        JOIN customers c ON o.customer_id = c.id
        LEFT JOIN sales_order_items oi ON oi.order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        ORDER BY o.created_at DESC, oi.id ASC
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });

        const ordersMap = new Map();

        rows.forEach((row) => {
            if (!ordersMap.has(row.id)) {
                ordersMap.set(row.id, {
                    id: row.id,
                    order_no: row.order_no,
                    customer_id: row.customer_id,
                    customer_name: row.customer_name,
                    order_date: row.order_date,
                    expected_delivery_date: row.expected_delivery_date,
                    actual_delivery_date: row.actual_delivery_date,
                    created_by: row.created_by,
                    status: row.status,
                    note: row.note,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    items: [],
                });
            }

            if (row.item_id) {
                ordersMap.get(row.id).items.push({
                    id: row.item_id,
                    product_id: row.product_id,
                    product_name: row.product_name,
                    product_sku: row.product_sku,
                    quantity: row.quantity,
                    unit_price: row.unit_price,
                });
            }
        });

        res.status(200).json(Array.from(ordersMap.values()));
    });
};

// 2. Lấy chi tiết các sản phẩm bên trong 1 đơn hàng
const getOrderItems = (req, res) => {
    const { id } = req.params;
    db.all(`SELECT * FROM sales_order_items WHERE order_id = $1`, [id], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi máy chủ' });
        res.status(200).json(rows);
    });
};

// 3. Sales tạo đơn hàng mới
const createOrder = (req, res) => {
    const { order_no, customer_id, order_date, expected_delivery_date, note, items } = req.body;

    db.withTransaction(async (client) => {
        const result = await client.query(
            `INSERT INTO sales_orders (order_no, customer_id, order_date, expected_delivery_date, note, status)
             VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING id`,
            [order_no, customer_id, order_date, expected_delivery_date, note]
        );
        const orderId = result.rows[0].id;

        for (const item of items) {
            await client.query(
                `INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
                [orderId, item.product_id, item.quantity, item.unit_price]
            );
        }

        res.status(201).json({ message: 'Tạo đơn hàng thành công', id: orderId });
    }).catch(err => {
        console.error('LỖI DATABASE KHI TẠO ĐƠN:', err.message);
        res.status(500).json({ message: 'Lỗi Database: ' + err.message });
    });
};

// 4. Sales cập nhật toàn bộ đơn hàng (Sửa & Gửi lại)
const updateOrder = (req, res) => {
    const orderId = req.params.id;
    const { customer_id, expected_delivery_date, note, items } = req.body;

    db.withTransaction(async (client) => {
        await client.query(
            `UPDATE sales_orders SET customer_id = $1, expected_delivery_date = $2, note = $3, status = 'pending', updated_at = NOW() WHERE id = $4`,
            [customer_id, expected_delivery_date, note, orderId]
        );

        await client.query(`DELETE FROM sales_order_items WHERE order_id = $1`, [orderId]);

        for (const item of items) {
            await client.query(
                `INSERT INTO sales_order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
                [orderId, item.product_id, item.quantity, item.unit_price]
            );
        }

        res.status(200).json({ message: 'Đã cập nhật toàn bộ đơn hàng!' });
    }).catch(err => {
        console.error('LỖI UPDATE ORDER:', err.message);
        res.status(500).json({ message: 'Lỗi cập nhật đơn: ' + err.message });
    });
};

// 5. Xóa đơn hàng (Chỉ cho phép xóa khi đơn đang chờ duyệt hoặc bị từ chối)
const deleteOrder = (req, res) => {
    const { id } = req.params;
    db.get(`SELECT status FROM sales_orders WHERE id = $1`, [id]).then(row => {
        if (!row) return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });

        const currentStatus = row.status || 'pending';

        if (currentStatus !== 'pending' && currentStatus !== 'returned') {
            return res.status(400).json({ message: 'Không thể xóa đơn hàng đã được xử lý hoặc hoàn thành!' });
        }

        return db.withTransaction(async (client) => {
            await client.query(`DELETE FROM sales_order_items WHERE order_id = $1`, [id]);
            await client.query(`DELETE FROM sales_orders WHERE id = $1`, [id]);
            res.status(200).json({ message: 'Đã xóa đơn hàng thành công' });
        });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi khi xóa' });
    });
};

// 6. Logistics xử lý đơn (Duyệt hoặc Từ chối)
const processLogistics = (req, res) => {
    const { order_id, new_status, reason_type, detail_note } = req.body;

    let finalNote = '';
    if (new_status === 'returned') {
        finalNote = `[LOGISTICS TỪ CHỐI]: ${reason_type} | Chi tiết: ${detail_note}`;
    } else {
        finalNote = detail_note;
    }

    db.withTransaction(async (client) => {
        await client.query(
            `UPDATE sales_orders SET status = $1, note = $2, updated_at = NOW() WHERE id = $3`,
            [new_status, finalNote, order_id]
        );

        await client.query(
            `INSERT INTO delivery_requests (order_id, handled_by, received_at, status, logistics_note, warehouse_note)
             VALUES ($1, $2, NOW(), $3, $4, NULL)`,
            [order_id, req.user?.id || null, new_status, finalNote]
        );

        res.status(200).json({ message: 'Đã cập nhật trạng thái đơn hàng!' });
    }).catch(err => {
        console.error('LỖI PROCESS LOGISTICS:', err.message);
        res.status(500).json({ message: 'Lỗi khi xử lý đơn hàng' });
    });
};

// 7. Kho báo lỗi
const reportWarehouseIssue = (req, res) => {
    const { id } = req.params;
    const { issue_note } = req.body;

    db.get(`SELECT note FROM sales_orders WHERE id = $1`, [id]).then(row => {
        const currentNote = row ? (row.note || '') : '';
        const newNote = `[KHO BÁO LỖI]: ${issue_note} | Ghi chú cũ: ${currentNote}`;

        return db.run(
            `UPDATE sales_orders SET status = 'logistics_review', note = $1, updated_at = NOW() WHERE id = $2`,
            [newNote, id]
        ).then(() => {
            res.status(200).json({ message: 'Đã báo lỗi và gửi về cho Logistics!' });
        });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi khi báo thiếu hàng' });
    });
};

// 8. Xuất kho: Đổi status từ 'warehouse_processing' sang 'shipping'
const exportOrder = (req, res) => {
    const orderId = req.params.id;

    db.run(
        `UPDATE sales_orders SET status = 'shipping', updated_at = NOW() WHERE id = $1`,
        [orderId]
    ).then(() => {
        res.status(200).json({ message: 'Đã xuất kho, đơn hàng chuyển sang trạng thái Đang giao!' });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi chốt đơn' });
    });
};

// 9. Xác nhận đã giao hàng thành công
const confirmDelivery = (req, res) => {
    const orderId = req.params.id;
    db.run(
        `UPDATE sales_orders SET status = 'completed', actual_delivery_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1`,
        [orderId]
    ).then(() => {
        res.status(200).json({ message: 'Xác nhận đơn hàng đã giao thành công!' });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi xác nhận giao hàng' });
    });
};

// 10. Hủy đơn: Xử lý cả "bom hàng" lẫn "bị từ chối/hủy sớm"
const returnInventory = (req, res) => {
    const orderId = req.params.id;

    db.withTransaction(async (client) => {
        const outboundResult = await client.query(
            `SELECT warehouse_id FROM stock_outbound_notes WHERE order_id = $1 ORDER BY id DESC LIMIT 1`,
            [orderId]
        );

        if (outboundResult.rows.length > 0) {
            // TRƯỜNG HỢP 1: ĐÃ XUẤT KHO -> PHẢI HOÀN KHO
            const oldWarehouseId = outboundResult.rows[0].warehouse_id;

            const itemsResult = await client.query(
                `SELECT product_id, quantity FROM sales_order_items WHERE order_id = $1`,
                [orderId]
            );

            for (const item of itemsResult.rows) {
                await client.query(
                    `UPDATE inventory_balances SET on_hand_qty = COALESCE(on_hand_qty, 0) + $1
                     WHERE product_id = $2 AND warehouse_id = $3`,
                    [item.quantity, item.product_id, oldWarehouseId]
                );
            }

            await client.query(
                `UPDATE sales_orders SET status = 'canceled', actual_delivery_date = NULL, updated_at = NOW() WHERE id = $1`,
                [orderId]
            );

            res.status(200).json({ message: `Bom hàng: Đã hoàn trả tồn kho về Kho ID ${oldWarehouseId} và cập nhật trạng thái hủy đơn!` });

        } else {
            // TRƯỜNG HỢP 2: CHƯA XUẤT KHO -> CHỈ ĐỔI TRẠNG THÁI
            await client.query(
                `UPDATE sales_orders SET status = 'returned', actual_delivery_date = NULL, updated_at = NOW() WHERE id = $1`,
                [orderId]
            );
            res.status(200).json({ message: 'Đã cập nhật đơn thành trạng thái hoàn trả/từ chối.' });
        }
    }).catch(err => {
        console.error('LỖI RETURN INVENTORY:', err.message);
        res.status(500).json({ message: 'Lỗi khi xử lý hủy đơn: ' + err.message });
    });
};

module.exports = {
    getAllOrders,
    getOrderItems,
    createOrder,
    updateOrder,
    deleteOrder,
    processLogistics,
    reportWarehouseIssue,
    exportOrder,
    confirmDelivery,
    returnInventory
};
