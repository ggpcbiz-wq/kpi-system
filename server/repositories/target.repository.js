const db = require('../config/db');

class TargetRepository {
  // ✨ FIX: Renamed parameter to deptNames and updated the SQL WHERE clause
  async findAll(deptNames) {
    try {
      if (deptNames === null) {
        const { rows } = await db.query(`
          SELECT 
            t.id, t.metric_name, t.target_value, t.operator, t.unit,
            t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
            d.name as dept_name, u.name as proposer_name, u.plant       
          FROM kpi_targets t
          LEFT JOIN departments d ON t.department_id = d.id
          LEFT JOIN users u ON t.proposed_by = u.id
          ORDER BY t.created_at DESC
        `);
        return rows;
      }

      const { rows } = await db.query(`
        SELECT 
          t.id, t.metric_name, t.target_value, t.operator, t.unit,
          t.status, t.remarks, t.process_category, t.process_type, t.frequency, t.created_at,
          d.name as dept_name, u.name as proposer_name, u.plant       
        FROM kpi_targets t
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN users u ON t.proposed_by = u.id
        WHERE d.name = ANY($1) -- ✨ FIX: Compare against department name (String), not ID (UUID)
        ORDER BY t.created_at DESC
      `, [deptNames]);

      return rows;
    } catch (error) {
      console.error('Database error inside TargetRepository.findAll:', error);
      throw error;
    }
  }

  async create(targetData) {
    const { 
      metric_name, target_value, operator, unit, departmentId, userId, remarks, 
      process_category, process_type, frequency 
    } = targetData;
    
    const { rows } = await db.query(`
      INSERT INTO kpi_targets (
        id, department_id, proposed_by, metric_name, target_value, 
        status, remarks, operator, unit, process_category, process_type, frequency, 
        created_at, updated_at
      )
      VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 
        'Pending Top Management Approval', $5, $6, $7, $8, $9, $10, 
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `, [
      departmentId, userId, metric_name, target_value, remarks, operator, unit, 
      process_category, process_type, frequency
    ]);

    return rows[0];
  }

  async updateStatus(id, status, remarks) {
    const { rows } = await db.query(`
      UPDATE kpi_targets
      SET status = $1, remarks = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [status, remarks, id]);

    return rows[0];
  }
}

module.exports = new TargetRepository();