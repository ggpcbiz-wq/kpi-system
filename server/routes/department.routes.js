const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/department.controller');
const { requireAuth } = require('../middleware/auth.middleware');


router.get('/', requireAuth, departmentController.getDepartments);

router.get('/submission-locks', requireAuth, departmentController.getSubmissionLocks);
router.put('/sections/:sectionId/submission-lock', requireAuth, departmentController.setSubmissionLock);

router.put('/:id/process-types', requireAuth, departmentController.updateProcessMappings);


router.put('/sections/:id/process-types', requireAuth, departmentController.updateProcessMappings);

module.exports = router;