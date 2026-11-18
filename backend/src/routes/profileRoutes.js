const express = require('express');
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.get('/', requireAuth, profileController.get);
router.put('/', requireAuth, profileController.update);

module.exports = router;
