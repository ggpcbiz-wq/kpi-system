const express = require('express');
const router = express.Router();
const multer = require('multer'); 
const { requireAuth } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createSubmission, getSubmissions, updateSubmissionStatus } = require('../controllers/submission.controller');

const upload = multer({ storage: multer.memoryStorage() });

// Routes
router.get('/', requireAuth, getSubmissions);

router.post('/', requireAuth, authorizeRoles('Supervisor'), upload.single('attachment'), createSubmission);

router.put('/:id', requireAuth, authorizeRoles('Supervisor', 'Manager', 'Administrator'), updateSubmissionStatus);

module.exports = router;