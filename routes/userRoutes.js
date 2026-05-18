const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(protect);

router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);

router.get('/', authorize('admin'), userController.getAllUsers);
router.get('/customers', authorize('admin'), userController.getCustomers);
router.get('/:id', authorize('admin'), userController.getUserById);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
