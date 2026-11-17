const express = require('express');
const chatController = require('../controllers/chatController');
const { chatLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/conversation', chatLimiter, chatController.conversation);
router.post('/ask', chatLimiter, chatController.askQuestion);

module.exports = router;
