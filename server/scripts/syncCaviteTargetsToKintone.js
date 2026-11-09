const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { buildMasterKpiRecord } = require('../services/kintone.service');

const EXPECTED_APP_ID = '1938';
const EXPECTED_TARGET_COUNT = 62;
const BATCH_SIZE = 100;
const LOOKUP_BATCH_SIZE = 20;

const openDatabase = () => {
  const required = ['DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing database environment variables: ${missing.join(', ')}`);
  }

  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5435),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  });

  return {
    pool,
    close: () => pool.end()
  };
};

const escapeQueryValue = value => String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const readKintoneResponse = async response => {
  const body = await response.text();
  let data;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(`Kintone returned a non-JSON response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const detail = data.message || data.code || response.statusText;
    throw new Error(`Kintone API rejected the request (HTTP ${response.status}): ${detail}`);
  }
  return data;
};

const requestKintone = async (method, endpoint, payload) => {
  const domain = process.env.KINTONE_DOMAIN;
  const apiKey = process.env.KINTONE_MASTER_KPI_API_KEY;
  if (!domain || !apiKey) {
    throw new Error('Missing KINTONE_DOMAIN or KINTONE_MASTER_KPI_API_KEY.');
  }

  const headers = { 'X-Cybozu-API-Token': apiKey };
  if (payload) headers['Content-Type'] = 'application/json';

  const response = await fetch(`https://${domain}/k/v1/${endpoint}`, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined
  });
  return readKintoneResponse(response);
};

const fetchActiveCaviteTargets = async pool => {
  const { rows } = await pool.query(`
    SELECT
      t.kpi_no,
      t.metric_name,
      t.objective,
      t.target_value,
      t.target_year,
      t.operator,
      t.unit,
      t.process_category,
      t.process_type,
      t.frequency,
      t.remarks,
      t.created_at,
      COALESCE(NULLIF(t.plant, ''), u.plant) AS plant,
      d.name AS dept_name,
      COALESCE(t.section_code, s.code) AS section_code,
      u.name AS proposer_name
    FROM kpi_targets t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN sections s ON t.section_id = s.id
    LEFT JOIN users u ON t.proposed_by = u.id
    WHERE t.status = 'Active'
      AND COALESCE(NULLIF(t.plant, ''), u.plant) = 'Cavite'
    ORDER BY t.kpi_no
  `);

  if (rows.length === 0) {
    throw new Error('No Active Cavite KPI targets were found; refusing to run an empty sync.');
  }
  if (rows.length !== EXPECTED_TARGET_COUNT) {
    throw new Error(`Expected ${EXPECTED_TARGET_COUNT} Active Cavite targets, found ${rows.length}; refusing to sync unexpected scope.`);
  }

  const seen = new Set();
  for (const row of rows) {
    if (!row.kpi_no || !row.kpi_no.trim()) {
      throw new Error('An Active Cavite target is missing kpi_no; refusing to sync incomplete identity data.');
    }
    if (seen.has(row.kpi_no)) {
      throw new Error(`Duplicate kpi_no "${row.kpi_no}" in Active Cavite database targets.`);
    }
    seen.add(row.kpi_no);
  }
  return rows;
};

const fetchExistingKintoneRecords = async targets => {
  const existingByKpiNo = new Map();
  const kpiNumbers = targets.map(target => target.kpi_no);

  for (let i = 0; i < kpiNumbers.length; i += LOOKUP_BATCH_SIZE) {
    const batch = kpiNumbers.slice(i, i + LOOKUP_BATCH_SIZE);
    const queryValues = batch.map(value => `"${escapeQueryValue(value)}"`).join(', ');
    const query = `kpi_no in (${queryValues})`;
    const params = new URLSearchParams({
      app: EXPECTED_APP_ID,
      query,
      'fields[0]': '$id',
      'fields[1]': 'kpi_no',
      totalCount: 'true',
      limit: '500'
    });

    const data = await requestKintone('GET', `records.json?${params.toString()}`);
    if (Number(data.totalCount || 0) > (data.records || []).length) {
      throw new Error('Kintone returned a truncated set of matching records; refusing potentially incomplete duplicate checks.');
    }
    for (const record of data.records || []) {
      const kpiNo = record.kpi_no?.value;
      const recordId = record.$id?.value;
      if (!kpiNo || !recordId) {
        throw new Error('Kintone returned a matching record without kpi_no or record ID.');
      }
      const matches = existingByKpiNo.get(kpiNo) || [];
      matches.push(recordId);
      existingByKpiNo.set(kpiNo, matches);
    }
  }

  for (const [kpiNo, recordIds] of existingByKpiNo) {
    if (recordIds.length > 1) {
      throw new Error(`Kintone contains ${recordIds.length} records for kpi_no "${kpiNo}"; refusing ambiguous update.`);
    }
  }
  return existingByKpiNo;
};

const syncTargets = async ({ targets, existingByKpiNo, apply }) => {
  const updates = [];
  const creates = [];

  for (const target of targets) {
    const record = buildMasterKpiRecord(target);
    const existingId = existingByKpiNo.get(target.kpi_no)?.[0];
    if (existingId) updates.push({ id: existingId, record });
    else creates.push(record);
  }

  const summary = {
    app: EXPECTED_APP_ID,
    plant: 'Cavite',
    statusFilter: 'Active',
    databaseTargets: targets.length,
    existingRecordsToUpdate: updates.length,
    missingRecordsToCreate: creates.length,
    mode: apply ? 'apply' : 'dry-run'
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!apply) return summary;

  let updated = 0;
  let created = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await requestKintone('PUT', 'records.json', { app: EXPECTED_APP_ID, records: batch });
    updated += batch.length;
    console.log(`Updated Kintone records: ${updated}/${updates.length}`);
  }

  for (let i = 0; i < creates.length; i += BATCH_SIZE) {
    const batch = creates.slice(i, i + BATCH_SIZE);
    await requestKintone('POST', 'records.json', { app: EXPECTED_APP_ID, records: batch });
    created += batch.length;
    console.log(`Created Kintone records: ${created}/${creates.length}`);
  }

  return { ...summary, updated, created };
};

const main = async () => {
  const apply = process.argv.includes('--apply');
  const unexpectedArgs = process.argv.slice(2).filter(arg => arg !== '--apply');
  if (unexpectedArgs.length > 0) {
    throw new Error('Usage: node scripts/syncCaviteTargetsToKintone.js [--apply]');
  }
  if (process.env.KINTONE_MASTER_KPI_APP_ID !== EXPECTED_APP_ID) {
    throw new Error(`KINTONE_MASTER_KPI_APP_ID must be ${EXPECTED_APP_ID} for this script.`);
  }

  const database = openDatabase();
  try {
    const targets = await fetchActiveCaviteTargets(database.pool);
    const existingByKpiNo = await fetchExistingKintoneRecords(targets);
    const result = await syncTargets({ targets, existingByKpiNo, apply });
    if (apply) console.log(`Kintone sync complete: ${result.updated} updated, ${result.created} created.`);
  } finally {
    await database.close();
  }
};

if (require.main === module) {
  main().catch(error => {
    console.error('Cavite Kintone sync failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { escapeQueryValue, fetchActiveCaviteTargets, fetchExistingKintoneRecords, syncTargets };
