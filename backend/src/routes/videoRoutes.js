const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

router.post('/process', videoController.processVideo);
router.post('/info', videoController.getVideoInfo);

module.exports = router;