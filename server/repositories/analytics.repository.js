const db = require('../config/db');

class AnalyticsRepository {
  async getYearlyPerformance(userContext) {
    try {
      // Top Management and Administrators get global analytic views
      const canViewAll = userContext?.role === 'Administrator' || userContext?.role === 'Top Management';
      const activeUserId = userContext?.userId || userContext?.id;

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
      `;

      const params = [];

      // ✨ STRICT RLS: Scope charts to user's authorized departments
      if (!canViewAll) {
        query += ` WHERE t.department_id IN (
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