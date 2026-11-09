const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const XLSX = require('xlsx');
const { Pool } = require('pg');

const SHEET_NAME = 'KPI-2026';
const PLANT = 'Cavite';
const YEAR = 2026;
const EXPECTED_WORKBOOK_ROWS = 60;
const IMPORT_USER_NAME = 'System Administrator';
const IMPORT_STATUS = 'Locked - Pending Manager Review';
const SOURCE_REMARK = 'Imported from Cavite KPI-2026 workbook; pending normal review.';
const FIRST_TARGET_ROW = 6;
const MONTH_COLUMNS_START = 15;

const parseArgs = args => {
  const options = { apply: false, workbook: null, database: null };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--apply') {
      options.apply = true;
    } else if (args[i] === '--workbook' && args[i + 1]) {
      options.workbook = path.resolve(args[++i]);
    } else if (args[i] === '--database' && args[i + 1]) {
      options.database = args[++i];
    } else {
      throw new Error('Usage: node scripts/importCaviteActuals.js --workbook <path> --database kpi_db_production [--apply]');
    }
  }
  if (!options.workbook || options.database !== 'kpi_db_production') {
    throw new Error('Specify the workbook path and --database kpi_db_production.');
  }
  return options;
};

const normalize = value => String(value ?? '')
  .replace(/[\r\n]+/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\u2264/g, '<=')
  .replace(/\u2265/g, '>=')
  .trim()
  .toLowerCase();

const getMergedCellValue = (sheet, rows, rowIndex, columnIndex) => {
  const merge = (sheet['!merges'] || []).find(item =>
    item.s.c <= columnIndex && item.e.c >= columnIndex &&
    item.s.r <= rowIndex && item.e.r >= rowIndex
  );
  if (merge) return sheet[XLSX.utils.encode_cell(merge.s)]?.v ?? null;
  return rows[rowIndex]?.[columnIndex] ?? null;
};

const parseNumericActual = value => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === '-') return null;

  const normalized = text.replace(/\s/g, '');
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?$/.test(normalized) &&
      !/^\$[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized.replace(/[$,%]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const readWorkbook = workbookPath => {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook not found: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellDates: true });
  const sheet = workbook.Sheets[SHEET_NAME];
  if (!sheet) throw new Error(`Workbook does not contain the "${SHEET_NAME}" sheet.`);

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
  const records = [];
  for (let rowIndex = FIRST_TARGET_ROW; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];
    const indicatorCode = String(row[4] ?? '').trim();
    const metricName = row[7];
    if (!indicatorCode || indicatorCode === '-' || !metricName || String(metricName).trim() === '-') continue;

    const monthValues = [];
    for (let month = 1; month <= 12; month += 1) {
      const sourceValue = row[MONTH_COLUMNS_START + month - 1];
      if (sourceValue === null || sourceValue === undefined ||
          String(sourceValue).trim() === '' || String(sourceValue).trim() === '-') continue;
      monthValues.push({
        month,
        sourceValue: String(sourceValue).trim(),
        actualValue: parseNumericActual(sourceValue)
      });
    }

    records.push({
      rowNumber: rowIndex + 1,
      indicatorCode,
      metricName: String(metricName),
      objective: getMergedCellValue(sheet, rows, rowIndex, 6),
      processType: getMergedCellValue(sheet, rows, rowIndex, 2),
      monthValues
    });
  }

  if (records.length !== EXPECTED_WORKBOOK_ROWS) {
    throw new Error(`Expected ${EXPECTED_WORKBOOK_ROWS} Cavite KPI rows in ${SHEET_NAME}, found ${records.length}.`);
  }
  const indicatorCodes = new Set();
  for (const record of records) {
    if (indicatorCodes.has(record.indicatorCode)) {
      throw new Error(`Duplicate Excel Indicator Code "${record.indicatorCode}".`);
    }
    indicatorCodes.add(record.indicatorCode);
  }
  return records;
};

