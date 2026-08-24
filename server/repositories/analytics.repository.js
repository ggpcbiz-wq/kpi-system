const db = require('../config/db');

class AnalyticsRepository {
  async getYearlyPerformance() {
    try {
      const { rows } = await db.query(`
        SELECT 
          d.name AS dept_name,
          t.metric_name,
          t.target_value,
          m.report_month,
          m.actual_value
        FROM kpi_targets t
        JOIN departments d ON t.department_id = d.id
        -- Only pull actuals for the current year that are OFFICIALLY APPROVED
        LEFT JOIN monthly_actuals m ON t.id = m.target_id 
          AND m.report_year = EXTRACT(YEAR FROM CURRENT_DATE)
          AND m.status IN ('Approved', 'CAR Requested')
        ORDER BY d.name, t.metric_name, m.report_month;
      `);
      return rows;
    } catch (error) {
      console.error('DB Error in AnalyticsRepository:', error);
      throw error;
    }
  }
}

module.exports = new AnalyticsRepository();