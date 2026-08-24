const express = require('express');
const router = express.Router();

// ✨ FIX: Imported the new lookupEmployee function
const { 
  getAllUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  lookupEmployee 
} = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Apply the JWT verification middleware to all user routes
router.use(requireAuth);
router.use(authorizeRoles('Administrator'));

// ✨ FIX: Added the lookup route for Kintone integration
router.get('/lookup', lookupEmployee);

router.get('/', getAllUsers);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;