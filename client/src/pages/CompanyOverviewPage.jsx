import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { usePlant } from '../context/usePlant';
import { Globe, TrendingUp, Award, BarChart3, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import PerformanceChart from '../components/PerformanceChart';
import FilterBar from '../components/FilterBar'; 
import { API_BASE_URL } from '../services/api';

const checkIsMissed = (actual, target, operator) => {
  const act = parseFloat(actual);
  const tgt = parseFloat(target);
  const op = String(operator).trim();

  if (op === '≤' || op === '<=' || op === '‚â§') return act > tgt;
  if (op === '<') return act >= tgt;
  if (op === '=' || op === '==') return act !== tgt;
  if (op === '≥' || op === '>=' || op === '‚â•') return act < tgt;
  if (op === '>') return act <= tgt;
  return act < tgt; 
};

const CompanyOverviewPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const { selectedPlant } = usePlant();
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState({ search: '', period: '', department: 'All', targetYear: '' });
  const [rawTargets, setRawTargets] = useState([]);
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [globalChartData, setGlobalChartData] = useState({});
  
  // Grid Pagination State
  const [chartPage, setChartPage] = useState(1);
  const CHARTS_PER_PAGE = 6;
  const autoRotateIntervalRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadOverviewData = async () => {
      try {
        setIsLoading(true);
        const timestamp = new Date().getTime();
        
        const plantQuery = selectedPlant !== 'All Plants' ? `&plant=${selectedPlant}` : '';
        
        const [targetRes, subRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}${plantQuery.replace('&', '?')}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}${plantQuery.replace('&', '?')}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!isMounted) return;

        if (targetRes.ok && subRes.ok && analyticsRes.ok) {
          setRawTargets(await targetRes.json());
          
          const submissions = await subRes.json();
          setRawSubmissions(submissions.filter(s => 
            ['Approved', 'CAR Requested', 'Locked - Pending Manager Review', 'Locked - Pending QMR Sign-Off'].includes(s.status)
          ));
          
          setGlobalChartData(await analyticsRes.json());
        }
      } catch (error) {
        console.error("Failed to fetch overview data:", error);
        if (isMounted) addToast("Failed to load company overview", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (token) {
      loadOverviewData();
    }

    return () => {
      isMounted = false;
    };
  }, [token, selectedPlant, addToast]);

  const targetPlantMap = useMemo(() => {
    const map = {};
    rawTargets.forEach(t => { map[t.id] = t.plant; });
    return map;
  }, [rawTargets]);

  const activePlantTargets = useMemo(() => {
    return rawTargets.filter(t => selectedPlant === 'All Plants' || t.plant === selectedPlant);
  }, [rawTargets, selectedPlant]);

  const allDepartments = Array.from(new Set(activePlantTargets.map(t => t.dept_name).filter(Boolean)));
  const targetsInSelectedYear = activePlantTargets.filter(target =>
    !filters.targetYear
    || (filters.targetYear === 'unassigned'
      ? target.target_year === null || target.target_year === undefined || target.target_year === ''
      : String(target.target_year) === filters.targetYear)
  );
  const targetIdsInSelectedYear = new Set(targetsInSelectedYear.map(target => target.id));

  const filteredTargets = activePlantTargets.filter(t => {
    if (t.status !== 'Active') return false;
    if (filters.targetYear && (filters.targetYear === 'unassigned'
      ? t.target_year !== null && t.target_year !== undefined && t.target_year !== ''
      : String(t.target_year) !== filters.targetYear)) return false;
    if (filters.department !== 'All' && t.dept_name !== filters.department) return false;
    if (filters.search && !t.metric_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const filteredSubmissions = rawSubmissions.filter(sub => {
    const subPlant = targetPlantMap[sub.target_id] || sub.plant; 
    const matchPlant = selectedPlant === 'All Plants' || subPlant === selectedPlant;
    const matchTargetYear = !filters.targetYear || targetIdsInSelectedYear.has(sub.target_id);
    const matchDept = filters.department === 'All' || sub.dept_name === filters.department;
    let matchPeriod = true;
    
    if (filters.period) {
      const [year, month] = filters.period.split('-');
      matchPeriod = (sub.report_year === parseInt(year)) && (sub.report_month === parseInt(month, 10));
    }
    
    return matchPlant && matchTargetYear && matchDept && matchPeriod;
  });

  const allCharts = useMemo(() => {
    return Object.entries(globalChartData).flatMap(([dept, metrics]) => {
      if (filters.department !== 'All' && dept !== filters.department) return [];
      
      return metrics
        .filter(m => m.data && m.data.length > 0)
        .map((metric, index) => {
          if (filters.search && !metric.metricName.toLowerCase().includes(filters.search.toLowerCase())) return null;
          
          const targetExistsInPlant = filteredTargets.some(t => t.metric_name === metric.metricName && t.dept_name === dept);
          if (!targetExistsInPlant) return null;

          return {
            id: `${dept}-${index}`,
            dept,
            metricName: metric.metricName,
            unit: metric.unit,
            data: metric.data
          };
        }).filter(Boolean);
    });
  }, [globalChartData, filters.department, filters.search, filteredTargets]);

  const totalChartPages = Math.ceil(allCharts.length / CHARTS_PER_PAGE) || 1;
  const chartStartIndex = (chartPage - 1) * CHARTS_PER_PAGE;
  const paginatedCharts = allCharts.slice(chartStartIndex, chartStartIndex + CHARTS_PER_PAGE);

  // 10-Second Auto-Rotation Logic
  const startAutoRotation = useCallback(() => {
    if (totalChartPages <= 1) return;
    
    clearInterval(autoRotateIntervalRef.current);
    autoRotateIntervalRef.current = setInterval(() => {
      setChartPage(prev => (prev < totalChartPages ? prev + 1 : 1));
    }, 10000); 
  }, [totalChartPages]);

  useEffect(() => {
    startAutoRotation();
    return () => clearInterval(autoRotateIntervalRef.current);
  }, [startAutoRotation, allCharts.length]); 

  const handlePrevChart = () => {
    setChartPage(p => Math.max(1, p - 1));
    startAutoRotation(); 
  };
  
  const handleNextChart = () => {
    setChartPage(p => Math.min(totalChartPages, p + 1));
    startAutoRotation(); 
  };

  let achievementRate = 0;
  if (filteredSubmissions.length > 0) {
    const achievedCount = filteredSubmissions.filter(sub => !checkIsMissed(sub.actual_value, sub.target_value, sub.operator)).length;
    achievementRate = Math.round((achievedCount / filteredSubmissions.length) * 100);
  }

  const departmentsTrackedCount = filters.department === 'All' 
    ? Array.from(new Set(filteredTargets.map(t => t.dept_name))).length 
    : 1;

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setChartPage(1); 
    startAutoRotation();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <Activity size={32} className="text-brand-600 dark:text-brand-500 animate-pulse" />
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Aggregating Global Metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="w-full space-y-6"> 
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 transition-colors duration-300">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400">
                COMPANY SCOREBOARD
              </h1>
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700 uppercase tracking-wide transition-colors">
                Global Read-Only
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">
              Enterprise transparency view generated for <span className="font-bold uppercase text-jira-success dark:text-jira-success/90">{user?.name}</span>
            </p>
          </div>
          
          <div className="flex items-center text-xs font-medium bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
            <span className="text-slate-500 dark:text-slate-400 mr-2 transition-colors">Overall Health:</span>
            <div className={`flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border transition-colors ${
                filteredSubmissions.length === 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' : 
                achievementRate >= 80 ? 'bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border-jira-success/30 dark:border-jira-success/30' : 
                achievementRate >= 50 ? 'bg-jira-pending-bg dark:bg-jira-pending/20 text-jira-pending border-jira-pending/30 dark:border-jira-pending/30' : 
                'bg-jira-danger-bg dark:bg-jira-danger/20 text-jira-danger border-jira-danger/30 dark:border-jira-danger/30'
              }`}>
              <Award size={12} className="mr-1" />
              {filteredSubmissions.length === 0 ? 'Awaiting Data' : 
               achievementRate >= 80 ? 'Excellent' : 
               achievementRate >= 50 ? 'Moderate' : 'At Risk'}
            </div>
          </div>
        </div>

        <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          config={{ showSearch: false, showPlant: true, showDate: true, showDept: true, showTargetYear: true }}
          departments={allDepartments} 
          targetYears={[...new Set(activePlantTargets.map(target => target.target_year))]}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col justify-between h-24 relative overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">Active Targets</span>
              <div className="p-1.5 bg-brand-50 dark:bg-slate-900/50 text-brand-600 dark:text-brand-400 rounded-md transition-colors">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
              {filteredTargets.length}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col justify-between h-24 relative overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">Achievement Rate</span>
              <div className={`p-1.5 rounded-md transition-colors ${
                  filteredSubmissions.length === 0 ? 'bg-slate-50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500' : 
                  achievementRate >= 80 ? 'bg-jira-success-bg dark:bg-jira-success/20 text-jira-success' : 'bg-jira-pending-bg dark:bg-jira-pending/20 text-jira-pending'
                }`}>
                <Award size={16} />
              </div>
            </div>
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
                {filteredSubmissions.length === 0 ? '--' : achievementRate}
              </span>
              {filteredSubmissions.length > 0 && <span className="text-sm font-bold text-slate-400 dark:text-slate-500 transition-colors">%</span>}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 flex flex-col justify-between h-24 relative overflow-hidden transition-all duration-300 hover:shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">Departments Tracked</span>
              <div className="p-1.5 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 rounded-md transition-colors">
                <Globe size={16} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
              {departmentsTrackedCount}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden transition-colors duration-300 mb-8">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">
                Global Performance Trends
              </h3>
            </div>
            {allCharts.length > 0 && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Showing {chartStartIndex + 1}-{Math.min(chartStartIndex + CHARTS_PER_PAGE, allCharts.length)} of {allCharts.length} Charts
              </span>
            )}
          </div>
          
          <div className="p-8 bg-white dark:bg-slate-800 transition-colors">
            {allCharts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start min-h-[300px]">
                  {paginatedCharts.map((chartConfig) => (
                    <PerformanceChart 
                      key={chartConfig.id} 
                      data={chartConfig.data} 
                      metricName={`${chartConfig.metricName} (${chartConfig.dept})`} 
                      unit={chartConfig.unit}
                    />
                  ))}
                </div>
                
                {allCharts.length > CHARTS_PER_PAGE && (
                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between transition-colors">
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      Page {chartPage} of {totalChartPages}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handlePrevChart}
                        disabled={chartPage === 1}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={handleNextChart}
                        disabled={chartPage === totalChartPages}
                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full border border-slate-100 dark:border-slate-700 mb-4 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600 transition-colors" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1 transition-colors">No Chart Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">No global analytics data available to chart yet based on your current filters.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CompanyOverviewPage;