const express = require('express');
const router = express.Router();
const { getTargets, createTarget, updateTargetStatus } = require('../controllers/target.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Protect all target routes with our JWT middleware
router.use(requireAuth);

// GET /api/targets
router.get('/', getTargets);

// POST /api/targets
router.post('/', authorizeRoles('Manager'), createTarget);

// PATCH /api/targets/:id/status
router.patch('/:id/status', updateTargetStatus);

module.exports = router;