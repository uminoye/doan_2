const db = require('../config/database');

// ==========================================================
// 1. LẤY DANH SÁCH SẢN PHẨM & GỘP TỒN KHO TỪ NHIỀU KHO
// ==========================================================
const getAllProducts = async (req, res) => {
    try {
        const query = `
            SELECT
                p.*,
                COALESCE(p.min_stock, 50) as min_stock,
                COALESCE(SUM(ib.on_hand_qty), 0) as total_stock,
                CASE
                    WHEN COALESCE(SUM(ib.on_hand_qty), 0) = 0 THEN 'Hết hàng'
                    WHEN COALESCE(SUM(ib.on_hand_qty), 0) < COALESCE(p.min_stock, 50) THEN 'Sắp hết hàng'
                    ELSE 'Còn hàng'
                END as stock_status,
                (
                    SELECT STRING_AGG(w.name || ': ' || COALESCE(ib2.on_hand_qty, 0), ' | ' ORDER BY w.id)
                    FROM warehouses w
                    LEFT JOIN inventory_balances ib2 ON w.id = ib2.warehouse_id AND ib2.product_id = p.id
                ) as stock_breakdown
            FROM products p
            LEFT JOIN inventory_balances ib ON p.id = ib.product_id
            GROUP BY p.id
            ORDER BY p.id DESC
        `;

        const rows = await db.all(query);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi Database', error: err.message });
    }
};

const createProduct = async (req, res) => {
    const { sku, name, sale_price, unit, category, image_url, min_stock, warehouse_id, initial_stock } = req.body;

    if (!sku || !name || !sale_price) {
        return res.status(400).json({ message: 'Vui lòng nhập đầy đủ SKU, Tên và Giá' });
    }

    const query = `INSERT INTO products (sku, name, sale_price, unit, category, image_url, min_stock)
                   VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;

    db.run(query, [sku, name, sale_price, unit || 'cái', category || null, image_url || null, parseInt(min_stock, 10) || 50])
        .then(result => {
            const productId = result.lastID;
            const stockQty = parseInt(initial_stock, 10) || 0;

            if (stockQty > 0) {
                if (warehouse_id === 'all') {
                    return db.all(`SELECT id FROM warehouses`, []).then(rows => {
                        const inserts = rows.map(row =>
                            db.run(`INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty) VALUES ($1, $2, $3)`,
                                [row.id, productId, stockQty])
                        );
                        return Promise.all(inserts).then(() =>
                            res.status(201).json({ message: 'Thêm SP và chia đều Tồn kho thành công!' })
                        );
                    });
                } else {
                    return db.run(`INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty) VALUES ($1, $2, $3)`,
                        [warehouse_id, productId, stockQty]
                    ).then(() =>
                        res.status(201).json({ message: 'Thêm SP và lưu Tồn kho thành công!' })
                    );
                }
            } else {
                res.status(201).json({ message: 'Thêm sản phẩm thành công (Tồn kho 0)' });
            }
        })
        .catch(err => {
            if (err.code === '23505') return res.status(400).json({ message: `Mã SKU "${sku}" đã tồn tại!` });
            res.status(500).json({ message: 'Lỗi Database' });
        });
};

const updateProduct = (req, res) => {
    const { id } = req.params;
    const { sku, name, sale_price, unit, category, image_url, min_stock, adjust_stock, target_warehouse } = req.body;

    const query = `UPDATE products SET sku = $1, name = $2, sale_price = $3, unit = $4, category = $5, image_url = $6, min_stock = $7 WHERE id = $8`;
    db.run(query, [sku, name, sale_price, unit, category || null, image_url || null, parseInt(min_stock, 10) || 50, id])
        .then(() => {
            if (adjust_stock !== undefined && adjust_stock !== '' && target_warehouse) {
                if (target_warehouse === 'all') {
                    return res.status(400).json({ message: 'Muốn sửa tồn kho thì phải chọn đúng 1 kho cụ thể, không được chọn "Tất cả"!' });
                }

                const newQty = parseInt(adjust_stock, 10) || 0;
                return db.get(`SELECT id FROM inventory_balances WHERE product_id = $1 AND warehouse_id = $2`, [id, target_warehouse])
                    .then(row => {
                        if (row) {
                            return db.run(`UPDATE inventory_balances SET on_hand_qty = $1 WHERE product_id = $2 AND warehouse_id = $3`,
                                [newQty, id, target_warehouse]).then(() =>
                                res.status(200).json({ message: 'Đã cập nhật SP và Điều chỉnh tồn kho thành công!' })
                            );
                        } else {
                            return db.run(`INSERT INTO inventory_balances (warehouse_id, product_id, on_hand_qty) VALUES ($1, $2, $3)`,
                                [target_warehouse, id, newQty]).then(() =>
                                res.status(200).json({ message: 'Đã cập nhật SP và Điều chỉnh tồn kho thành công!' })
                            );
                        }
                    });
            } else {
                res.status(200).json({ message: 'Cập nhật thông tin sản phẩm thành công!' });
            }
        })
        .catch(err => {
            if (err.code === '23505') return res.status(400).json({ message: `Mã SKU "${sku}" đã tồn tại!` });
            res.status(500).json({ message: 'Lỗi Database khi cập nhật thông tin' });
        });
};

const deleteProduct = (req, res) => {
    const { id } = req.params;

    const checkQuery = `
        SELECT COALESCE(SUM(on_hand_qty), 0) AS total_stock
        FROM inventory_balances
        WHERE product_id = $1
    `;

    db.get(checkQuery, [id]).then(row => {
        const totalStock = Number(row?.total_stock || 0);
        if (totalStock > 0) {
            return res.status(400).json({
                message: 'Không thể xóa sản phẩm vì vẫn còn tồn kho. Hãy xuất hết hàng trước khi xóa.',
            });
        }

        return db.run(`DELETE FROM products WHERE id = $1`, [id]).then(result => {
            if (result.changes === 0) {
                return res.status(404).json({ message: 'Không tìm thấy sản phẩm cần xóa' });
            }
            return res.status(200).json({ message: 'Xóa sản phẩm thành công' });
        });
    }).catch(err => {
        res.status(500).json({ message: 'Lỗi khi xóa sản phẩm', error: err.message });
    });
};

module.exports = { getAllProducts, createProduct, updateProduct, deleteProduct };
