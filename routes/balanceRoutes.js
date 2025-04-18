const express = require('express');
const balanceController = require('../controllers/balanceController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');  // Import the adminMiddleware
const router = express.Router();

// Admin can allocate balance (secured with adminMiddleware)
router.post('/allocate', authMiddleware, adminMiddleware, balanceController.allocateBalance);

// User can deduct balance (no admin check needed here)
router.post('/deduct', authMiddleware, balanceController.deductBalance);
router.get('/balance', authMiddleware, balanceController.getBalance);
module.exports = router;
