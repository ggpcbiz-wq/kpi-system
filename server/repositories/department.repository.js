const db = require('../config/db');

class DepartmentRepository {
  // Sync departments received from Kintone into PostgreSQL
  async syncKintoneDepartments(kintoneDeptNames) {
    if (!kintoneDeptNames || kintoneDeptNames.length === 0) return;

    for (const name of kintoneDeptNames) {
      await db.query(`
        INSERT INTO departments (id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE 
        SET updated_at = CURRENT_TIMESTAMP
      `, [name]);
    }
  }

  // Fetch all synchronized departments along with their mapped process types
  async findAll() {
    const query = `
      SELECT 
        d.id, 
        d.name, 
        d.plant,
        COALESCE(
          json_agg(
            json_build_object('category', dpt.category, 'process_name', dpt.process_name)
          ) FILTER (WHERE dpt.category IS NOT NULL), '[]'::json
        ) as "processTypes"
      FROM departments d
      LEFT JOIN department_process_types dpt ON d.id = dpt.department_id
      GROUP BY d.id
      ORDER BY d.name ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  // Update process type assignments for a department with audit logging
  async updateProcessTypes(departmentId, processTypes, userId) {
    // 1. Fetch current mappings for audit comparison
    const currentMappings = await db.query(
      'SELECT category, process_name FROM department_process_types WHERE department_id = $1',
      [departmentId]
    );

    // 2. Clear old mappings and insert new ones
    await db.query('DELETE FROM department_process_types WHERE department_id = $1', [departmentId]);

    if (processTypes && processTypes.length > 0) {
      for (const pt of processTypes) {
        await db.query(
          'INSERT INTO department_process_types (department_id, category, process_name) VALUES ($1, $2, $3)',
          [departmentId, pt.category, pt.process_name]
        );
      }
    }

    // 3. Insert audit log entry
    await db.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'department_process_types',
      departmentId,
      'UPDATE_PROCESS_MAPPINGS',
      userId,
      JSON.stringify(currentMappings.rows),
      JSON.stringify(processTypes)
    ]);

    return true;
  }
}

module.exports = new DepartmentRepository();