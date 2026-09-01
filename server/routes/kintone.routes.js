const express = require('express');
const router = express.Router();
const kintoneController = require('../controllers/kintone.controller');

const { requireAuth } = require('../middleware/auth.middleware');

router.get('/departments', requireAuth, kintoneController.fetchDepartments);
router.get('/car/:controlNo', requireAuth, kintoneController.fetchCarDetails);

module.exports = router;