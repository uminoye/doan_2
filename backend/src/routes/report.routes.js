const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');

router.get('/dashboard', reportController.getDashboardStats);
router.get('/inventory', reportController.getInventoryReport);

module.exports = router;
