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

const fetchCarDetails = async (req, res) => {
  try {
    const { controlNo } = req.params;
    
    const kintoneRecord = await kintoneService.getCarByControlNumber(controlNo);
    
    if (!kintoneRecord) {
      return res.status(404).json({ message: 'CAR Record not found in Kintone.' });
    }

    // Map the Kintone Field Codes to the UI DTO
    const mappedData = {
      control_no: kintoneRecord.control_number?.value || controlNo,
      problem_title: 'Kintone Sync Verified', // Add a field code here if you add a title field later
      root_cause: kintoneRecord.root_cause_analysis?.value || 'No Root Cause Provided',
      action_plan: kintoneRecord.proposed_corrective_actions?.value || 'No Action Plan Provided',
      pic: kintoneRecord.corrective_person_in_charge?.value || 'Unassigned'
    };

    res.status(200).json(mappedData);
  } catch (error) {
    console.error("Controller Error syncing CAR:", error);
    res.status(500).json({ message: 'Failed to synchronize CAR from Kintone.' });
  }
};

// CRITICAL: Ensure this export exists so the router can import it
module.exports = { fetchDepartments, fetchCarDetails };