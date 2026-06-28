const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const logisticsController = require('../controllers/logistics.controller');

router.post('/process', verifyToken, logisticsController.processOrder);

module.exports = router;
