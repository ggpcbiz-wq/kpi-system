const targetRepository = require('../repositories/target.repository');
const db = require('../config/db'); 

const getDashboardTargets = async (user) => {
  // ✨ FIX: Pass the precise userId to the repository for secure SQL subquery filtering
  const activeUserId = user.userId || user.id;
  return await targetRepository.findAll(activeUserId, user.role);
};

const proposeNewTarget = async (data, user) => {
  const activeUserId = user.userId || user.id;

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
    userId: activeUserId
  };

  const client = await db.getClient();
  
  try {
    await client.query('BEGIN'); 

    const newTarget = await targetRepository.create(targetData);

    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'kpi_targets',
      newTarget.id,
      'CREATED_KPI_TARGET',
      activeUserId,
      null, 
      JSON.stringify(newTarget)
    ]);

    await client.query('COMMIT'); 
    return newTarget;
  } catch (error) {
    await client.query('ROLLBACK'); 
    throw error;
  } finally {
    client.release(); 
  }
};

const changeTargetStatus = async (id, status, remarks, user) => {
  const client = await db.getClient();
  const activeUserId = user.userId || user.id;
  
  try {
    await client.query('BEGIN');

    const oldTargetRes = await client.query('SELECT * FROM kpi_targets WHERE id = $1', [id]);
    const oldTarget = oldTargetRes.rows[0];

    const updatedTarget = await targetRepository.updateStatus(id, status, remarks);

    const actionString = `STATUS_UPDATED_TO_${status.replace(/\s+/g, '_').toUpperCase()}`;
    
    await client.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'kpi_targets',
      id,
      actionString,
      activeUserId,
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