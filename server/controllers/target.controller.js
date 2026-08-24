const targetService = require('../services/target.service');

const getTargets = async (req, res) => {
  try {
    const targets = await targetService.getDashboardTargets(req.user);
    res.status(200).json(targets);
  } catch (error) {
    console.error('Error fetching targets:', error);
    res.status(500).json({ message: 'Failed to fetch KPI targets' });
  }
};

const createTarget = async (req, res) => {
  try {
    const newTarget = await targetService.proposeNewTarget(req.body, req.user);
    res.status(201).json(newTarget);
  } catch (error) {
    console.error('Error creating target:', error);
    if (error.message.includes('required')) {
      return res.status(400).json({ message: error.message });
    }
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to propose KPI target' });
  }
};

const updateTargetStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const allowedRoleByStatus = {
    Active: 'Administrator',
    'Pending Final Activation': 'Top Management',
    Rejected: 'Top Management'
  };

  if (!allowedRoleByStatus[status]) {
    return res.status(400).json({ message: 'Invalid target status transition' });
  }

  if (req.user?.role !== allowedRoleByStatus[status]) {
    return res.status(403).json({ message: 'Forbidden. You cannot apply this target status.' });
  }

  try {
    const updatedTarget = await targetService.changeTargetStatus(id, status, remarks, req.user);
    res.status(200).json(updatedTarget);
  } catch (error) {
    console.error('Error updating target status:', error);
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to update target status' });
  }
};

module.exports = { getTargets, createTarget, updateTargetStatus };