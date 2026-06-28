const db = require('../config/database');

const getAllCustomers = (req, res) => {
    const query = `
        SELECT c.*, u.full_name as creator_name 
        FROM customers c 
        LEFT JOIN users u ON c.created_by = u.id 
        ORDER BY c.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
        res.status(200).json(rows);
    });
};

const createCustomer = (req, res) => {
    const { customer_code, company_name, phone, address, contact_person } = req.body;
    const created_by = req.userId;

    const query = `INSERT INTO customers (customer_code, company_name, phone, address, contact_person, created_by) 
                   VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`;
    db.run(query, [customer_code, company_name, phone, address, contact_person, created_by]).then(result => {
        res.status(201).json({ message: 'Tạo khách hàng thành công', id: result.lastID });
    }).catch(err => {
        if (err.code === '23505') return res.status(400).json({ message: 'Mã khách hàng đã tồn tại!' });
        res.status(500).json({ message: 'Lỗi tạo khách hàng', error: err.message });
    });
};

const deleteCustomer = (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM customers WHERE id = $1`, [id]).then(() => {
        res.status(200).json({ message: 'Đã xóa khách hàng' });
    }).catch(err => {
        res.status(500).json({ message: 'Không thể xóa khách hàng này', error: err.message });
    });
};

module.exports = { getAllCustomers, createCustomer, deleteCustomer };
