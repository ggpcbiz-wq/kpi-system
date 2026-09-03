import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, AlertTriangle, BarChart3, ChevronLeft, ChevronRight, SplitSquareHorizontal } from 'lucide-react';
import PerformanceChart from '../components/PerformanceChart';
import FilterBar from '../components/FilterBar'; 
import ConfirmModal from '../components/ConfirmModal';
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

const TopManagementPage = () => {
  const { user, token } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  
  const [filters, setFilters] = useState({ search: '', plant: 'All', period: '', department: 'All' });
  const allDepartments = ['GLOBAL', 'DX Driving Force', 'Finance & Accounting', 'Corporate Administration',  'Sales & Purchasing', 'Info. Resources Management', 'Quality Management', 'Laguna Plant', 'Cavite Plant', 'Plant Management', 'Tooling Process Development'];

  const [pendingFinalTargets, setPendingFinalTargets] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]); 
  const [globalChartData, setGlobalChartData] = useState({}); 
  const [currentChartIndex, setCurrentChartIndex] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectPayload, setRejectPayload] = useState({ id: null });
  const [rejectReason, setRejectReason] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({ id: null, title: '', message: '', btnText: '' });

  const fetchGlobalQueues = useCallback(async () => {
    try {
      const timestamp = new Date().getTime();
      
      const [targetRes, subRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      if (targetRes.ok) {
        const allTargets = await targetRes.json();
        const mappedTargets = allTargets
          .filter(t => t.status === 'Pending Top Management Approval')
          .map(t => ({
            id: t.id, 
            dept: t.dept_name, 
            section: t.section_name,
            metric: t.metric_name,
            objective: t.objective, 
            processCategory: t.process_category,
            processType: t.process_type,
            frequency: t.frequency,
            value: `${t.operator} ${t.target_value} ${t.unit}`,
            comment: t.remarks
          }));
        setPendingFinalTargets(mappedTargets);
      }
      
      if (subRes.ok) {
        const allSubmissions = await subRes.json();
        const finalized = allSubmissions.filter(sub => 
          sub.status === 'Approved' || sub.status === 'CAR Requested'
        );
        setRecentNotifications(finalized);
      }

      if (analyticsRes.ok) {
        setGlobalChartData(await analyticsRes.json());
      }
      
    } catch (error) {
      console.error("Failed to fetch global data", error);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      if (token) {
        await fetchGlobalQueues();
      }
    };
    
    loadData();
  }, [token, fetchGlobalQueues]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentChartIndex(0);
    setCurrentPage(1); 
  };

  const initiateApprove = (id, title, message, btnText) => {
    setConfirmPayload({ id, title, message, btnText });
    setIsConfirmModalOpen(true);
  };

  const executeApprove = async (comment) => {
    try {
      await fetch(`${API_BASE_URL}/api/targets/${confirmPayload.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Pending Final Activation', remarks: comment })
      });
      fetchGlobalQueues();
      setIsConfirmModalOpen(false);
    } catch (error) {
      console.error("Approval failed", error);
    }
  };

  const initiateReject = (id) => {
    setRejectPayload({ id });
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return; 
    try {
      await fetch(`${API_BASE_URL}/api/targets/${rejectPayload.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'Rejected', remarks: rejectReason })
      });
      fetchGlobalQueues();
      setIsRejectModalOpen(false);
      setRejectPayload({ id: null });
      setRejectReason('');
    } catch (error) {
      console.error("Rejection failed", error);
    }
  };

  const filteredTargets = pendingFinalTargets.filter(t => {
    const matchesDept = filters.department === 'All' || t.dept === filters.department;
    const matchesSearch = !filters.search || t.metric.toLowerCase().includes(filters.search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const filteredNotifications = recentNotifications.filter(d => {
    const matchesDept = filters.department === 'All' || d.dept_name === filters.department;
    const matchesSearch = !filters.search || d.metric_name.toLowerCase().includes(filters.search.toLowerCase());
    return matchesDept && matchesSearch;
  });
  
  const chartDeptToDisplay = filters.department === 'All' ? 'Production' : filters.department;
  const departmentMetrics = globalChartData[chartDeptToDisplay] || [];

  const handlePrevChart = () => setCurrentChartIndex(prev => (prev > 0 ? prev - 1 : departmentMetrics.length - 1));
  const handleNextChart = () => setCurrentChartIndex(prev => (prev < departmentMetrics.length - 1 ? prev + 1 : 0));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading Executive Dashboard...</p>
        </div>
      </div>
    );
  }

  const handleFinalizedTablePageChange = (nextPage, nextPageSize) => {
    if (typeof nextPageSize === 'number') {
      setItemsPerPage(nextPageSize);
      setCurrentPage(1);
      return;
    }

    const maxPage = Math.max(1, Math.ceil(filteredNotifications.length / itemsPerPage));
    setCurrentPage(Math.min(Math.max(nextPage, 1), maxPage));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 uppercase transition-colors">
              EXECUTIVE DASHBOARD
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1 transition-colors">
              Final approval authority for: <span className="font-bold uppercase text-jira-success dark:text-jira-success/90">{user?.name}</span>
            </p>
          </div>
          <div className="flex items-center">
            <span className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 uppercase tracking-wide shadow-sm transition-colors">
              Global Access
            </span>
          </div>
        </div>

       <FilterBar 
          filters={filters} 
          onFilterChange={handleFilterChange} 
          config={{ showSearch: true, showPlant: true, showDate: true, showDept: true }} 
          departments={allDepartments} 
        />

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full mb-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">
                Action Required: Target Proposals
              </h3>
            </div>
            <span className="bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-slate-800/50 py-1 px-3 rounded-md text-xs font-bold shadow-sm transition-colors">
              {filteredTargets.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[1400px]">
              <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                <tr>
                  <th className="px-6 py-4 font-bold w-[12%]">
                    <div className="flex items-center">
                      <SplitSquareHorizontal size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Section
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold w-[12%]">KPI</th>
                  <th className="px-6 py-4 font-bold w-[30%]">Objective</th>
                  <th className="px-6 py-4 font-bold w-[14%]">Process Type</th>
                  <th className="px-6 py-4 font-bold w-[7%]">Frequency</th>
                  <th className="px-6 py-4 font-bold w-[9%]">Proposed Target</th>
                  <th className="px-6 py-4 font-bold w-[9%]">Remarks</th>
                  <th className="px-6 py-4 font-bold text-right w-[7%]">Executive Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
                {filteredTargets.map(target => (
                  <tr key={target.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">{target.section || '--'}</td>
                    
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 align-top">{target.metric}</td>
                    
                    <td className="px-6 py-4 min-w-[250px] align-top">
                      {target.objective ? (
                        <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                          {target.objective}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-xs">--</span>
                      )}
                    </td>
                    
                    <td className="px-6 py-4 align-top">
                      {target.processCategory && target.processType ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 rounded-md whitespace-nowrap">
                            {target.processType}
                          </span>
                        </div>
                      ) : (
                        <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-md italic whitespace-nowrap">
                          Uncategorized
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 whitespace-nowrap align-top">
                      {target.frequency || 'Monthly'}
                    </td>

                    <td className="px-6 py-4 text-brand-600 dark:text-brand-400 font-black whitespace-nowrap align-top">{target.value}</td>
                    
                    <td className="px-6 py-4 align-top">
                      {target.comment ? (
                        <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                          {target.comment}
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-xs whitespace-nowrap">No remarks</span>
                      )}
                    </td>

                    <td className="px-6 py-4 align-top">
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => initiateApprove(target.id, 'Approve Target', `Are you sure you want to grant executive approval for the ${target.metric} target?`, 'Approve Target')} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-jira-success dark:hover:text-jira-success hover:bg-jira-success-bg dark:hover:bg-jira-success/20 border border-transparent hover:border-jira-success/30 dark:hover:border-jira-success/30 shadow-sm" title="Approve">
                          <CheckCircle size={18} />
                        </button>
                        <button onClick={() => initiateReject(target.id)} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 shadow-sm" title="Reject & Return">
                          <XCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTargets.length === 0 && <tr><td colSpan="8" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors">No pending targets match current filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Container Widget */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">
                Department Performance Context: <span className="text-brand-600 dark:text-brand-400">{chartDeptToDisplay}</span>
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-colors">
              Chart {departmentMetrics.length > 0 ? currentChartIndex + 1 : 0} of {departmentMetrics.length}
            </span>
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
                    metricName={departmentMetrics[currentChartIndex].metricName} 
                  />
                </div>

                {departmentMetrics.length > 1 && (
                  <div className="flex space-x-2 mt-8 flex-wrap justify-center px-8">
                    {departmentMetrics.map((_, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setCurrentChartIndex(idx)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentChartIndex ? 'bg-brand-600 dark:bg-brand-500 w-6' : 'bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full mb-4 border border-slate-100 dark:border-slate-700 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600 transition-colors" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1 transition-colors">No Chart Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">No historical chart data available for this department.</p>
              </div>
            )}
          </div>
        </div>

        <FinalizedSubmissionsTable
          rows={filteredNotifications}
          emptyText="No finalized submissions available."
          showPagination={filteredNotifications.length > 0}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          totalRows={filteredNotifications.length}
          onPageChange={handleFinalizedTablePageChange}
          getMonthName={getMonthName}
          checkIsMissed={checkIsMissed}
        />

      </div>

      <ConfirmModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeApprove}
        title={confirmPayload.title}
        message={confirmPayload.message}
        confirmText={confirmPayload.btnText}
        showCommentInput={true} 
      />

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
           <div className="w-full max-w-2xl overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 transition-colors">
              <h3 className="flex items-center text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">
                <AlertTriangle size={20} className="mr-2.5 text-rose-600 dark:text-rose-400"/>
                Mandatory Feedback Required
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-8">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 transition-colors">Please provide a detailed reason for rejecting this proposed target. It will be returned to the QMR.</p>
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
              <button onClick={confirmReject} disabled={!rejectReason.trim()} className="px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TopManagementPage;