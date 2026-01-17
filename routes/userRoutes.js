const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();

// ✅ SPECIFIC ROUTES FIRST (before /:id)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get('/search', userController.searchUsers);
router.get('/role', authMiddleware, userController.getUserRole);
router.post('/admin/change-password', authMiddleware, adminMiddleware, userController.adminChangePassword);

// ✅ PARAMETERIZED ROUTES LAST
router.delete('/:id', authMiddleware, adminMiddleware, userController.deleteUser);

// Commented routes
// router.post('/forgot-password', userController.forgotPassword);
// router.post('/reset-password', userController.resetPassword);

module.exports = router;