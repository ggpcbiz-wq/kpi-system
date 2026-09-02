const departmentRepository = require('../repositories/department.repository');
const kintoneService = require('../services/kintone.service');

const verifyAdmin = (req, res) => {
  if (req.user?.role !== 'Administrator') {
    res.status(403).json({ message: 'Access Denied: Administrator privileges required.' });
    return false;
  }
  return true;
};

const getDepartments = async (req, res) => {
  try {
    const kintoneDeptNames = await kintoneService.getUniqueDepartments();
    await departmentRepository.syncKintoneDepartments(kintoneDeptNames);
    const departments = await departmentRepository.findAll();
    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching/syncing departments:', error);
    try {
      const localDepts = await departmentRepository.findAll();
      res.status(200).json(localDepts);
    } catch (dbError) {
      res.status(500).json({ message: 'Failed to retrieve departments.' });
    }
  }
};

// ✨ ARCHITECTURAL FIX: Target Section ID mapping
const updateProcessMappings = async (req, res) => {
  if (!verifyAdmin(req, res)) return;

  const { id } = req.params; // This is now the Section ID
  const { processTypes } = req.body;

  try {
    await departmentRepository.updateSectionProcessTypes(id, processTypes, req.user.id || req.user.userId);
    res.status(200).json({ message: 'Section process mappings updated successfully.' });
  } catch (error) {
    console.error('Error updating section process mappings:', error);
    res.status(500).json({ message: 'Failed to update section process mappings.' });
  }
};

module.exports = {
  getDepartments,
  updateProcessMappings
};