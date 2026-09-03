const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
const KPI_APP_ID = process.env.KINTONE_KPI_APP_ID;
const KPI_API_KEY = process.env.KINTONE_KPI_API_KEY;

const postToKintone = async (data) => {
  if (!KINTONE_DOMAIN || !KPI_APP_ID || !KPI_API_KEY) throw new Error("Missing Kintone .env variables.");

  const url = `https://${KINTONE_DOMAIN}/k/v1/record.json`;
  
  // ✨ ARCHITECTURAL FIX: Mapped to new Kintone Field Codes ('kpi' and 'objective')
  const payload = {
    app: KPI_APP_ID,
    record: {
      department:      { value: data.department || '' },
      applied_by:      { value: data.applied_by || '' },
      status:          { value: data.status || '' },
      car:             { value: data.car || '' },       
      kpi:             { value: data.kpi || data.metric_name || data.metric || '' }, // Fallback chain for safety
      objective:       { value: data.objective || '' }, 
      month:           { value: String(data.month || '') }, 
      year:            { value: String(data.year || '') }, 
      target:          { value: String(data.target || '') },
      actual:          { value: String(data.actual || '') }, 
      remarks:         { value: data.remarks || '' },
      Attachment_Link: { value: data.attachment_link || '' } 
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'X-Cybozu-API-Token': KPI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Log exact Kintone rejection reason for easier debugging
      const errorData = await response.json();
      console.error('Kintone API Rejection:', errorData);
      throw new Error('Failed to post record to Kintone');
    }
    
    const result = await response.json();
    console.log(`Successfully posted to Kintone! Record ID: ${result.id}`);
    return result; 
  } catch (error) {
    console.error('Kintone POST Error:', error);
    throw error; 
  }
};

const updateKintoneRecord = async (kintoneRecordId, carIdString) => {
  if (!KINTONE_DOMAIN || !KPI_APP_ID || !KPI_API_KEY) throw new Error("Missing Kintone .env variables.");

  const url = `https://${KINTONE_DOMAIN}/k/v1/record.json`;
  
  const payload = {
    app: KPI_APP_ID,
    id: kintoneRecordId, 
    record: {
      car: { value: carIdString } 
    }
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'X-Cybozu-API-Token': KPI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to update record in Kintone');
    console.log(`Successfully updated Kintone Record #${kintoneRecordId} with CAR: ${carIdString}`);
    return await response.json();
  } catch (error) {
    console.error('Kintone PUT Error:', error);
    throw error;
  }
};

const getEmployeeByEmail = async (email) => {
  const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
  const MASTER_APP_ID = process.env.KINTONE_MASTER_APP_ID;
  const MASTER_API_KEY = process.env.KINTONE_MASTER_API_KEY;

  if (!KINTONE_DOMAIN || !MASTER_APP_ID || !MASTER_API_KEY) {
    throw new Error("Missing Kintone Master App .env variables.");
  }

  const query = encodeURIComponent(`Email = "${email}"`);
  const url = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${MASTER_APP_ID}&query=${query}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Cybozu-API-Token': MASTER_API_KEY }
    });

    if (!response.ok) throw new Error('Failed to fetch from Master Workers App');
    
    const data = await response.json();
    
    if (!data.records || data.records.length === 0) {
      return null; 
    }

    return data.records[0]; 
  } catch (error) {
    console.error('Kintone Lookup Error:', error);
    throw error;
  }
};

const getUniqueDepartments = async () => {
  const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
  const ORG_APP_ID = process.env.KINTONE_ORGANIZATION_APP_ID;
  const ORG_API_KEY = process.env.KINTONE_ORGANIZATION_API_KEY;

  if (!KINTONE_DOMAIN || !ORG_APP_ID || !ORG_API_KEY) {
    throw new Error("Missing Kintone Organization App .env variables.");
  }

  const url = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${ORG_APP_ID}&fields[0]=Department&fields[1]=Section&fields[2]=Segment`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Cybozu-API-Token': ORG_API_KEY }
    });

    if (!response.ok) throw new Error(`Kintone API responded with status: ${response.status}`);
    
    const data = await response.json();
    const deptMap = {};
    
    data.records.forEach(record => {
      const deptName = record.Department?.value?.trim();
      const secName = record.Section?.value?.trim();
      const segName = record.Segment?.value?.trim();

      if (!deptName) return;

      if (!deptMap[deptName]) {
        deptMap[deptName] = { name: deptName, sections: [] };
      }

      if (secName) {
        if (!deptMap[deptName].sections.some(s => s.name === secName)) {
          deptMap[deptName].sections.push({ name: secName, segment: segName || 'Unassigned' });
        }
      }
    });

    return Object.values(deptMap).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Kintone Organization Sync Error:', error);
    throw error;
  }
};

const getCarByControlNumber = async (controlNo) => {
  const KINTONE_DOMAIN = process.env.KINTONE_DOMAIN;
  const CAR_APP_ID = process.env.KINTONE_CAR_APP_ID;
  const CAR_API_KEY = process.env.KINTONE_CAR_API_KEY;

  if (!KINTONE_DOMAIN || !CAR_APP_ID || !CAR_API_KEY) {
    throw new Error("Missing Kintone CAR App .env variables.");
  }

  const query = encodeURIComponent(`control_number = "${controlNo}"`);
  const url = `https://${KINTONE_DOMAIN}/k/v1/records.json?app=${CAR_APP_ID}&query=${query}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'X-Cybozu-API-Token': CAR_API_KEY }
    });

    if (!response.ok) throw new Error(`Kintone API responded with status: ${response.status}`);
    
    const data = await response.json();
    
    if (!data.records || data.records.length === 0) return null;

    return data.records[0];
  } catch (error) {
    console.error('Kintone CAR Sync Error:', error);
    throw error;
  }
};

module.exports = { postToKintone, updateKintoneRecord, getEmployeeByEmail, getUniqueDepartments, getCarByControlNumber };