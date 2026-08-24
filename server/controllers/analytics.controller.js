const analyticsRepo = require('../repositories/analytics.repository');

const getChartData = async (req, res) => {
  try {
    const rows = await analyticsRepo.getYearlyPerformance();
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = {};
    
    rows.forEach(row => {
      const dept = row.dept_name || 'Unassigned';
      const metric = row.metric_name;
      
      // 1. Ensure the department exists in our object
      if (!chartData[dept]) {
        chartData[dept] = [];
      }
      
      // 2. Ensure the metric exists within the department
      let metricGroup = chartData[dept].find(m => m.metricName === metric);
      if (!metricGroup) {
        metricGroup = { metricName: metric, data: [] };
        chartData[dept].push(metricGroup);
      }
      
      // 3. If there is actual monthly data, push it to the chart array
      if (row.report_month) {
        metricGroup.data.push({
          month: monthNames[row.report_month - 1], // Converts 1 to 'Jan'
          target: parseFloat(row.target_value),
          actual: parseFloat(row.actual_value)
        });
      }
    });
    
    res.status(200).json(chartData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ message: 'Failed to load chart analytics' });
  }
};

module.exports = { getChartData };