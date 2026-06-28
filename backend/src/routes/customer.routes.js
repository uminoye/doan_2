const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const customerController = require('../controllers/customer.controller');

router.get('/', verifyToken, customerController.getAllCustomers);
router.post('/', verifyToken, customerController.createCustomer);
router.delete('/:id', verifyToken, customerController.deleteCustomer);

module.exports = router;
