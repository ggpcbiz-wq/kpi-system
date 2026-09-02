const analyticsRepo = require('../repositories/analytics.repository');

const getChartData = async (req, res) => {
  try {
    // 1. Enforce strict cache-busting for RBAC-sensitive data
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // 2. Pass the secure user context to the data access layer
    const rows = await analyticsRepo.getYearlyPerformance(req.user);
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = {};
    
    rows.forEach(row => {
      const dept = row.dept_name || 'Unassigned';
      const metric = row.metric_name;
      
      if (!chartData[dept]) {
        chartData[dept] = [];
      }
      
      let metricGroup = chartData[dept].find(m => m.metricName === metric);
      if (!metricGroup) {
        metricGroup = { metricName: metric, data: [] };
        chartData[dept].push(metricGroup);
      }
      
      if (row.report_month) {
        metricGroup.data.push({
          month: monthNames[row.report_month - 1], 
          target: parseFloat(row.target_value),
          actual: parseFloat(row.actual_value)
        });
      }
    });
    
    res.status(200).json(chartData);
  } catch (error) {
    console.error('[Analytics Controller] Error fetching chart data:', error);
    res.status(500).json({ message: 'Failed to load chart analytics' });
  }
};

module.exports = { getChartData };