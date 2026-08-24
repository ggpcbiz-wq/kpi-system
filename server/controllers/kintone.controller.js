const kintoneService = require('../services/kintone.service');

const fetchDepartments = async (req, res) => {
  try {
    const departments = await kintoneService.getUniqueDepartments();
    res.status(200).json(departments);
  } catch (error) {
    console.error("Controller Error syncing Kintone:", error);
    res.status(500).json({ message: 'Failed to synchronize departments from Kintone.' });
  }
};

// CRITICAL: Ensure this export exists so the router can import it
module.exports = { fetchDepartments };