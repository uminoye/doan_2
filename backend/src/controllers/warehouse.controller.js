const db = require('../config/database');

const getAllWarehouses = (req, res) => {
    db.all(`SELECT * FROM warehouses ORDER BY id ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi lấy danh sách kho' });
        res.status(200).json(rows);
    });
};

const createWarehouse = (req, res) => {
    const { name, location } = req.body;
    if (!name) return res.status(400).json({ message: 'Tên kho không được để trống' });

    const query = `INSERT INTO warehouses (name, location) VALUES ($1, $2) RETURNING id`;
    db.run(query, [name, location]).then(result => {
        res.status(201).json({ id: result.lastID, name, location });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi khi thêm kho mới' });
    });
};

const deleteWarehouse = (req, res) => {
    const { id } = req.params;

    db.get(`SELECT COALESCE(SUM(on_hand_qty), 0) as total FROM inventory_balances WHERE warehouse_id = $1`, [id]).then(row => {
        if (row && Number(row.total) > 0) {
            return res.status(400).json({ message: `Kho còn ${row.total} món hàng, không thể xóa!` });
        }

        return db.withTransaction(async (client) => {
            await client.query(`DELETE FROM inventory_balances WHERE warehouse_id = $1`, [id]);
            await client.query(`DELETE FROM warehouses WHERE id = $1`, [id]);
            res.status(200).json({ message: 'Đã xóa kho thành công!' });
        });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi kiểm tra tồn kho' });
    });
};

module.exports = { getAllWarehouses, createWarehouse, deleteWarehouse };
