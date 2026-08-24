const departmentRepository = require('../repositories/department.repository');
const kintoneService = require('../services/kintone.service');

// RBAC validation: Administrators only
const verifyAdmin = (req, res) => {
  if (req.user?.role !== 'Administrator') {
    res.status(403).json({ message: 'Access Denied: Administrator privileges required.' });
    return false;
  }
  return true;
};

// Sync with Kintone and return all departments
const getDepartments = async (req, res) => {
  try {
    // Step 1: Fetch fresh department names from Kintone Master App
    const kintoneDeptNames = await kintoneService.getUniqueDepartments();
    
    // Step 2: Upsert into PostgreSQL
    await departmentRepository.syncKintoneDepartments(kintoneDeptNames);

    // Step 3: Fetch updated list with process type mappings
    const departments = await departmentRepository.findAll();
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching/syncing departments:', error);
    // Fallback: If Kintone is unreachable, return local Postgres data
    try {
      const localDepts = await departmentRepository.findAll();
      res.status(200).json(localDepts);
    } catch (dbError) {
      res.status(500).json({ message: 'Failed to retrieve departments.' });
    }
  }
};

// Update process mappings for a specific department
const updateProcessMappings = async (req, res) => {
  if (!verifyAdmin(req, res)) return;

  const { id } = req.params;
  const { processTypes } = req.body;

  try {
    await departmentRepository.updateProcessTypes(id, processTypes, req.user.id || req.user.userId);
    res.status(200).json({ message: 'Process mappings updated successfully.' });
  } catch (error) {
    console.error('Error updating process mappings:', error);
    res.status(500).json({ message: 'Failed to update process mappings.' });
  }
};

module.exports = {
  getDepartments,
  updateProcessMappings
};