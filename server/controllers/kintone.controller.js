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

    let extractedRootCause = 'No Root Cause Provided';
    let extractedActionPlan = 'No Action Plan Provided';
    let extractedPic = 'Unassigned';

    // ✨ ARCHITECTURAL FIX: Dynamically traverse Kintone Subtables to locate and extract embedded row data
    for (const fieldKey in kintoneRecord) {
      const field = kintoneRecord[fieldKey];
      
      // Identify if the current field is a Subtable and contains at least one row
      if (field.type === 'SUBTABLE' && Array.isArray(field.value) && field.value.length > 0) {
        const firstRowData = field.value[0].value;
        
        // Verify if this specific table contains our target CAR columns
        if (firstRowData.root_cause_analysis) {
          extractedRootCause = firstRowData.root_cause_analysis.value || extractedRootCause;
          extractedActionPlan = firstRowData.proposed_corrective_actions?.value || extractedActionPlan;
          
          // Handle Kintone USER_SELECT fields which return arrays of user objects
          const picData = firstRowData.corrective_person_in_charge?.value;
          if (Array.isArray(picData) && picData.length > 0) {
            extractedPic = picData.map(u => u.name).join(', '); 
          } else if (typeof picData === 'string' && picData.trim() !== '') {
            extractedPic = picData;
          }
          
          // Stop searching once we've found and extracted the target table
          break; 
        }
      }
    }

    const mappedData = {
      control_no: kintoneRecord.control_number?.value || controlNo,
      problem_title: kintoneRecord.problem?.value || 'No Problem Title Provided', 
      root_cause: extractedRootCause,
      action_plan: extractedActionPlan,
      pic: extractedPic
    };

    res.status(200).json(mappedData);
  } catch (error) {
    console.error("Controller Error syncing CAR:", error);
    res.status(500).json({ message: 'Failed to synchronize CAR from Kintone.' });
  }
};

module.exports = { fetchDepartments, fetchCarDetails };