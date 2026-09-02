import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CheckCircle, XCircle, AlertTriangle, PlayCircle, MessageSquare, BarChart3, Info, FileSpreadsheet, Layers, SplitSquareHorizontal } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import PerformanceChart from '../components/PerformanceChart';
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

const getQuarterlyAverage = (deptName, metricName, currentMonthNumber, currentActualValue, currentTargetValue, globalChartData) => {
  const targetQuarter = Math.ceil(currentMonthNumber / 3);
  const deptData = globalChartData[deptName] || [];
  const metricData = deptData.find(m => m.metricName === metricName);

  const monthToQ = {
    Jan: 1, Feb: 1, Mar: 1, Apr: 2, May: 2, Jun: 2,
    Jul: 3, Aug: 3, Sep: 3, Oct: 4, Nov: 4, Dec: 4
  };
  
  const numToAbbr = {
    1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun',
    7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec'
  };
  
  const currentAbbr = numToAbbr[currentMonthNumber];
  const quarterData = {};
  
  if (metricData && metricData.data) {
    metricData.data.forEach(d => {
      const monthAbbr = d.month.substring(0, 3);
      if (monthToQ[monthAbbr] === targetQuarter) {
        quarterData[monthAbbr] = { actual: parseFloat(d.actual), target: parseFloat(d.target) };
      }
    });
  }

  quarterData[currentAbbr] = { 
    actual: parseFloat(currentActualValue), 
    target: parseFloat(currentTargetValue) 
  };

  const monthsInQuarter = Object.values(quarterData);
  if (monthsInQuarter.length === 0) return { target: '--', actual: '--' };

  const actualSum = monthsInQuarter.reduce((sum, item) => sum + (item.actual || 0), 0);
  const targetSum = monthsInQuarter.reduce((sum, item) => sum + (item.target || 0), 0);
  const count = monthsInQuarter.length;

  return {
    target: Number((targetSum / count).toFixed(2)),
    actual: Number((actualSum / count).toFixed(2))
  };
};

const WorkflowControlPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [finalActivationQueue, setFinalActivationQueue] = useState([]);
  const [pendingMonthlyData, setPendingMonthlyData] = useState([]);
  const [globalChartData, setGlobalChartData] = useState({});

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectPayload, setRejectPayload] = useState({ id: null, queueName: '' });
  const [rejectReason, setRejectReason] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmPayload, setConfirmPayload] = useState({ id: null, title: '', message: '', btnText: '', queueName: '' });

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const fetchAdminQueues = async () => {
      try {
        const timestamp = new Date().getTime();

        const targetRes = await fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (targetRes.ok && isMounted) {
          const allTargets = await targetRes.json();
          const finalTargets = allTargets
            .filter(t => t.status === 'Pending Final Activation')
            .map(t => ({
              id: t.id, 
              dept: t.dept_name, 
              section: t.section_name, // Map section dimension
              metric: t.metric_name,
              processCategory: t.process_category,
              processType: t.process_type,
              frequency: t.frequency,
              value: `${t.operator} ${t.target_value} ${t.unit}`,
              execApprover: 'Top Management', 
              comment: t.remarks
            }));
          setFinalActivationQueue(finalTargets); 
        }

        const subRes = await fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (subRes.ok && isMounted) {
          const allSubmissions = await subRes.json();
          setPendingMonthlyData(allSubmissions.filter(sub => sub.status === 'Locked - Pending QMR Sign-Off'));
        }

        const analyticsRes = await fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (analyticsRes.ok && isMounted) {
          const analytics = await analyticsRes.json();
          setGlobalChartData(analytics);
        }
        
      } catch (error) {
        console.error("Failed to fetch admin queues", error);
        if (isMounted) addToast("Failed to fetch workflow data", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAdminQueues();
    return () => { isMounted = false; };
  }, [token, refreshTrigger, addToast]); 

  const initiateApprove = (id, queueName, title, message, btnText) => {
    setConfirmPayload({ id, queueName, title, message, btnText });
    setIsConfirmModalOpen(true);
  };

  const executeApprove = async (comment) => {
    setIsLoading(true);
    try {
      if (confirmPayload.queueName === 'final') {
        await fetch(`${API_BASE_URL}/api/targets/${confirmPayload.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: 'Active', remarks: comment })
        });
        addToast("Target successfully activated.", "success");

      } else if (confirmPayload.queueName === 'monthly') {
        await fetch(`${API_BASE_URL}/api/submissions/${confirmPayload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: 'Approved', remarks: comment })
        });
        addToast("Monthly data successfully signed off and finalized.", "success");

      } else if (confirmPayload.queueName === 'issue_car') {
        await fetch(`${API_BASE_URL}/api/submissions/${confirmPayload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: 'CAR Requested', remarks: comment })
        });
        addToast("CAR Request issued successfully. Notification sent to department.", "success");
      }
      
      setRefreshTrigger(prev => prev + 1);
      setIsConfirmModalOpen(false);
    } catch (error) {
      console.error("Approval failed", error);
      addToast("Failed to process request.", "error");
      setIsLoading(false);
    }
  };

  const initiateReject = (id, queueName) => {
    setRejectPayload({ id, queueName });
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) return; 
    setIsLoading(true);
    
    try {
      if (rejectPayload.queueName === 'monthly') {
        await fetch(`${API_BASE_URL}/api/submissions/${rejectPayload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: 'Rejected', remarks: rejectReason })
        });
        addToast("Monthly submission rejected and returned to Supervisor.", "success");
      }
      
      setRefreshTrigger(prev => prev + 1);
      setIsRejectModalOpen(false);
    } catch (error) {
      console.error("Rejection failed", error);
      addToast("Failed to reject data.", "error");
      setIsLoading(false);
    }
  };

  if (isLoading && pendingMonthlyData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading Workflow Controls...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors duration-300">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 flex items-center uppercase">
              QMR WORKFLOW CONTROL
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">
              System Administrator: <span className="font-bold text-jira-success dark:text-jira-success/90">{user?.name}</span>
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4 transition-colors">Target Management</h3>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full transition-colors duration-300">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
              <div className="flex items-center">
                <div className="w-1.5 h-5 bg-brand-500 rounded-full mr-3"></div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">Deploy Approved Targets</h3>
              </div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">Approved by Top Management</p>
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
                    <th className="px-6 py-4 font-bold">Metric</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Process Type</th>
                    <th className="px-6 py-4 font-bold">Freq</th>
                    <th className="px-6 py-4 font-bold">Target</th>
                    <th className="px-6 py-4 font-bold">
                      <div className="flex items-center">
                        <MessageSquare size={14} className="mr-1.5" /> Remarks
                      </div>
                    </th>
                    <th className="px-6 py-4 font-bold text-right">QMR Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
                  {finalActivationQueue.map(target => (
                    <tr key={target.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{target.dept}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{target.section || '--'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 truncate" title={target.metric}>{target.metric}</td>
                      
                      <td className="px-6 py-4">
                        {target.processCategory ? (
                          <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 rounded-md">
                            {target.processCategory}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-xs">--</span>
                        )}
                      </td>

                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">
                        {target.processType || <span className="text-slate-400 dark:text-slate-500 italic text-xs">Uncategorized</span>}
                      </td>

                      <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {target.frequency || 'Monthly'}
                      </td>

                      <td className="px-6 py-4 text-brand-600 dark:text-brand-400 font-bold whitespace-nowrap">{target.value}</td>
                      <td className="px-6 py-4 min-w-[150px] max-w-xs">
                        {target.comment ? (
                          <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                            {target.comment}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-xs">No remarks</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button 
                            onClick={() => initiateApprove(target.id, 'final', 'Activate Target', `Activate the ${target.metric} target in the system? It will go live immediately.`, 'Activate Now')} 
                            className="flex items-center px-4 py-2 text-xs font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-slate-600 border border-brand-200 dark:border-brand-800/50 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors shadow-sm" 
                            title="Activate Target"
                          >
                            <PlayCircle size={16} className="mr-1.5" /> Activate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {finalActivationQueue.length === 0 && (
                    <tr><td colSpan="9" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors">No targets pending final activation.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-800 my-8 transition-colors" />

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col w-full mb-8 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">Action Required: Monthly Data Sign-off</h3>
            </div>
            <span className="bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 py-1 px-3 rounded-md text-xs font-bold shadow-sm transition-colors">
              {pendingMonthlyData.length} Pending
            </span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[1100px]">
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
                  <th className="px-6 py-4 font-bold">Metric (Month)</th>
                  <th className="px-6 py-4 font-bold">Monthly Actual</th>
                  <th className="px-6 py-4 font-bold border-l border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 transition-colors">QTD Average</th>
                  <th className="px-6 py-4 font-bold">
                    <div className="flex items-center">
                      <Info size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Explanation
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">QMR Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
                {pendingMonthlyData.map(data => {
                  const isMissed = checkIsMissed(data.actual_value, data.target_value, data.operator);
                  const monthName = getMonthName(data.report_month);
                  
                  const qtdAvg = getQuarterlyAverage(
                    data.dept_name, 
                    data.metric_name, 
                    data.report_month, 
                    data.actual_value, 
                    data.target_value, 
                    globalChartData
                  );
                  const isQtdMissed = qtdAvg.actual !== '--' ? checkIsMissed(qtdAvg.actual, qtdAvg.target, data.operator) : false;
                  
                  const isEndOfQuarter = data.report_month % 3 === 0;

                  return (
                    <tr key={data.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{data.dept_name || 'Unassigned'}</td>
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{data.section_name || '--'}</td>
                      <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {data.metric_name} 
                        <span className="block text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 transition-colors">({monthName})</span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium transition-colors">Target: {data.operator} {data.target_value} {data.unit}</div>
                        <strong className={isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-jira-success dark:text-jira-success/90'}>
                          Actual: {data.actual_value} <span className="text-xs ml-0.5 font-normal">{data.unit}</span>
                        </strong>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap border-l border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-900/30 transition-colors">
                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 font-medium transition-colors">Avg Tgt: {qtdAvg.target !== '--' ? `${data.operator} ${qtdAvg.target}` : '--'} {qtdAvg.target !== '--' && data.unit}</div>
                        <strong className={isQtdMissed ? 'text-rose-600 dark:text-rose-400' : 'text-jira-success dark:text-jira-success/90'}>
                          Avg Act: {qtdAvg.actual} <span className="text-xs ml-0.5 font-normal">{qtdAvg.actual !== '--' && data.unit}</span>
                        </strong>
                      </td>

                      <td className="px-6 py-4 min-w-[200px] max-w-[300px]">
                        {data.remarks ? (
                          <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                            {data.remarks}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-xs block transition-colors">No explanation provided</span>
                        )}

                        {data.supporting_data && (
                          <a 
                            href={data.supporting_data.replace(/^"|"$/g, '')} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center mt-2.5 text-[10px] font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2.5 py-1.5 rounded border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors shadow-sm"
                            title="View Supporting Evidence"
                          >
                            <FileSpreadsheet size={12} className="mr-1.5" />
                            View Attachment
                          </a>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-2">
                          {isMissed ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 whitespace-nowrap transition-colors">Missed</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border border-jira-success/30 dark:border-jira-success/30 whitespace-nowrap transition-colors">Achieved</span>
                          )}
                          
                          {data.kintone_car_id && (
                            <div className="text-[10px] font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-2 py-0.5 rounded border border-brand-200 dark:border-brand-800/50 whitespace-nowrap shadow-sm transition-colors" title="Kintone CAR Attached">
                              CAR: {data.kintone_car_id}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => initiateApprove(data.id, 'monthly', 'Sign-off Data', `Provide final sign-off for ${data.dept_name}'s ${monthName} data?`, 'Sign-off Data')} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-jira-success dark:hover:text-jira-success hover:bg-jira-success-bg dark:hover:bg-jira-success/20 border border-transparent hover:border-jira-success/30 dark:hover:border-jira-success/30 shadow-sm" title="Sign-off">
                            <CheckCircle size={18} />
                          </button>
                          
                          {isQtdMissed && !data.kintone_car_id && isEndOfQuarter && (
                            <button 
                              onClick={() => initiateApprove(data.id, 'issue_car', 'Issue CAR Request', `Flag this submission and require ${data.dept_name} to link a Corrective Action Report in Kintone for missing the Quarter-to-Date average?`, 'Issue CAR Request')} 
                              className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 border border-transparent hover:border-amber-200 dark:hover:border-amber-800/50 shadow-sm" 
                              title="Require CAR"
                            >
                              <AlertTriangle size={18} />
                            </button>
                          )}

                          <button onClick={() => initiateReject(data.id, 'monthly')} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 shadow-sm" title="Reject Data">
                            <XCircle size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {pendingMonthlyData.length === 0 && (
                  <tr><td colSpan="8" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors">No monthly data pending sign-off.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-6 transition-colors duration-300">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between transition-colors">
            <div className="flex items-center">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">
                System Overview: <span className="text-brand-600 dark:text-brand-400">All Departments</span>
              </h3>
            </div>
          </div>
          
          <div className="p-8 bg-white dark:bg-slate-800 transition-colors">
            {Object.keys(globalChartData).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 items-start">
                {Object.entries(globalChartData).flatMap(([dept, metrics]) => 
                  metrics.map((metric, index) => (
                    metric.data && metric.data.length > 0 && (
                      <PerformanceChart 
                        key={`${dept}-${index}`} 
                        data={metric.data} 
                        metricName={`${metric.metricName} (${dept})`} 
                      />
                    )
                  ))
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-full border border-slate-100 dark:border-slate-700 mb-4 transition-colors">
                  <BarChart3 size={32} className="text-slate-300 dark:text-slate-600 transition-colors" />
                </div>
                <h4 className="text-slate-700 dark:text-slate-300 font-semibold mb-1 transition-colors">No Chart Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">No global analytics data available to chart yet.</p>
              </div>
            )}
          </div>
        </div>

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
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 transition-colors">Please provide a detailed reason for returning this submission.</p>
              <textarea 
                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 resize-none transition-colors" 
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
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default WorkflowControlPage;