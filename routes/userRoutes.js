const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/role', userController.getUserRole);
router.post('/register', userController.register);
router.post('/login', userController.login);
router.get("/search", userController.searchUsers);
module.exports = router;
