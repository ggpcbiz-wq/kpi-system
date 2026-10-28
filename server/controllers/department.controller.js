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
    const kintoneDepartments = await kintoneService.getUniqueDepartments();
    await departmentRepository.syncKintoneDepartments(kintoneDepartments);

    const syncedDepartments = await departmentRepository.findAll();
    const eligibleSectionsByDepartment = new Map(
      kintoneDepartments.map(department => [
        department.name,
        new Set(department.sections.map(section =>
          section.code ? `code:${section.code}` : `name:${section.name}`
        ))
      ])
    );
    const departments = syncedDepartments
      .filter(department => eligibleSectionsByDepartment.has(department.name))
      .map(department => ({
        ...department,
        sections: department.sections.filter(section => {
          const eligibleSections = eligibleSectionsByDepartment.get(department.name);
          const sectionKey = section.code ? `code:${section.code}` : `name:${section.name}`;
          return eligibleSections.has(sectionKey);
        })
      }));

    res.status(200).json(departments);
  } catch (error) {
    console.error('Error fetching/syncing departments:', error);
    res.status(500).json({ message: 'Failed to retrieve departments from Kintone.' });
  }
};


const updateProcessMappings = async (req, res) => {
  if (!verifyAdmin(req, res)) return;

  const { id } = req.params;  
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