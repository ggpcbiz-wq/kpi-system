const targetRepository = require('../repositories/target.repository');
const db = require('../config/db'); 

const getDashboardTargets = async (user) => {
  const deptNames = user.role === 'Administrator' || user.role === 'Top Management' 
    ? null 
    : user.departments; 
    
  return await targetRepository.findAll(deptNames);
};

const proposeNewTarget = async (data, user) => {
  if (user.role === 'Manager' && !user.departments?.includes(data.department)) {
    throw new Error('Unauthorized department target proposal');
  }

  const deptRes = await db.query('SELECT id FROM departments WHERE name = $1', [data.department]);
  if (deptRes.rowCount === 0) throw new Error('Department not found in registry');

  const targetData = {
    metric_name: data.metric_name,
    target_value: data.target_value,
    operator: data.operator,
    unit: data.unit,
    remarks: data.remarks,
    process_category: data.process_category || null,
    process_type: data.process_type || null,
    frequency: data.frequency || 'Monthly',
    departmentId: deptRes.rows[0].id,
    userId: user.id || user.userId
  };

  // ✨ FIX: Check out a dedicated client to enforce ACID Transactions
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN'); // Start Transaction

    // 1. Create Target
    const newTarget = await targetRepository.create(targetData);

    // 2. Write Audit Log[cite: 10]
    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'kpi_targets',
      newTarget.id,
      'CREATED_KPI_TARGET',
      user.id || user.userId,
      null, 
      JSON.stringify(newTarget)
    ]);

    await client.query('COMMIT'); // Commit both operations atomically
    return newTarget;
  } catch (error) {
    await client.query('ROLLBACK'); // Revert KPI insert if Audit fails
    throw error;
  } finally {
    client.release(); // Return client to the pool
  }
};

const changeTargetStatus = async (id, status, remarks, user) => {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const oldTargetRes = await client.query('SELECT * FROM kpi_targets WHERE id = $1', [id]);
    const oldTarget = oldTargetRes.rows[0];

    const updatedTarget = await targetRepository.updateStatus(id, status, remarks);

    const actionString = `STATUS_UPDATED_TO_${status.replace(/\s+/g, '_').toUpperCase()}`;
    
    // Write Audit Log[cite: 10]
    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'kpi_targets',
      id,
      actionString,
      user.id || user.userId,
      JSON.stringify(oldTarget),
      JSON.stringify(updatedTarget)
    ]);

    await client.query('COMMIT');
    return updatedTarget;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardTargets,
  proposeNewTarget,
  changeTargetStatus
};