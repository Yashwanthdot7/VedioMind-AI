const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.post('/ask', chatController.askQuestion);
router.post('/conversation', chatController.conversation);

module.exports = router;