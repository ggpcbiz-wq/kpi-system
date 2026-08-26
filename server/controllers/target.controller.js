const targetService = require('../services/target.service');

const getTargets = async (req, res) => {
  try {
    // 1. RBAC Context Validation
    // ✨ FIX: Support both 'userId' (JWT) and 'id' (Session) payload structures
    const activeUserId = req.user?.userId || req.user?.id;
    
    if (!req.user || !activeUserId) {
      return res.status(401).json({ message: 'Unauthorized. Invalid user context.' });
    }

    // 2. Delegate to Data Access Layer
    const targets = await targetService.getDashboardTargets(req.user);
    
    // 3. Respond
    return res.status(200).json(targets);
  } catch (error) {
    console.error('[Target Controller Error] Failed to fetch targets:', error.message, error.stack);
    return res.status(500).json({ 
      message: 'Failed to fetch KPI targets. Check backend logs for SQL exceptions.' 
    });
  }
};

const createTarget = async (req, res) => {
  try {
    const newTarget = await targetService.proposeNewTarget(req.body, req.user);
    res.status(201).json(newTarget);
  } catch (error) {
    console.error('[Target Controller Error] Failed to propose target:', error);
    if (error.message.includes('required')) return res.status(400).json({ message: error.message });
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error while processing target proposal.' });
  }
};

const updateTargetStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const allowedRoleByStatus = {
    'Active': 'Administrator',
    'Pending Final Activation': 'Top Management',
    'Rejected': 'Top Management'
  };

  if (!allowedRoleByStatus[status]) {
    return res.status(400).json({ message: 'Invalid target state transition requested.' });
  }

  // Strict RBAC Enforcement
  if (req.user?.role !== allowedRoleByStatus[status]) {
    return res.status(403).json({ message: `Forbidden. Role [${req.user?.role}] cannot authorize state [${status}].` });
  }

  try {
    const updatedTarget = await targetService.changeTargetStatus(id, status, remarks, req.user);
    res.status(200).json(updatedTarget);
  } catch (error) {
    console.error('[Target Controller Error] Failed status transition:', error);
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: error.message });
    res.status(500).json({ message: 'Failed to update target status.' });
  }
};

module.exports = { getTargets, createTarget, updateTargetStatus };