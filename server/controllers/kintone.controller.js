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

    // ✨ DIAGNOSTIC INJECTION: Print the EXACT payload to your VSCode terminal
    console.log("========== KINTONE RAW RECORD ==========");
    console.log(JSON.stringify(kintoneRecord, null, 2));
    console.log("========================================");

    let extractedRootCause = kintoneRecord.root_cause_analysis?.value || null;
    let extractedActionPlan = kintoneRecord.proposed_corrective_actions?.value || null;
    let extractedPic = null;

    if (kintoneRecord.corrective_person_in_charge?.value) {
      const picRoot = kintoneRecord.corrective_person_in_charge.value;
      if (Array.isArray(picRoot) && picRoot.length > 0) {
        extractedPic = picRoot.map(u => u.name).join(', ');
      } else if (typeof picRoot === 'string' && picRoot.trim() !== '') {
        extractedPic = picRoot;
      }
    }

    for (const fieldKey in kintoneRecord) {
      const field = kintoneRecord[fieldKey];
      
      if (field.type === 'SUBTABLE' && Array.isArray(field.value) && field.value.length > 0) {
        for (const row of field.value) {
          const rowData = row.value;
          
          if (!extractedRootCause && rowData.root_cause_analysis?.value) {
            extractedRootCause = rowData.root_cause_analysis.value;
          }
          
          if (!extractedActionPlan && rowData.proposed_corrective_actions?.value) {
            extractedActionPlan = rowData.proposed_corrective_actions.value;
          }
          
          if (!extractedPic && rowData.corrective_person_in_charge?.value) {
            const picData = rowData.corrective_person_in_charge.value;
            if (Array.isArray(picData) && picData.length > 0) {
              extractedPic = picData.map(u => u.name).join(', '); 
            } else if (typeof picData === 'string' && picData.trim() !== '') {
              extractedPic = picData;
            }
          }
        }
      }
    }

    const mappedData = {
      control_no: kintoneRecord.control_number?.value || controlNo,
      problem_title: kintoneRecord.problem?.value || 'No Problem Title Provided', 
      root_cause: extractedRootCause || 'No Root Cause Provided',
      action_plan: extractedActionPlan || 'No Action Plan Provided',
      pic: extractedPic || 'Unassigned'
    };

    res.status(200).json(mappedData);
  } catch (error) {
    console.error("Controller Error syncing CAR:", error);
    res.status(500).json({ message: 'Failed to synchronize CAR from Kintone.' });
  }
};

module.exports = { fetchDepartments, fetchCarDetails };