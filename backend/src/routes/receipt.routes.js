const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const receiptController = require('../controllers/receipt.controller');

router.get('/', receiptController.getAllReceipts);
router.post('/', verifyToken, receiptController.createRequest);
router.put('/:id/respond', receiptController.factoryRespond);
router.put('/:id/confirm', verifyToken, receiptController.confirmReceipt);

module.exports = router;
