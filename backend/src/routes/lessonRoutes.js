const express = require('express');
const lessonController = require('../controllers/lessonController');
const { lessonLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/options', lessonController.options);
router.get('/', lessonController.list);
router.post('/', lessonLimiter, lessonController.create);
router.get('/:id', lessonController.get);
router.get('/:id/audio/:index', lessonController.audio);
router.get('/:id/image/:index', lessonController.image);
router.delete('/:id', lessonController.remove);

module.exports = router;
