const db = require('../config/db');

class DepartmentRepository {
  async syncKintoneDepartments(kintoneData) {
    if (!kintoneData || kintoneData.length === 0) return;

    for (const dept of kintoneData) {
      const deptRes = await db.query(`
        INSERT INTO departments (id, name, created_at, updated_at)
        VALUES (gen_random_uuid(), $1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (name) DO UPDATE 
        SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `, [dept.name]);
      
      const deptId = deptRes.rows[0].id;

      if (dept.sections && dept.sections.length > 0) {
        for (const sec of dept.sections) {
          await db.query(`
            INSERT INTO sections (id, department_id, name, segment, created_at, updated_at)
            VALUES (gen_random_uuid(), $1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (department_id, name) DO UPDATE 
            SET segment = $3, updated_at = CURRENT_TIMESTAMP
          `, [deptId, sec.name, sec.segment]);
        }
      }
    }
  }

  async findAll() {
    const query = `
      SELECT 
        d.id, 
        d.name, 
        d.plant,
        COALESCE(
          (SELECT json_agg(json_build_object('category', dpt.category, 'process_name', dpt.process_name)) 
           FROM department_process_types dpt WHERE d.id = dpt.department_id), '[]'::json
        ) as "processTypes",
        COALESCE(
          (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'segment', s.segment))
           FROM sections s WHERE d.id = s.department_id), '[]'::json
        ) as "sections"
      FROM departments d
      ORDER BY d.name ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  async updateProcessTypes(departmentId, processTypes, userId) {
    const currentMappings = await db.query(
      'SELECT category, process_name FROM department_process_types WHERE department_id = $1',
      [departmentId]
    );

    await db.query('DELETE FROM department_process_types WHERE department_id = $1', [departmentId]);

    if (processTypes && processTypes.length > 0) {
      for (const pt of processTypes) {
        await db.query(
          'INSERT INTO department_process_types (department_id, category, process_name) VALUES ($1, $2, $3)',
          [departmentId, pt.category, pt.process_name]
        );
      }
    }

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