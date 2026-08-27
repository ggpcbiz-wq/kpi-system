const express = require('express');
const router = express.Router();
const multer = require('multer'); 
const { requireAuth } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createSubmission, getSubmissions, updateSubmissionStatus } = require('../controllers/submission.controller');

// ✨ ARCHITECTURAL FIX: Enforce a strict 20MB file size limit to prevent memory exhaustion
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit[cite: 20]
});

// Routes[cite: 20]
router.get('/', requireAuth, getSubmissions);

// Intercept multipart/form-data and append the file to req.file
router.post('/', requireAuth, authorizeRoles('Supervisor'), upload.single('attachment'), createSubmission);

router.put('/:id', requireAuth, authorizeRoles('Supervisor', 'Manager', 'Administrator'), updateSubmissionStatus);

module.exports = router;