import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CheckCircle, XCircle, AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Info, FileSpreadsheet, Layers, SplitSquareHorizontal } from 'lucide-react';
import PerformanceChart from '../components/PerformanceChart';
import TargetProposalForm from '../components/TargetProposalForm';
import TargetListTable from '../components/TargetListTable'; 
import ConfirmModal from '../components/ConfirmModal';
import FilterBar from '../components/FilterBar';
import FinalizedSubmissionsTable from '../components/FinalizedSubmissionTable';
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

const ManagerPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeChartTab, setActiveChartTab] = useState('DEPT-001');
  const [currentChartIndex, setCurrentChartIndex] = useState(0);

  const [filters, setFilters] = useState({ search: '', plant: 'All', period: '', department: 'All' });

  const [pendingData, setPendingData] = useState([]);
  const [globalFinalizedSubmissions, setGlobalFinalizedSubmissions] = useState([]); 
  const [proposedTargets, setProposedTargets] = useState([]); 
  const [globalChartData, setGlobalChartData] = useState({}); 
  const [refreshTrigger, setRefreshTrigger] = useState(0); 

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectPayload, setRejectPayload] = useState({ id: null });
  const [rejectReason, setRejectReason] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({ id: null, title: '', message: '', btnText: '' });
  const [isSubmittingTarget, setIsSubmittingTarget] = useState(false);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const fetchManagerData = async () => {
      try {
        const timestamp = new Date().getTime();

        const targetRes = await fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (targetRes.ok && isMounted) {
          const targets = await targetRes.json();
          setProposedTargets(targets);
        }

        const submissionsRes = await fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (submissionsRes.ok && isMounted) {
          const submissions = await submissionsRes.json();
          
          const pending = submissions.filter(sub => {
            const isPending = sub.status === 'Locked - Pending Manager Review';
            const matchDept = filters.department === 'All' ? true : sub.dept_name === filters.department;
            let matchPeriod = true;
            if (filters.period) {
              const [year, month] = filters.period.split('-');
              matchPeriod = (sub.report_year === parseInt(year)) && (sub.report_month === parseInt(month, 10));
            }
            return isPending && matchDept && matchPeriod;
          });
          setPendingData(pending);

          setGlobalFinalizedSubmissions(
            submissions.filter(s => s.status === 'Approved' || s.status === 'CAR Requested')
          );
        }

        const analyticsRes = await fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (analyticsRes.ok && isMounted) {
          const analytics = await analyticsRes.json();
          setGlobalChartData(analytics);
          if (Object.keys(analytics).length > 0 && !analytics[activeChartTab]) {
            setActiveChartTab(Object.keys(analytics)[0]);
          }
        }

      } catch (error) {
        console.error("Dashboard Fetch Error:", error); 
        if (isMounted) addToast("Failed to fetch manager data", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchManagerData();
    return () => { isMounted = false; };
  }, [token, refreshTrigger, activeChartTab, filters.department, filters.period, addToast]);

  const departmentMetrics = globalChartData[activeChartTab] || [];
  
  const handlePrevChart = () => setCurrentChartIndex(prev => (prev > 0 ? prev - 1 : departmentMetrics.length - 1));
  const handleNextChart = () => setCurrentChartIndex(prev => (prev < departmentMetrics.length - 1 ? prev + 1 : 0));

  const handleTabChange = (dept) => {
    if (dept !== activeChartTab) {
      setActiveChartTab(dept);
      setCurrentChartIndex(0);
    }
  };
 
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentChartIndex(0);
    setCurrentPage(1); 
  };

  const handleFinalizedTablePageChange = (nextPage, nextPageSize) => {
    if (typeof nextPageSize === 'number') {
      setItemsPerPage(nextPageSize);
      setCurrentPage(1);
      return;
    }
    const maxPage = Math.max(1, Math.ceil(globalFinalizedSubmissions.length / itemsPerPage));
    setCurrentPage(Math.min(Math.max(nextPage, 1), maxPage));
  };

  const handleProposeTarget = async (formData) => {
    setIsSubmittingTarget(true);
    try {
      const payload = {
        metric_name: formData.metric_name, 
        target_value: parseFloat(formData.target_value),
        operator: formData.operator, 
        unit: formData.unit,
        department: formData.department, 
        section: formData.section,
        remarks: '',
        process_category: formData.process_category, 
        process_type: formData.process_type,         
        frequency: formData.frequency                
      };

      const response = await fetch(`${API_BASE_URL}/api/targets`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Failed to create target');
      addToast("Target successfully proposed to Top Management.", "success");
      setRefreshTrigger(prev => prev + 1); 
    } catch (error) {
      console.error("Target Propose Error:", error); 
      addToast("Failed to propose target.", "error");
    } finally {
      setIsSubmittingTarget(false);
    }
  };

  const initiateApproveData = (id, month, metric) => {
    setConfirmPayload({ 
      id, 
      title: 'Approve Monthly Data', 
      message: `Are you sure you want to approve the ${month} data for ${metric} and escalate it to the QMR?`, 
      btnText: 'Approve & Escalate' 
    });
    setIsConfirmModalOpen(true);
  };

  const executeApproveData = async () => {
    setIsConfirmModalOpen(false);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${confirmPayload.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Locked - Pending QMR Sign-Off' })
      });
      if (!res.ok) throw new Error("Approval failed");
      addToast("Submission approved and escalated to QMR successfully.", "success");
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Approval Error:", error); 
      addToast("Failed to approve submission.", "error");
      setIsLoading(false);
    }
  };

  const initiateRejectData = (id) => {
    setRejectPayload({ id });
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const confirmRejectData = async () => {
    if (!rejectReason.trim()) return; 
    setIsRejectModalOpen(false);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/submissions/${rejectPayload.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Rejected', remarks: rejectReason })
      });
      if (!res.ok) throw new Error("Rejection failed");
      addToast("Submission rejected and returned to Supervisor.", "success");
      setRejectPayload({ id: null });
      setRejectReason('');
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Rejection Error:", error); 
      addToast("Failed to reject submission.", "error");
      setIsLoading(false);
    }
  };

  const allDepartments = Array.from(new Set(proposedTargets.map(t => t.dept_name).filter(Boolean)));

  if (isLoading && proposedTargets.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading Aggregated Queues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors duration-300">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 uppercase">
              MANAGER'S DASHBOARD
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Aggregated downline view for: <span className="font-bold uppercase text-jira-success dark:text-jira-success/90">{user?.name}</span>
            </p>
          </div>
        </div>

        <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          config={{ showSearch: false, showPlant: false, showDate: true, showDept: true }}
          departments={allDepartments}
        />

        <div className="flex flex-col space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 w-full transition-colors duration-300">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Propose Department KPI Target</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Targets submitted here will be routed directly to Top Management for executive approval.</p>
            </div>
            <TargetProposalForm onSubmit={handleProposeTarget} isSubmitting={isSubmittingTarget} />
          </div>

          <div className="w-full">
             <TargetListTable targets={proposedTargets} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full mb-8 mt-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Action Required: Monthly Data Submissions
              </h3>
            </div>
            <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 py-1 px-3 rounded-md text-xs font-bold shadow-sm transition-colors">
              {pendingData.length} Pending
            </span>
          </div>
          
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[1200px]">
              <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                <tr>
                  <th className="px-6 py-4 font-bold">
                    <div className="flex items-center">
                      <Layers size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Dept
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">
                    <div className="flex items-center">
                      <SplitSquareHorizontal size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Section
                    </div>
                  </th>
                  {/* ✨ FIX: Header Renamed to KPI */}
                  <th className="px-6 py-4 font-bold">KPI (Month)</th>
                  <th className="px-6 py-4 font-bold">Target</th>
                  <th className="px-6 py-4 font-bold">Actual</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">
                    <div className="flex items-center">
                      <Info size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Explanation
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
                {pendingData.map(data => {
                  const isMissed = checkIsMissed(data.actual_value, data.target_value, data.operator);
                  return (
                    <tr key={data.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{data.dept_name || 'Unassigned'}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{data.section_name || '--'}</td>
                      
                      {/* ✨ FIX: KPI Render */}
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {data.metric_name} 
                        <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">({getMonthName(data.report_month)})</span>
                      </td>
                      
                      <td className="px-6 py-4 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {data.operator} {data.target_value} <span className="text-xs text-slate-400 dark:text-slate-500 ml-0.5">{data.unit}</span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                         <strong className={isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-jira-success dark:text-jira-success/90'}>
                           {data.actual_value} <span className="text-xs ml-0.5 font-normal">{data.unit}</span>
                         </strong>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 whitespace-nowrap transition-colors">
                            {data.status}
                          </span>
                          {isMissed ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 whitespace-nowrap transition-colors">Missed</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border border-jira-success/30 dark:border-jira-success/30 whitespace-nowrap transition-colors">Achieved</span>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 min-w-[250px] max-w-[350px]">
                        {data.remarks ? (
                          <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                            {data.remarks}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-xs block">No explanation provided</span>
                        )}
                        
                        {data.supporting_data && (
                          <a 
                            href={data.supporting_data.replace(/^"|"$/g, '')} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-2.5 text-[10px] font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-slate-600 px-2.5 py-1.5 rounded border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors shadow-sm"
                            title="View Supporting Evidence"
                          >
                            <FileSpreadsheet size={12} className="mr-1.5" />
                            View Attachment
                          </a>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => initiateApproveData(data.id, getMonthName(data.report_month), data.metric_name)} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-jira-success dark:hover:text-jira-success hover:bg-jira-success-bg dark:hover:bg-jira-success/20 border border-transparent hover:border-jira-success/30 dark:hover:border-jira-success/30 shadow-sm" title="Approve & Escalate to QMR">
                            <CheckCircle size={18} />
                          </button>
                          <button onClick={() => initiateRejectData(data.id)} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 shadow-sm" title="Reject & Return to Supervisor">
                            <XCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {pendingData.length === 0 && <tr><td colSpan="8" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors">No pending submissions match your filter.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Downline Performance Carousel
              </h3>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex flex-wrap gap-2">
                {Object.keys(globalChartData).map(dept => (
                  <button key={dept} onClick={() => handleTabChange(dept)} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-colors ${activeChartTab === dept ? 'bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'}`}>
                    {dept}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="p-8 bg-white dark:bg-slate-800 relative flex flex-col items-center justify-center min-h-[450px] transition-colors">
            {departmentMetrics.length > 0 ? (
              <div className="w-full max-w-6xl relative flex flex-col items-center">
                
                {departmentMetrics.length > 1 && (
                  <>
                    <button onClick={handlePrevChart} className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 md:-ml-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md rounded-full p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-600 z-10 transition-colors">
                      <ChevronLeft size={28} />
                    </button>
                    <button onClick={handleNextChart} className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 md:-mr-8 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md rounded-full p-2 text-slate-500 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-slate-600 z-10 transition-colors">
                      <ChevronRight size={28} />
                    </button>
                  </>
                )}
                
                <div className="w-full px-6 md:px-12 animate-in fade-in duration-500">
                  <PerformanceChart 
                    data={departmentMetrics[currentChartIndex].data} 
                    metricName={`${departmentMetrics[currentChartIndex].metricName} (${activeChartTab})`} 
                  />
                </div>

                {departmentMetrics.length > 1 && (
                  <div className="flex space-x-2 mt-8 flex-wrap justify-center px-8">
                    {departmentMetrics.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setCurrentChartIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentChartIndex ? 'bg-brand-600 dark:bg-brand-500 w-6' : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full border border-slate-100 dark:border-slate-700 mb-4 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600 transition-colors" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1 transition-colors">No Chart Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">No submission data available for this metric yet.</p>
              </div>
            )}
          </div>
        </div>

        <FinalizedSubmissionsTable
          rows={globalFinalizedSubmissions}
          emptyText="No finalized submissions available across the company yet."
          showPagination={globalFinalizedSubmissions.length > 0}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalRows={globalFinalizedSubmissions.length}
          onPageChange={handleFinalizedTablePageChange}
          getMonthName={getMonthName}
          checkIsMissed={checkIsMissed}
        />

      </div>

      <ConfirmModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeApproveData}
        title={confirmPayload.title}
        message={confirmPayload.message}
        confirmText={confirmPayload.btnText}
      />

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
           <div className="w-full max-w-2xl overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 transition-colors">
              <h3 className="flex items-center text-lg font-bold text-slate-900 dark:text-slate-100">
                <AlertTriangle size={20} className="mr-2.5 text-rose-600 dark:text-rose-400"/>
                Mandatory Feedback Required
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-8">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 transition-colors">Please provide a detailed reason for rejecting this monthly data submission. It will be returned to the Supervisor.</p>
              <textarea 
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 h-32 text-sm text-slate-800 dark:text-slate-100 resize-none bg-slate-50 dark:bg-slate-900/50 transition-colors" 
                placeholder="Enter rejection reason here..." 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)} 
                autoFocus 
              />
            </div>
            <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end space-x-3 transition-colors">
              <button onClick={() => setIsRejectModalOpen(false)} className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-slate-800 border rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                Cancel
              </button>
              <button onClick={confirmRejectData} disabled={!rejectReason.trim()} className="px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManagerPage;