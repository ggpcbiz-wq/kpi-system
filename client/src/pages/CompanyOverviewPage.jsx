import { useState, useEffect, useMemo } from 'react';
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
  
  const [filters, setFilters] = useState({ search: '', period: '', department: 'All' });
  const [rawTargets, setRawTargets] = useState([]);
  const [rawSubmissions, setRawSubmissions] = useState([]);
  const [globalChartData, setGlobalChartData] = useState({});
  const [currentChartIndex, setCurrentChartIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadOverviewData = async () => {
      try {
        setIsLoading(true);
        const timestamp = new Date().getTime();
        
        // Pass plantQuery for endpoints that support it, but rely on FE mapping for strict safety
        const plantQuery = selectedPlant !== 'All Plants' ? `&plant=${selectedPlant}` : '';
        
        const [targetRes, subRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}${plantQuery.replace('&', '?')}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } })
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

  // Map Target IDs to Plants for secure cross-referencing
  const targetPlantMap = useMemo(() => {
    const map = {};
    rawTargets.forEach(t => { map[t.id] = t.plant; });
    return map;
  }, [rawTargets]);

  // Enforce Plant Filters on Core Datasets
  const activePlantTargets = useMemo(() => {
    return rawTargets.filter(t => selectedPlant === 'All Plants' || t.plant === selectedPlant);
  }, [rawTargets, selectedPlant]);

  const allDepartments = Array.from(new Set(activePlantTargets.map(t => t.dept_name).filter(Boolean)));

  const filteredTargets = activePlantTargets.filter(t => {
    if (t.status !== 'Active') return false;
    if (filters.department !== 'All' && t.dept_name !== filters.department) return false;
    if (filters.search && !t.metric_name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const filteredSubmissions = rawSubmissions.filter(sub => {
    const subPlant = targetPlantMap[sub.target_id] || sub.plant; // Fallback mapping integration
    const matchPlant = selectedPlant === 'All Plants' || subPlant === selectedPlant;
    const matchDept = filters.department === 'All' || sub.dept_name === filters.department;
    let matchPeriod = true;
    
    if (filters.period) {
      const [year, month] = filters.period.split('-');
      matchPeriod = (sub.report_year === parseInt(year)) && (sub.report_month === parseInt(month, 10));
    }
    
    return matchPlant && matchDept && matchPeriod;
  });

  const allCharts = useMemo(() => {
    return Object.entries(globalChartData).flatMap(([dept, metrics]) => {
      if (filters.department !== 'All' && dept !== filters.department) return [];
      
      return metrics
        .filter(m => m.data && m.data.length > 0)
        .map((metric, index) => {
          if (filters.search && !metric.metricName.toLowerCase().includes(filters.search.toLowerCase())) return null;
          
          // Strict verification: Only render chart if the metric exists in the currently active plant
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

  let achievementRate = 0;
  if (filteredSubmissions.length > 0) {
    const achievedCount = filteredSubmissions.filter(sub => !checkIsMissed(sub.actual_value, sub.target_value, sub.operator)).length;
    achievementRate = Math.round((achievedCount / filteredSubmissions.length) * 100);
  }

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentChartIndex(0); 
  };

  const handlePrevChart = () => setCurrentChartIndex(prev => (prev > 0 ? prev - 1 : allCharts.length - 1));
  const handleNextChart = () => setCurrentChartIndex(prev => (prev < allCharts.length - 1 ? prev + 1 : 0));

  useEffect(() => {
    if (allCharts.length <= 1) return;
    const autoScrollInterval = setInterval(() => {
      setCurrentChartIndex(prev => prev < allCharts.length - 1 ? prev + 1 : 0);
    }, 5000); 
    return () => clearInterval(autoScrollInterval);
  }, [allCharts.length]);

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
          config={{ showSearch: false, showPlant: true, showDate: true, showDept: true }} 
          departments={allDepartments} 
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
              {filters.department === 'All' ? allDepartments.length : 1}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden transition-colors duration-300">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-4 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 transition-colors">
                Performance Trends
              </h3>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-colors">
                Chart {allCharts.length > 0 ? currentChartIndex + 1 : 0} of {allCharts.length}
              </span>
              
              {allCharts.length > 1 && (
                <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md p-0.5 shadow-sm transition-colors">
                  <button onClick={handlePrevChart} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 transition-colors"></div>
                  <button onClick={handleNextChart} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 relative flex flex-col items-center justify-center min-h-150 w-full">
            {allCharts.length > 0 ? (
              <div className="w-full max-w-350 h-full flex flex-col items-center animate-in fade-in duration-500 flex-1">
                <div className="w-full px-2 sm:px-4 flex-1 flex flex-col">
                  <PerformanceChart 
                    data={allCharts[currentChartIndex].data} 
                    metricName={`${allCharts[currentChartIndex].metricName} (${allCharts[currentChartIndex].dept})`} 
                    unit={allCharts[currentChartIndex].unit}
                  />
                </div>

                {allCharts.length > 1 && (
                  <div className="flex space-x-2 mt-6 flex-wrap justify-center shrink-0">
                    {allCharts.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setCurrentChartIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentChartIndex ? 'bg-brand-600 dark:bg-brand-500 w-6' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                        aria-label={`Go to chart ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full mb-4 border border-slate-100 dark:border-slate-700 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1 transition-colors">No Data Available</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm transition-colors">There is no historical chart data available based on your current filter selection.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default CompanyOverviewPage;