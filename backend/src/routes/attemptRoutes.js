const express = require('express');
const attemptController = require('../controllers/attemptController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', attemptController.list);
router.post('/', attemptController.create);
router.delete('/', attemptController.clear);
router.delete('/:id', attemptController.remove);

module.exports = router;