const fetchTargets = async client => {
  const { rows } = await client.query(`
    SELECT
      t.id,
      t.metric_name,
      t.objective,
      t.process_type,
      t.target_year,
      COALESCE(NULLIF(t.plant, ''), u.plant) AS plant,
      COALESCE(t.section_code, s.code) AS section_code
    FROM kpi_targets t
    LEFT JOIN users u ON t.proposed_by = u.id
    LEFT JOIN sections s ON t.section_id = s.id
    WHERE t.status = 'Active'
      AND COALESCE(NULLIF(t.plant, ''), u.plant) = $1
      AND t.target_year = $2
    ORDER BY t.metric_name
  `, [PLANT, YEAR]);
  if (rows.length < EXPECTED_WORKBOOK_ROWS) {
    throw new Error(`Expected at least ${EXPECTED_WORKBOOK_ROWS} Active ${PLANT} ${YEAR} targets, found ${rows.length}.`);
  }
  return rows;
};

const matchTargets = (workbookRecords, targets) => {
  const byMetric = new Map();
  for (const target of targets) {
    const key = normalize(target.metric_name);
    const candidates = byMetric.get(key) || [];
    candidates.push(target);
    byMetric.set(key, candidates);
  }

  const matchedTargetIds = new Set();
  const resolved = workbookRecords.map(record => {
    let candidates = byMetric.get(normalize(record.metricName)) || [];
    if (candidates.length > 1) {
      const objectiveMatches = candidates.filter(target =>
        normalize(target.objective) === normalize(record.objective)
      );
      if (objectiveMatches.length === 1) {
        candidates = objectiveMatches;
      } else {
        const processMatches = candidates.filter(target =>
          normalize(target.process_type) === normalize(record.processType)
        );
        if (processMatches.length === 1) candidates = processMatches;
      }
    }
    if (candidates.length !== 1) {
      throw new Error(
        `Could not uniquely match Excel row ${record.rowNumber} (${record.indicatorCode}, "${record.metricName}"): ${candidates.length} target matches.`
      );
    }

    const target = candidates[0];
    if (matchedTargetIds.has(target.id)) {
      throw new Error(`Multiple Excel rows matched the same Cavite database target for "${record.metricName}".`);
    }
    if (target.plant !== PLANT || Number(target.target_year) !== YEAR) {
      throw new Error(`Matched target for "${record.indicatorCode}" is outside the ${PLANT} ${YEAR} scope.`);
    }
    matchedTargetIds.add(target.id);
    return { ...record, target };
  });

  const unmatchedTargets = targets
    .filter(target => !matchedTargetIds.has(target.id))
    .map(({ metric_name, objective, process_type }) => ({ metric_name, objective, process_type }));
  return { resolved, unmatchedTargets };
};

