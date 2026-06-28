const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = $1`, [email], (err, user) => {
        if (err) return res.status(500).json({ message: 'Lỗi máy chủ', error: err.message });
        if (!user) return res.status(404).json({ message: 'Tài khoản không tồn tại' });

        const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
        if (!passwordIsValid) return res.status(401).json({ message: 'Sai mật khẩu' });

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id },
            process.env.JWT_SECRET || 'KHOA_BIMAT_CUA_DU_AN_XUAT_NHAP_TON',
            { expiresIn: 86400 }
        );

        res.status(200).json({
            message: 'Đăng nhập thành công',
            user: {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                role_id: user.role_id
            },
            accessToken: token
        });
    });
};

const getAllUsers = (req, res) => {
    const query = `SELECT id, email, full_name, role_id FROM users ORDER BY id DESC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Lỗi Database: ' + err.message });
        res.status(200).json(rows);
    });
};

const createUser = (req, res) => {
    const { email, password, full_name, role_id } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ message: 'Vui lòng nhập đủ thông tin!' });

    const hashed_password = bcrypt.hashSync(password, 10);

    const query = `INSERT INTO users (email, password_hash, full_name, role_id) VALUES ($1, $2, $3, $4) RETURNING id`;
    db.run(query, [email, hashed_password, full_name, role_id || 2], (result) => {
        if (result.error) {
            if (result.error.code === '23505') return res.status(400).json({ message: 'Email này đã được sử dụng!' });
            return res.status(500).json({ message: 'Lỗi khi tạo tài khoản' });
        }
        res.status(201).json({ message: 'Tạo tài khoản thành công!' });
    }).catch(err => {
        if (err.code === '23505') return res.status(400).json({ message: 'Email này đã được sử dụng!' });
        res.status(500).json({ message: 'Lỗi khi tạo tài khoản' });
    });
};

const updateUser = (req, res) => {
    const { id } = req.params;
    const { full_name, role_id, password } = req.body;

    let query = `UPDATE users SET full_name = $1, role_id = $2`;
    let params = [full_name, role_id];

    if (password) {
        query += `, password_hash = $3`;
        params.push(bcrypt.hashSync(password, 10));
        query += ` WHERE id = $4`;
        params.push(id);
    } else {
        query += ` WHERE id = $3`;
        params.push(id);
    }

    db.run(query, params).then(result => {
        res.status(200).json({ message: 'Cập nhật thành công!' });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi khi cập nhật tài khoản' });
    });
};

const deleteUser = (req, res) => {
    const { id } = req.params;
    db.get(`SELECT role_id FROM users WHERE id = $1`, [id]).then(user => {
        if (user && user.role_id === 1) {
            return res.status(400).json({ message: 'Tuyệt đối không được xóa tài khoản Admin gốc!' });
        }
        return db.run(`DELETE FROM users WHERE id = $1`, [id]).then(() => {
            res.status(200).json({ message: 'Đã xóa tài khoản nhân viên!' });
        });
    }).catch(() => {
        res.status(500).json({ message: 'Lỗi khi xóa tài khoản' });
    });
};

module.exports = { login, getAllUsers, createUser, updateUser, deleteUser };
