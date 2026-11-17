const express = require('express');
const videoController = require('../controllers/videoController');
const { processLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/process', processLimiter, videoController.processVideo);
router.post('/info', videoController.getVideoInfo);

module.exports = router;
