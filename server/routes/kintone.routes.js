const express = require('express');
const router = express.Router();
const kintoneController = require('../controllers/kintone.controller');

// ✨ FIX: Correctly destructure 'requireAuth' matching the middleware export
const { requireAuth } = require('../middleware/auth.middleware');

// GET /api/kintone/departments
// Protected route to fetch unique department names from the Kintone Master App
router.get('/departments', requireAuth, kintoneController.fetchDepartments);

module.exports = router;