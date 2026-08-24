const db = require('../config/db');

class SubmissionRepository {
  
  async create(data) {
    const { 
      target_id, submitted_by, report_month, report_year, 
      actual_value, remarks, supporting_data 
    } = data;
    
    try {
      const { rows } = await db.query(`
        INSERT INTO monthly_actuals (
          id, target_id, submitted_by, report_month, report_year, 
          actual_value, status, remarks, supporting_data, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 
          $5, 'Locked - Pending Manager Review', $6, $7, CURRENT_TIMESTAMP
        ) RETURNING *
      `, [
        target_id, submitted_by, report_month, report_year, 
        actual_value, remarks || null, supporting_data || null
      ]);
      
      return rows[0];
    } catch (error) {
      console.error('DB Error in SubmissionRepository.create:', error);
      throw error;
    }
  }
// GET: Fetch all submissions
  async findAll(user) {
    try {
      const canViewAll = user?.role === 'Administrator' || user?.role === 'Top Management';
      const departmentFilter = canViewAll ? '' : 'WHERE d.name = ANY($1)';
      const params = canViewAll ? [] : [user?.departments || []];

      const { rows } = await db.query(`
        SELECT 
          m.id,
          m.target_id,
          m.submitted_by,
          u.plant,      
          m.report_month,
          m.report_year,
          m.actual_value,
          m.status,
          m.remarks,
          m.created_at,
          
          -- ✨ FIX: Added the new CAR columns so the frontend can read them!
          m.kintone_car_id,
          m.problem_description,
          m.problem_cause,
          m.improvement_plan,
          m.pic,
          m.target_completion_date,

          t.metric_name,
          t.target_value,
          t.operator,
          t.unit,
          d.name as dept_name
        FROM monthly_actuals m
        LEFT JOIN kpi_targets t ON m.target_id = t.id
        LEFT JOIN departments d ON t.department_id = d.id
        LEFT JOIN users u ON m.submitted_by = u.id
        ${departmentFilter}
        ORDER BY m.created_at DESC
      `, params);
      return rows;
    } catch (error) {
      console.error('DB Error in SubmissionRepository.findAll:', error);
      throw error;
    }
  }
// UPDATE SUBMISSION STATUS & CAR DETAILS
  // Inside your submission.repository.js class:

  async updateStatus(id, status, remarks, carData = {}) {
    try {
      const { 
        kintone_car_id = null, 
        problem_description = null, 
        problem_cause = null, 
        improvement_plan = null, 
        pic = null 
      } = carData;

      
      const { rows } = await db.query(`
        UPDATE monthly_actuals
        SET 
          status = $1, 
          remarks = CASE 
            WHEN $2::text IS NULL THEN remarks 
            WHEN remarks IS NULL OR remarks = '' THEN $2::text 
            ELSE remarks || E'\n\n' || $2::text 
          END,
          kintone_car_id = COALESCE($3, kintone_car_id),
          problem_description = COALESCE($4, problem_description),
          problem_cause = COALESCE($5, problem_cause),
          improvement_plan = COALESCE($6, improvement_plan),
          pic = COALESCE($7, pic)
        WHERE id = $8
        RETURNING *
      `, [status, remarks, kintone_car_id, problem_description, problem_cause, improvement_plan, pic, id]);

      return rows[0];
    } catch (error) {
      console.error('DB Error in SubmissionRepository.updateStatus:', error);
      throw error;
    }
  }
}

module.exports = new SubmissionRepository();