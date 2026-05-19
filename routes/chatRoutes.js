const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const authorize = require('../middleware/authorize');

router.use(protect);

router.get('/studio', chatController.getStudioContact);
router.get('/history', chatController.getChatHistory);
router.post('/messages', chatController.sendMessage);
router.get('/conversations', chatController.getMyConversations);
router.patch('/read', chatController.markAsRead);
router.get('/partners', authorize('admin'), chatController.getAdminChatPartners);

module.exports = router;
