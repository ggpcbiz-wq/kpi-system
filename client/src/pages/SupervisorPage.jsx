import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BarChart3, ShieldAlert, FileSpreadsheet, X, AlertTriangle, Info } from 'lucide-react';
import TargetListTable from '../components/TargetListTable';
import PerformanceChart from '../components/PerformanceChart';
import FilterBar from '../components/FilterBar'; 
import MonthlyDataEntryForm from '../components/MonthlyDataEntryForm';
import { API_BASE_URL } from '../services/api';

const getMonthName = (monthNumber) => {
  const date = new Date();
  date.setMonth(monthNumber - 1);
  return date.toLocaleString('default', { month: 'short' });
};

const checkIsMissed = (actual, target, operator) => {
  const act = parseFloat(actual);
  const tgt = parseFloat(target);
  if (operator === '≤' || operator === '<=') return act > tgt;
  if (operator === '<') return act >= tgt;
  if (operator === '=' || operator === '==') return act !== tgt;
  return act < tgt; 
};

const SupervisorPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  
  const [rawTargets, setRawTargets] = useState([]);
  const [rawSubmissions, setRawSubmissions] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const defaultDept = user?.departments?.[0] || 'GLOBAL';
  const [filters, setFilters] = useState({ search: '', plant: user?.plant || 'All', period: '', department: defaultDept });
  
  // Enforces siloed data access rule for Supervisors
  const isOwnDepartment = filters.department === 'All' || (user?.departments?.includes(filters.department) || false);

  // TIMING LOGIC
  const today = new Date();
  const currentDay = today.getDate();
  let expectedReportMonth = today.getMonth(); 
  let expectedReportYear = today.getFullYear();
  
  if (expectedReportMonth === 0) { 
    expectedReportMonth = 12;
    expectedReportYear -= 1;
  }
  
  const isFirstWeek = currentDay >= 1 && currentDay <= 7;
  const isThirdWeekOrLater = currentDay >= 15;

  useEffect(() => {
    if (!token) return;
    let isMounted = true; 

    const fetchDashboardData = async () => {
      try {
        const [targetRes, subRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/targets`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/submissions`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (targetRes.ok && subRes.ok && isMounted) {
          setRawTargets(await targetRes.json());
          setRawSubmissions(await subRes.json());
        }
      } catch (error) {
        console.error("Dashboard Fetch Error:", error); 
        if (isMounted) addToast("Failed to load dashboard data", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDashboardData();
    return () => { isMounted = false; };
  }, [token, refreshTrigger, addToast]);

  const filteredTargets = useMemo(() => {
    return rawTargets.filter(t => {
      if (t.status === 'Rejected') return false;
      return filters.department === 'All' ? true : t.dept_name === filters.department;
    });
  }, [rawTargets, filters.department]);

  const processedTargets = useMemo(() => {
    return filteredTargets.map(target => {
      const hasSubmission = rawSubmissions.some(sub => 
        sub.target_id === target.id && 
        sub.report_month === expectedReportMonth && 
        sub.report_year === expectedReportYear
      );
      
      return {
        ...target,
        isOverdue: !hasSubmission && isThirdWeekOrLater && target.status === 'Active'
      };
    });
  }, [filteredTargets, rawSubmissions, expectedReportMonth, expectedReportYear, isThirdWeekOrLater]);

  const hasPendingFirstWeekData = useMemo(() => {
    if (!isFirstWeek) return false;
    
    const activeDeptTargets = rawTargets.filter(t => 
      t.status === 'Active' && 
      (filters.department === 'All' ? true : t.dept_name === filters.department)
    );

    return activeDeptTargets.some(target => {
      const hasSubmission = rawSubmissions.some(sub => 
        sub.target_id === target.id && 
        sub.report_month === expectedReportMonth && 
        sub.report_year === expectedReportYear
      );
      return !hasSubmission;
    });
  }, [isFirstWeek, rawTargets, rawSubmissions, filters.department, expectedReportMonth, expectedReportYear]);

  const filteredSubmissions = useMemo(() => {
    return rawSubmissions.filter(sub => {
      const matchDept = filters.department === 'All' ? true : sub.dept_name === filters.department;
      let matchPeriod = true;
      if (filters.period) {
        const [year, month] = filters.period.split('-');
        matchPeriod = (sub.report_year === parseInt(year)) && (sub.report_month === parseInt(month, 10));
      }
      return matchDept && matchPeriod;
    });
  }, [rawSubmissions, filters.department, filters.period]);

  const dynamicChartData = useMemo(() => {
    const grouped = {};
    const targetsToChart = filters.department === 'All' ? rawTargets : filteredTargets;

    targetsToChart.forEach(t => {
      const dept = t.dept_name || 'Unassigned';
      if (!grouped[dept]) grouped[dept] = [];
      
      let chartSubs = rawSubmissions.filter(s => 
        s.target_id === t.id && 
        (s.status === 'Approved' || s.status === 'CAR Requested')
      );

      if (filters.period) {
        const [year, month] = filters.period.split('-');
        chartSubs = chartSubs.filter(s => 
          s.report_year === parseInt(year) && s.report_month <= parseInt(month, 10)
        );
      } else {
        const currentYear = new Date().getFullYear();
        chartSubs = chartSubs.filter(s => s.report_year === currentYear);
      }
      
      chartSubs.sort((a, b) => a.report_month - b.report_month);
      
      const dataPoints = chartSubs.map(sub => {
        const date = new Date();
        date.setMonth(sub.report_month - 1);
        return {
          month: date.toLocaleString('default', { month: 'short' }),
          target: parseFloat(sub.target_value),
          actual: parseFloat(sub.actual_value)
        };
      });

      grouped[dept].push({ metricName: t.metric_name, unit: t.unit, data: dataPoints });
    });
    return grouped;
  }, [filteredTargets, rawTargets, rawSubmissions, filters.department, filters.period]);


  const handleOpenDataEntry = (target) => {
    setSelectedTarget(target);
    setIsEntryModalOpen(true);
  };

  const handleDataEntrySuccess = () => {
    setIsEntryModalOpen(false);
    setSelectedTarget(null);
    setIsLoading(true); 
    setRefreshTrigger(prev => prev + 1); 
  };

  const chartDeptToDisplay = filters.department === 'All' ? defaultDept : filters.department;
  const departmentMetrics = dynamicChartData[chartDeptToDisplay] || [];
  const hasVisibleCharts = departmentMetrics.some(m => m.data && m.data.length > 0);

  if (isLoading && rawTargets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Loading Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Sleek Enterprise Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors duration-300">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 uppercase">
              SUPERVISOR DASHBOARD
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Write-access restricted to: <span className="font-bold uppercase text-jira-success dark:text-jira-success/90">{user?.departments?.join(', ') || 'None'}</span>
            </p>
          </div>
        </div>

        {/* Polished Alert Banner */}
        {hasPendingFirstWeekData && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl p-5 shadow-sm flex items-start animate-in fade-in slide-in-from-top-2 duration-300 transition-colors">
            <div className="shrink-0 p-1 bg-amber-100 dark:bg-amber-900/40 rounded-lg mr-4 transition-colors">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">Action Required: Monthly Data Submission</h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300/80 leading-relaxed">
                You are in the first week of the month. Please ensure all KPI actuals for <strong className="font-bold text-amber-900 dark:text-amber-200">{getMonthName(expectedReportMonth)} {expectedReportYear}</strong> are submitted by the 7th. 
                Check the targets table below to input your department's performance data.
              </p>
            </div>
          </div>
        )}

        <FilterBar 
          filters={filters} 
          onFilterChange={setFilters} 
          config={{ showSearch: false, showPlant: false, showDate: true, showDept: true }}
          departments={user?.departments || []} 
        />
        
        {isOwnDepartment ? (
           <div className="flex flex-col space-y-8">
             
             {/* Target List Container */}
             <div className="w-full">
               <TargetListTable targets={processedTargets} onSelectTarget={handleOpenDataEntry} />
             </div>

             {/* Recent Submissions Table Widget */}
             <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col w-full overflow-hidden transition-colors duration-300">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
                  <div className="flex items-center">
                    <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                      Recent Monthly Submissions
                    </h3>
                  </div>
                  <FileSpreadsheet size={20} className="text-slate-400 dark:text-slate-500" />
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-225">
                    <thead className="text-xs uppercase bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 tracking-wider transition-colors">
                      <tr>
                        <th className="px-6 py-4 font-bold">Metric (Month)</th>
                        <th className="px-6 py-4 font-bold">Target</th>
                        <th className="px-6 py-4 font-bold">Actual</th>
                        <th className="px-6 py-4 font-bold">Status</th>
                        <th className="px-6 py-4 font-bold">
                          <div className="flex items-center">
                            <Info size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Explanation History
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
                      {filteredSubmissions.slice(0, 5).map(sub => {
                        const isMissed = checkIsMissed(sub.actual_value, sub.target_value, sub.operator);
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">{sub.metric_name} <span className="text-slate-400 dark:text-slate-500 font-normal">({getMonthName(sub.report_month)})</span></td>
                            <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {sub.operator} {sub.target_value} <span className="text-xs text-slate-400 dark:text-slate-500 ml-0.5">{sub.unit}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <strong className={isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-jira-success dark:text-jira-success/90'}>
                                {sub.actual_value} <span className="text-xs ml-0.5 font-normal">{sub.unit}</span>
                              </strong>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${sub.status.includes('Returned') || sub.status.includes('Rejected') ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'}`}>
                                {sub.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 min-w-62.5 max-w-100">
                              {sub.remarks ? (
                                <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                                  {sub.remarks}
                                </div>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 italic text-xs">No explanation history</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {filteredSubmissions.length === 0 && (
                        <tr><td colSpan="5" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-800/30 font-medium transition-colors">No recent monthly data submissions match your filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
           </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-16 text-center flex flex-col items-center justify-center space-y-4 transition-colors duration-300">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full border border-slate-100 dark:border-slate-700 transition-colors">
              <ShieldAlert size={40} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-1">Restricted View</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">You are viewing historical data for <span className="font-bold text-slate-700 dark:text-slate-300">{filters.department}</span>. You cannot submit data for this department.</p>
            </div>
          </div>
        )}

        {/* Charts Container Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mt-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Department Performance: <span className="text-brand-600 dark:text-brand-400">{chartDeptToDisplay}</span>
              </h3>
            </div>
          </div>
          
          <div className="p-8 bg-white dark:bg-slate-800 transition-colors">
            {hasVisibleCharts ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                {departmentMetrics.map((metric, index) => (
                  metric.data && metric.data.length > 0 ? (
                    <PerformanceChart 
                      key={index} 
                      data={metric.data} 
                      metricName={metric.metricName} 
                      unit={metric.unit} 
                    />
                  ) : null
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full mb-4 border border-slate-100 dark:border-slate-700 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1">No Chart Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No target data submitted for this department yet.</p>
              </div>
            )}
          </div>
        </div>
        
      </div>

      {/* Data Entry Modal */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-3xl animate-in zoom-in-95 duration-200 bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden transition-colors">
            <div className="flex justify-end p-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 transition-colors">
              <button 
                onClick={() => { setIsEntryModalOpen(false); setSelectedTarget(null); }} 
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <MonthlyDataEntryForm activeTarget={selectedTarget} onSuccess={handleDataEntrySuccess} onCancel={() => { setIsEntryModalOpen(false); setSelectedTarget(null); }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorPage;