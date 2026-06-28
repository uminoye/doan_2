const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const orderController = require('../controllers/order.controller');

router.get('/', verifyToken, orderController.getAllOrders);
router.get('/:id/items', verifyToken, orderController.getOrderItems);
router.post('/', verifyToken, orderController.createOrder);
router.put('/:id', verifyToken, orderController.updateOrder);
router.delete('/:id', verifyToken, orderController.deleteOrder);
router.put('/:id/process-logistics', verifyToken, orderController.processLogistics);
router.put('/:id/issue', verifyToken, orderController.reportWarehouseIssue);
router.put('/:id/export', verifyToken, orderController.exportOrder);
router.put('/:id/confirm-delivery', verifyToken, orderController.confirmDelivery);
router.put('/:id/return-inventory', verifyToken, orderController.returnInventory);

module.exports = router;
