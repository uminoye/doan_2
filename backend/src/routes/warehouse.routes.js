const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const warehouseController = require('../controllers/warehouse.controller');

router.get('/', verifyToken, warehouseController.getAllWarehouses);
router.post('/', verifyToken, warehouseController.createWarehouse);
router.delete('/:id', verifyToken, warehouseController.deleteWarehouse);

module.exports = router;
