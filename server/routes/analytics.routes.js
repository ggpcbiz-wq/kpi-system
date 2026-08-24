const express = require('express');
const router = express.Router();
const { getChartData } = require('../controllers/analytics.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.use(requireAuth);
router.get('/', getChartData);

module.exports = router;