const express = require('express');
const studyController = require('../controllers/studyController');
const { studyLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/:type', studyLimiter, studyController.generate);

module.exports = router;
