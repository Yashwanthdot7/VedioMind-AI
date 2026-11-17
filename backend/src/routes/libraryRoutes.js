const express = require('express');
const libraryController = require('../controllers/libraryController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', libraryController.list);
router.get('/:analysisId', libraryController.get);
router.patch('/:analysisId', libraryController.update);
router.delete('/:analysisId', libraryController.remove);
router.delete('/:analysisId/chat', libraryController.clearChat);

module.exports = router;
