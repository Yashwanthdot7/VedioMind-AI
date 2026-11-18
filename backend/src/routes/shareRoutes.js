const express = require('express');
const { resolve } = require('../controllers/shareController');

const router = express.Router();
router.get('/:slug', resolve);

module.exports = router;
