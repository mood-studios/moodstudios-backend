const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  changePasswordRules,
  preferencesRules,
  updateProfileRules,
  adminUpdateUserRules,
} = require('../validators/userValidators');

router.use(protect);

router.get('/profile', userController.getProfile);
router.put('/profile', updateProfileRules, validate, userController.updateProfile);
router.get('/preferences', userController.getPreferences);
router.put('/preferences', preferencesRules, validate, userController.updatePreferences);
router.put('/change-password', changePasswordRules, validate, userController.changePassword);
router.delete('/me', userController.deleteMyAccount);

router.get('/', authorize('admin'), userController.getAllUsers);
router.get('/customers', authorize('admin'), userController.getCustomers);
router.get('/:id', authorize('admin'), userController.getUserById);
router.put('/:id', authorize('admin'), adminUpdateUserRules, validate, userController.updateUserByAdmin);
router.delete('/:id', authorize('admin'), userController.deleteUser);

module.exports = router;
