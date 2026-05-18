const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { body } = require('express-validator');

router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategory);

router.use(protect, authorize('admin'));

router.post('/', [body('name').trim().notEmpty()], validate, categoryController.createCategory);
router.put('/:id', [body('name').optional().trim().notEmpty()], validate, categoryController.updateCategory);
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;
