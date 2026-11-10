const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const APP_ID = '1910';
const BATCH_SIZE = 100;
const DEFAULT_EXPORT = 'C:\\Users\\Systemdevr3\\Downloads\\studio_results_20261109_1550.json';
const FIELD_CODES = [
  'code',
  'department',
  'section',
  'applied_by',
  'status',
  'car',
  'objective',
  'kpi',
  'month',
  'year',
  'target',
  'actual',
  'Attachment_Link',
  'remarks'
];

const parseArgs = args => {
  const options = { apply: false, exportPath: DEFAULT_EXPORT };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--apply') {
      options.apply = true;
    } else if (args[i] === '--export' && args[i + 1]) {
      options.exportPath = path.resolve(args[++i]);
    } else {
      throw new Error('Usage: node scripts/syncMonthlyActualsToKintone.js [--export <path>] [--apply]');
    }
  }
  return options;
};

const requestKintone = async (method, endpoint, payload) => {
  const { KINTONE_DOMAIN: domain, KINTONE_KPI_APP_ID: configuredApp, KINTONE_KPI_API_KEY: apiKey } = process.env;
  if (!domain || !apiKey || configuredApp !== APP_ID) {
    throw new Error('Configure KINTONE_DOMAIN, KINTONE_KPI_API_KEY, and KINTONE_KPI_APP_ID=1910 in server/.env.');
  }

  const response = await fetch(`https://${domain}/k/v1/${endpoint}`, {
    method,
    headers: {
      'X-Cybozu-API-Token': apiKey,
      ...(payload ? { 'Content-Type': 'application/json' } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined
  });
  const body = await response.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`Kintone returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(`Kintone API rejected ${method} ${endpoint} (HTTP ${response.status}): ${data.message || data.code || response.statusText}`);
  }
  return data;
};

const readExport = exportPath => {
  if (!fs.existsSync(exportPath)) throw new Error(`Export file not found: ${exportPath}`);
  const rows = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Export must contain a non-empty JSON array.');

  const seenKeys = new Set();
  const records = [];
  let rejectedSkipped = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (String(row.status || '').trim().toLowerCase() === 'rejected') {
      rejectedSkipped += 1;
      continue;
    }

    const required = ['monthly_actual_id', 'code', 'department', 'applied_by', 'status', 'objective', 'kpi', 'month', 'year', 'target', 'actual'];
    const missing = required.filter(field => row[field] === null || row[field] === undefined || String(row[field]).trim() === '');
    if (missing.length) {
      throw new Error(`Export row ${index + 1} is missing required values: ${missing.join(', ')}.`);
    }
    if (!/^\d{1,2}$/.test(String(row.month)) || Number(row.month) < 1 || Number(row.month) > 12) {
      throw new Error(`Export row ${index + 1} has an invalid month "${row.month}".`);
    }
    if (!/^\d{4}$/.test(String(row.year))) {
      throw new Error(`Export row ${index + 1} has an invalid year "${row.year}".`);
    }

    const key = `${row.code}|${row.year}|${Number(row.month)}`;
    if (seenKeys.has(key)) throw new Error(`Duplicate source KPI/year/month key "${key}".`);
    seenKeys.add(key);

    records.push({
      sourceId: String(row.monthly_actual_id),
      key,
      values: {
        code: String(row.code),
        department: String(row.department),
        section: String(row.section ?? ''),
        applied_by: String(row.applied_by),
        status: String(row.status),
        car: String(row.car ?? ''),
        objective: String(row.objective),
        kpi: String(row.kpi),
        month: String(Number(row.month)),
        year: String(row.year),
        target: String(row.target),
        actual: String(row.actual),
        Attachment_Link: String(row.attachment_link ?? ''),
        remarks: String(row.remarks ?? '')
      }
    });
  }

  if (!records.length) throw new Error('No non-rejected actual rows were found in the export.');
  return { records, rejectedSkipped };
};

const fetchExistingRecords = async () => {
  const existing = new Map();
  let offset = 0;
  let totalCount = null;
  const fields = ['$id', ...FIELD_CODES];

  while (totalCount === null || offset < totalCount) {
    const params = new URLSearchParams({
      app: APP_ID,
      totalCount: 'true',
      query: `limit 500 offset ${offset}`
    });
    fields.forEach((field, index) => params.set(`fields[${index}]`, field));
    const data = await requestKintone('GET', `records.json?${params.toString()}`);
    const records = data.records || [];
    const returnedTotal = Number(data.totalCount);
    if (!Number.isInteger(returnedTotal) || returnedTotal < 0) {
      throw new Error('Kintone did not return a valid totalCount; refusing to import without a complete duplicate check.');
    }
    if (totalCount === null) totalCount = returnedTotal;
    else if (totalCount !== returnedTotal) {
      throw new Error('Kintone record count changed during the duplicate check; rerun the sync.');
    }

    for (const record of records) {
      const code = record.code?.value;
      const year = record.year?.value;
      const month = record.month?.value;
      if (!code || !year || !month) {
        throw new Error(`Existing Kintone record ${record.$id?.value || '(unknown ID)'} has no code/year/month key.`);
      }
      const key = `${code}|${year}|${Number(month)}`;
      const matches = existing.get(key) || [];
      matches.push({ id: record.$id?.value, values: record });
      existing.set(key, matches);
    }

    if (records.length === 0 && offset < totalCount) {
      throw new Error('Kintone returned no records before totalCount was reached; duplicate check is incomplete.');
    }
    offset += records.length;
  }

  for (const [key, matches] of existing) {
    if (matches.length > 1) throw new Error(`Kintone already has duplicate records for "${key}"; refusing to add more.`);
  }
  return existing;
};

const mapRecord = values => Object.fromEntries(
  Object.entries(values).map(([field, value]) => [field, { value }])
);

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const { records, rejectedSkipped } = readExport(options.exportPath);
  const existing = await fetchExistingRecords();
  const toCreate = [];
  const alreadyPresent = [];

  for (const source of records) {
    const matches = existing.get(source.key) || [];
    if (!matches.length) {
      toCreate.push(source);
      continue;
    }
    const record = matches[0].values;
    const conflictingFields = Object.entries(source.values)
      .filter(([field, value]) => String(record[field]?.value ?? '') !== value)
      .map(([field]) => field);
    if (conflictingFields.length) {
      throw new Error(`Kintone record ${matches[0].id} for "${source.key}" conflicts with export fields: ${conflictingFields.join(', ')}. No records were written.`);
    }
    alreadyPresent.push(source.key);
  }

  const summary = {
    app: APP_ID,
    exportRows: records.length + rejectedSkipped,
    rejectedRowsSkipped: rejectedSkipped,
    eligibleRows: records.length,
    kintoneRecordsChecked: [...existing.values()].reduce((count, matches) => count + matches.length, 0),
    alreadyPresentAndMatching: alreadyPresent.length,
    recordsToCreate: toCreate.length,
    attachmentFieldCode: 'Attachment_Link',
    mode: options.apply ? 'apply' : 'dry-run'
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!options.apply) {
    console.log('Dry run only; no Kintone records were changed.');
    return;
  }

  let created = 0;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    await requestKintone('POST', 'records.json', {
      app: APP_ID,
      records: batch.map(record => mapRecord(record.values))
    });
    created += batch.length;
    console.log(`Created ${created}/${toCreate.length} records.`);
  }

  const verified = await fetchExistingRecords();
  const failedVerification = toCreate.filter(source => {
    const matches = verified.get(source.key);
    if (!matches || matches.length !== 1) return true;
    return Object.entries(source.values)
      .some(([field, value]) => String(matches[0].values[field]?.value ?? '') !== value);
  });
  if (failedVerification.length) {
    throw new Error(`Post-import verification found ${failedVerification.length} missing, duplicate, or mismatching records. Review Kintone before retrying.`);
  }
  console.log(`Import complete: created and verified ${created} records; ${alreadyPresent.length} matching records were already present.`);
};

if (require.main === module) {
  main().catch(error => {
    console.error('Monthly actuals Kintone sync failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { readExport, mapRecord };
