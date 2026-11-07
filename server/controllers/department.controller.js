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

const getSubmissionLocks = async (req, res) => {
  try {
    const locks = await departmentRepository.findSubmissionLocks();
    res.status(200).json(locks);
  } catch (error) {
    console.error('Error fetching section submission locks:', error);
    res.status(500).json({ message: 'Failed to retrieve section submission locks.' });
  }
};

const setSubmissionLock = async (req, res) => {
  if (!verifyAdmin(req, res)) return;

  const { sectionId } = req.params;
  const { reportYear, reportMonth, isLocked } = req.body;
  const year = Number(reportYear);
  const month = Number(reportMonth);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ message: 'Report year must be between 2000 and 2100.' });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ message: 'Report month must be between 1 and 12.' });
  }
  if (typeof isLocked !== 'boolean') {
    return res.status(400).json({ message: 'isLocked must be a boolean.' });
  }

  try {
    const userId = req.user.id || req.user.userId;
    const result = await departmentRepository.setSubmissionLock(
      sectionId,
      year,
      month,
      isLocked,
      userId
    );
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating section submission lock:', error);
    res.status(500).json({ message: 'Failed to update section submission lock.' });
  }
};

module.exports = {
  getDepartments,
  updateProcessMappings,
  getSubmissionLocks,
  setSubmissionLock
};