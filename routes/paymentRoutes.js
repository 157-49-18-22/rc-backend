const express = require('express');
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/create-order', authMiddleware, paymentController.createOrder);
router.post('/verify', authMiddleware, paymentController.verifyPayment);
router.post('/webhook', paymentController.webhookHandler);
router.get('/test-connection', paymentController.testConnection); // Add test endpoint
router.get('/transactions', authMiddleware, paymentController.getTransactions);

module.exports = router;