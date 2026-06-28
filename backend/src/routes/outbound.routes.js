const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/auth.middleware');
const outboundController = require('../controllers/outbound.controller');

router.get('/', verifyToken, outboundController.getAllOutbounds);
router.get('/pending', verifyToken, outboundController.getPendingOutboundRequests);
router.post('/', verifyToken, outboundController.createOutbound);
router.put('/:order_id/respond', verifyToken, outboundController.respondOutbound);
router.post('/from-pending', verifyToken, outboundController.createOutboundFromPending);

module.exports = router;
