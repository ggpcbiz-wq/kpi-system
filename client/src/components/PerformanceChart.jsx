import { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext'; 
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const PerformanceChart = ({ data, metricName, unit = '' }) => {
  const [viewMode, setViewMode] = useState('monthly'); 
  const { isDarkMode } = useTheme(); 

  // ✨ FIX: Statically bound the actualBar to your primary brand purple (#7933ff)
  const colors = {
    targetLine: '#4cc45e',                           // Static neon green
    actualBar: '#7933ff',                            // Static brand-600 purple (Does not change in dark mode)
    gridLines: isDarkMode ? '#334155' : '#E2E8F0',   // Slate-700 vs Slate-200
    text: isDarkMode ? '#94A3B8' : '#64748B',        // Slate-400 vs Slate-500
    tooltipBg: isDarkMode ? '#1E293B' : '#FFFFFF',   // Slate-800 vs White
    tooltipBorder: isDarkMode ? '#334155' : '#E2E8F0',
    tooltipText: isDarkMode ? '#F1F5F9' : '#0F172A',
    cursorFill: isDarkMode ? '#334155' : '#F8FAFC'   // Slate-700 vs Slate-50
  };

  const chartData = useMemo(() => {
    if (!data || data.length === 0 || viewMode === 'monthly') return data || [];

    const quarters = {
      Q1: { count: 0, targetSum: 0, actualSum: 0 },
      Q2: { count: 0, targetSum: 0, actualSum: 0 },
      Q3: { count: 0, targetSum: 0, actualSum: 0 },
      Q4: { count: 0, targetSum: 0, actualSum: 0 },
    };

    const getQuarter = (monthValue) => {
      if (typeof monthValue === 'number' || !isNaN(monthValue)) {
        return `Q${Math.ceil(parseInt(monthValue, 10) / 3)}`;
      }
      
      const monthStr = String(monthValue).substring(0, 3).toLowerCase();
      const strMap = {
        jan: 'Q1', feb: 'Q1', mar: 'Q1',
        apr: 'Q2', may: 'Q2', jun: 'Q2',
        jul: 'Q3', aug: 'Q3', sep: 'Q3',
        oct: 'Q4', nov: 'Q4', dec: 'Q4'
      };
      return strMap[monthStr];
    };

    data.forEach(d => {
      const q = getQuarter(d.month);
      if (q && quarters[q]) {
        quarters[q].count++;
        quarters[q].targetSum += (parseFloat(d.target) || 0);
        quarters[q].actualSum += (parseFloat(d.actual) || 0);
      }
    });

    return Object.keys(quarters)
      .filter(q => quarters[q].count > 0)
      .map(q => ({
        month: q, 
        target: Number((quarters[q].targetSum / quarters[q].count).toFixed(2)),
        actual: Number((quarters[q].actualSum / quarters[q].count).toFixed(2))
      }));
  }, [data, viewMode]);

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 w-full flex flex-col h-full transition-colors duration-300 hover:shadow-md">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 pr-4 transition-colors">{metricName}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            {viewMode === 'monthly' ? 'Month-to-Month Performance' : 'Quarterly Average Performance'}
          </p>
        </div>
        
        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg shrink-0 border border-slate-200 dark:border-slate-700 transition-colors">
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'monthly' 
                ? 'bg-white dark:bg-slate-700 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-600' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setViewMode('quarterly')}
            className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'quarterly' 
                ? 'bg-white dark:bg-slate-700 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-600' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Quarterly
          </button>
        </div>
      </div>
      
      <div className="h-80 w-full mt-auto">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
          >
            <CartesianGrid stroke={colors.gridLines} vertical={false} strokeDasharray="4 4" />
            <XAxis 
              dataKey="month" 
              stroke={colors.text} 
              tick={{ fill: colors.text, fontSize: 12, fontWeight: 500 }} 
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis 
              stroke={colors.text} 
              tick={{ fill: colors.text, fontSize: 12, fontWeight: 500 }} 
              tickLine={false}
              axisLine={false}
              width={70}
              tickFormatter={(value) => `${value}${unit ? ' ' + unit : ''}`}
            />
            <Tooltip 
              formatter={(value, name) => [`${value}${unit ? ' ' + unit : ''}`, name]}
              contentStyle={{ 
                borderRadius: '12px', 
                backgroundColor: colors.tooltipBg,
                border: `1px solid ${colors.tooltipBorder}`, 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', 
                fontWeight: 600, 
                color: colors.tooltipText 
              }}
              itemStyle={{ color: colors.tooltipText }}
              cursor={{ fill: colors.cursorFill }}
            />
            <Legend wrapperStyle={{ paddingTop: '24px', fontSize: '13px', fontWeight: 600, color: colors.text }} />
            <Bar dataKey="actual" name="Actual Performance" fill={colors.actualBar} radius={[6, 6, 0, 0]} maxBarSize={45} />
            <Line type="stepAfter" dataKey="target" name="Target Objective" stroke={colors.targetLine} strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;