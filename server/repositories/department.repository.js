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

  // ✨ ARCHITECTURAL FIX: Deeply nested JSON aggregation (Department -> Sections -> Process Types)
  async findAll() {
    const query = `
      SELECT 
        d.id, 
        d.name, 
        d.plant,
        COALESCE(
          (SELECT json_agg(
             json_build_object(
               'id', s.id, 
               'name', s.name, 
               'segment', s.segment,
               'processTypes', COALESCE(
                 (SELECT json_agg(json_build_object('category', spt.category, 'process_name', spt.process_name))
                  FROM section_process_types spt WHERE spt.section_id = s.id), '[]'::json
               )
             )
           ) FROM sections s WHERE s.department_id = d.id), '[]'::json
        ) as "sections"
      FROM departments d
      ORDER BY d.name ASC
    `;
    const { rows } = await db.query(query);
    return rows;
  }

  // ✨ ARCHITECTURAL FIX: Pointing mutations to the section_process_types table
  async updateSectionProcessTypes(sectionId, processTypes, userId) {
    const currentMappings = await db.query(
      'SELECT category, process_name FROM section_process_types WHERE section_id = $1',
      [sectionId]
    );

    await db.query('DELETE FROM section_process_types WHERE section_id = $1', [sectionId]);

    if (processTypes && processTypes.length > 0) {
      for (const pt of processTypes) {
        await db.query(
          'INSERT INTO section_process_types (section_id, category, process_name) VALUES ($1, $2, $3)',
          [sectionId, pt.category, pt.process_name]
        );
      }
    }

    await db.query(`
      INSERT INTO audit_logs (table_name, record_id, action, changed_by, old_payload, new_payload)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'section_process_types',
      sectionId,
      'UPDATE_PROCESS_MAPPINGS',
      userId,
      JSON.stringify(currentMappings.rows),
      JSON.stringify(processTypes)
    ]);

    return true;
  }
}

module.exports = new DepartmentRepository();