const fetchImportUser = async client => {
  const { rows } = await client.query(
    'SELECT id, name FROM users WHERE name = $1 ORDER BY id',
    [IMPORT_USER_NAME]
  );
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one "${IMPORT_USER_NAME}" user for import attribution, found ${rows.length}.`);
  }
  return rows[0];
};

const findMissingActuals = async (client, matchedRecords) => {
  const targetIds = matchedRecords.map(record => record.target.id);
  const { rows: existingRows } = await client.query(`
    SELECT target_id, report_month, actual_value
    FROM monthly_actuals
    WHERE report_year = $1
      AND target_id = ANY($2::uuid[])
  `, [YEAR, targetIds]);

  const existingByKey = new Map();
  for (const row of existingRows) {
    const key = `${row.target_id}|${row.report_month}`;
    if (existingByKey.has(key)) {
      throw new Error(`Duplicate database monthly actuals found for target ${row.target_id}, month ${row.report_month}.`);
    }
    existingByKey.set(key, row);
  }

  const missing = [];
  const conflicts = [];
  const skippedValues = new Map();
  let numericCells = 0;
  for (const record of matchedRecords) {
    for (const item of record.monthValues) {
      if (item.actualValue === null) {
        skippedValues.set(item.sourceValue, (skippedValues.get(item.sourceValue) || 0) + 1);
        continue;
      }
      numericCells += 1;
      const existing = existingByKey.get(`${record.target.id}|${item.month}`);
      if (!existing) {
        missing.push({
          target_id: record.target.id,
          report_month: item.month,
          report_year: YEAR,
          actual_value: item.actualValue,
          section_code: record.target.section_code
        });
      } else if (Number(existing.actual_value) !== item.actualValue) {
        conflicts.push({
          indicatorCode: record.indicatorCode,
          month: item.month,
          excelValue: item.actualValue,
          databaseValue: Number(existing.actual_value)
        });
      }
    }
  }
  return {
    missing,
    conflicts,
    skippedValues: [...skippedValues].map(([value, count]) => ({ value, count })),
    numericCells,
    existingRows: existingRows.length
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (process.env.DB_USER === undefined || process.env.DB_PASSWORD === undefined) {
    throw new Error('DB_USER and DB_PASSWORD must be configured.');
  }

  const workbookRecords = readWorkbook(options.workbook);
  const pool = new Pool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5435),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: options.database,
    ssl: false
  });
  const client = await pool.connect();

  try {
    const targets = await fetchTargets(client);
    const { resolved, unmatchedTargets } = matchTargets(workbookRecords, targets);
    const importUser = await fetchImportUser(client);

    if (options.apply) {
      await client.query('BEGIN');
      try {
        await client.query('LOCK TABLE monthly_actuals IN SHARE ROW EXCLUSIVE MODE');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    try {
      const plan = await findMissingActuals(client, resolved);
      console.log(JSON.stringify({
        database: options.database,
        plant: PLANT,
        year: YEAR,
        workbookKpiRows: resolved.length,
        activeDatabaseTargets: targets.length,
        databaseTargetsWithoutWorkbookRows: unmatchedTargets,
        numericWorkbookActuals: plan.numericCells,
        existingActualRows: plan.existingRows,
        missingNumericActuals: plan.missing.length,
        conflictingExistingActualsLeftUnchanged: plan.conflicts.length,
        nonNumericWorkbookValuesSkipped: plan.skippedValues.reduce((sum, item) => sum + item.count, 0),
        skippedValueSummary: plan.skippedValues,
        submittedBy: importUser.name,
        status: IMPORT_STATUS,
        mode: options.apply ? 'apply' : 'dry-run'
      }, null, 2));
      if (plan.conflicts.length) {
        console.log('Existing-value conflicts (left unchanged):');
        console.log(JSON.stringify(plan.conflicts, null, 2));
      }

      if (options.apply) {
        const insertedIds = [];
        for (const item of plan.missing) {
          const { rows } = await client.query(`
            INSERT INTO monthly_actuals (
              id, target_id, submitted_by, report_month, report_year,
              actual_value, status, remarks, section_code, created_at
            )
            VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP
            )
            RETURNING id
          `, [
            item.target_id,
            importUser.id,
            item.report_month,
            item.report_year,
            item.actual_value,
            IMPORT_STATUS,
            SOURCE_REMARK,
            item.section_code
          ]);
          if (rows.length !== 1) throw new Error('An expected monthly actual insert did not return exactly one row.');
          insertedIds.push(rows[0].id);
        }

        const { rows: verifyRows } = await client.query(`
          SELECT count(*)::int AS verified_rows
          FROM monthly_actuals
          WHERE id = ANY($1::uuid[])
            AND submitted_by = $2
            AND report_year = $3
            AND status = $4
            AND remarks = $5
        `, [insertedIds, importUser.id, YEAR, IMPORT_STATUS, SOURCE_REMARK]);
        const verifiedRows = verifyRows[0].verified_rows;
        if (verifiedRows !== plan.missing.length) {
          throw new Error(`Post-insert verification found ${verifiedRows} imported rows; expected ${plan.missing.length}.`);
        }
        await client.query('COMMIT');
        console.log(`Import committed: inserted and verified ${verifiedRows} missing actuals.`);
      } else {
        console.log('Dry run only; no database rows were changed.');
      }
    } catch (error) {
      if (options.apply) await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
};

if (require.main === module) {
  main().catch(error => {
    console.error('Cavite actuals import failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { normalize, parseNumericActual, readWorkbook, matchTargets };
