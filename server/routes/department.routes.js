const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// GET /api/departments (Syncs Kintone + returns local records with mappings)
router.get('/', requireAuth, departmentController.getDepartments);

// PUT /api/departments/:id/process-types (Updates assigned process types for a department)
router.put('/:id/process-types', requireAuth, departmentController.updateProcessMappings);

// PUT /api/sections/:id/process-types (Note the endpoint change to /sections/)
router.put('/sections/:id/process-types', requireAuth, departmentController.updateProcessMappings);

module.exports = router;