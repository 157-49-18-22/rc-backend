const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

const router = express.Router();
router.delete('/:id',  authMiddleware, adminMiddleware, userController.deleteUser);
router.get('/role', userController.getUserRole);
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get("/search", userController.searchUsers);
router.post('/forgot-password', userController.forgotPassword);
// Route for Reset Password: Updates the password if the token is valid
router.post('/reset-password', userController.resetPassword);
module.exports = router;
