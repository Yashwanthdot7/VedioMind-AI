const express = require('express');
const videoController = require('../controllers/videoController');
const { processLimiter, studyLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/process', processLimiter, videoController.processVideo);
router.post('/info', videoController.getVideoInfo);
router.post('/summary', studyLimiter, videoController.summaryForLevel);

module.exports = router;
