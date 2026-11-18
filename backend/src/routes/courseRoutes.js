const express = require('express');
const courseController = require('../controllers/courseController');
const { courseLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/', courseController.list);
router.post('/', courseLimiter, courseController.create);
router.get('/:id', courseController.get);
router.post('/:id/share', courseController.share);
router.delete('/:id', courseController.remove);

module.exports = router;
