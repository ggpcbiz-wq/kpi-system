const express = require('express');
const router = express.Router();
const { getAnnualObjectives } = require('../controllers/annualObjectives.controller');
const { requireAuth } = require('../middleware/auth.middleware');

router.get('/', requireAuth, getAnnualObjectives);

module.exports = router;
