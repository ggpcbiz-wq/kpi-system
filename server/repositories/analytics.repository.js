const db = require('../config/db');

class AnalyticsRepository {
  async getYearlyPerformance(userContext) {
    try {
      const canViewAll = userContext?.role === 'Administrator' || userContext?.role === 'Top Management';
      const activeUserId = userContext?.userId || userContext?.id;

      // ✨ ARCHITECTURAL FIX: Enforce strict WHERE clause for approved data ONLY
      let query = `
        SELECT 
          d.name as dept_name, 
          t.metric_name, 
          m.report_month, 
          t.target_value, 
          m.actual_value
        FROM monthly_actuals m
        JOIN kpi_targets t ON m.target_id = t.id
        JOIN departments d ON t.department_id = d.id
        WHERE m.status IN ('Approved', 'CAR Requested')
      `;

      const params = [];

      // Ensure RLS uses AND instead of WHERE since we added the status filter above
      if (!canViewAll) {
        query += ` AND t.department_id IN (
          SELECT department_id FROM user_departments WHERE user_id = $1
        )`;
        params.push(activeUserId);
      }

      query += ` ORDER BY m.report_month ASC`;

      const { rows } = await db.query(query, params);
      return rows;
    } catch (error) {
      console.error('Database error in AnalyticsRepository.getYearlyPerformance:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsRepository();