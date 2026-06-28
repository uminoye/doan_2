const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    let token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'Không tìm thấy thẻ xác thực (Token)' });

    try {
        const tokenBody = token.split(' ')[1];
        const decoded = jwt.verify(tokenBody, process.env.JWT_SECRET || 'KHOA_BIMAT_CUA_DU_AN_XUAT_NHAP_TON');
        req.userId = decoded.id;
        req.userRole = decoded.role_id;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
};

module.exports = { verifyToken };
