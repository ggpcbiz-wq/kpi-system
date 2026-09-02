import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Inbox, AlertTriangle, Link as LinkIcon, CheckCircle, Send, Search, Loader2, CalendarClock, ArrowRight, X } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const getQuarterText = (year, month) => {
  const q = Math.ceil(month / 3);
  const ranges = { 1: '(Jan - Mar)', 2: '(Apr - Jun)', 3: '(Jul - Sep)', 4: '(Oct - Dec)' };
  return `Q${q} ${year} ${ranges[q]}`;
};

const getMonthName = (monthNumber) => {
  const date = new Date();
  date.setMonth(monthNumber - 1);
  return date.toLocaleString('default', { month: 'long' });
};

const getQuarterlyAverage = (deptName, metricName, monthNumber, globalChartData) => {
  const targetQuarter = Math.ceil(monthNumber / 3);
  const deptData = globalChartData[deptName] || [];
  const metricData = deptData.find(m => m.metricName === metricName);

  if (!metricData || !metricData.data) return { target: '--', actual: '--' };

  const monthToQ = {
    Jan: 1, Feb: 1, Mar: 1,
    Apr: 2, May: 2, Jun: 2,
    Jul: 3, Aug: 3, Sep: 3,
    Oct: 4, Nov: 4, Dec: 4
  };

  let actualSum = 0; let targetSum = 0; let count = 0;

  metricData.data.forEach(d => {
    const q = monthToQ[d.month.substring(0, 3)];
    if (q === targetQuarter) {
      actualSum += parseFloat(d.actual) || 0;
      targetSum += parseFloat(d.target) || 0;
      count++;
    }
  });

  return count > 0 ? {
    target: Number((targetSum / count).toFixed(2)),
    actual: Number((actualSum / count).toFixed(2))
  } : { target: '--', actual: '--' };
};

const QuarterlyCarInboxPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  const [pendingCARs, setPendingCARs] = useState([]);
  const [pendingReminders, setPendingReminders] = useState([]); 
  const [globalChartData, setGlobalChartData] = useState({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);
  
  const [kintoneIdInput, setKintoneIdInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedCarData, setFetchedCarData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date();
  const currentDay = today.getDate();
  let expectedReportMonth = today.getMonth(); 
  let expectedReportYear = today.getFullYear();
  
  if (expectedReportMonth === 0) { 
    expectedReportMonth = 12;
    expectedReportYear -= 1;
  }
  
  const isFirstWeek = currentDay >= 1 && currentDay <= 7;

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    const fetchInbox = async () => {
      try {
        const timestamp = new Date().getTime();
        const [subRes, analyticsRes, targetRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/analytics?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (subRes.ok && isMounted) {
          const allSubmissions = await subRes.json();
          
          const myPendingCARs = allSubmissions.filter(sub => {
            if (sub.status !== 'CAR Requested') return false;
            if (user?.role === 'Administrator' || user?.role === 'Top Management') return true;
            if (sub.submitted_by === user?.id || sub.submitted_by === user?.userId) return true;
            const userDepts = user?.departments || (user?.department ? [user?.department] : []);
            if (userDepts.includes(sub.dept_name)) return true;
            return false;
          });
          setPendingCARs(myPendingCARs);

          if (isFirstWeek && targetRes.ok) {
            const allTargets = await targetRes.json();
            
            const myReminders = allTargets.filter(t => {
              if (t.status !== 'Active') return false;
              const userDepts = user?.departments || (user?.department ? [user?.department] : []);
              if (user?.role === 'Administrator' || user?.role === 'Top Management') return true;
              if (userDepts.includes(t.dept_name)) return true;
              return false;
            }).filter(t => {
              const hasSubmission = allSubmissions.some(s => 
                s.target_id === t.id && 
                s.report_month === expectedReportMonth && 
                s.report_year === expectedReportYear
              );
              return !hasSubmission;
            });
            
            setPendingReminders(myReminders);
          } else {
            setPendingReminders([]); 
          }
        }

        if (analyticsRes.ok && isMounted) {
          const analytics = await analyticsRes.json();
          setGlobalChartData(analytics);
        }

      } catch (error) {
        console.error("Failed to fetch inbox", error);
        if (isMounted) addToast("Failed to load CAR Inbox", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchInbox();
  }, [token, refreshTrigger, user, addToast, expectedReportMonth, expectedReportYear, isFirstWeek]);

  const initiateResolve = (item) => {
    setActiveItem(item);
    setKintoneIdInput('');
    setFetchedCarData(null);
    setIsResolveModalOpen(true);
  };

  // ARCHITECTURAL FIX: Replaced mock timeout with secure backend proxy fetch
  const handleFetchKintoneData = async () => {
    if (!kintoneIdInput.trim()) return;
    setIsFetching(true);
    
    try {
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/api/kintone/car/${encodeURIComponent(kintoneIdInput.trim())}?_t=${timestamp}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error("CAR Record not found in Kintone.");
        throw new Error("Server communication error.");
      }

      const data = await response.json();
      setFetchedCarData(data);
      addToast("Successfully connected and synced with Kintone.", "success");
    } catch (error) {
      console.error("Kintone fetch error:", error); 
      addToast(error.message || "Failed to fetch data from Kintone. Verify Control No.", "error");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmitResolution = async (e) => {
    e.preventDefault();
    if (!fetchedCarData) return;

    setIsSubmitting(true);
    try {
      const payload = {
        status: 'Locked - Pending QMR Sign-Off', 
        kintone_car_id: fetchedCarData.control_no,
        problem_description: fetchedCarData.problem_title,
        problem_cause: fetchedCarData.root_cause,
        improvement_plan: fetchedCarData.action_plan,
        pic: fetchedCarData.pic
      };

      const res = await fetch(`${API_BASE_URL}/api/submissions/${activeItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to update submission");
      
      addToast(`Loop closed! Kintone ID ${fetchedCarData.control_no} linked successfully.`, "success");
      setRefreshTrigger(prev => prev + 1);
      setIsResolveModalOpen(false);
    } catch (error) {
      console.error("Resolution failed", error);
      addToast("Failed to link CAR.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading Inbox...</p>
        </div>
      </div>
    );
  }

  const totalActions = pendingCARs.length + pendingReminders.length;

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4 transition-colors duration-300">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 flex items-center uppercase">
              <Inbox className="mr-3 text-brand-500 dark:text-brand-400" size={40} />
              INBOX: PENDING ACTIONS
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Inbox for: <span className="font-bold text-jira-success dark:text-jira-success/90">{user?.name}</span> | Manage pending data submissions and CAR linking.
            </p>
          </div>
          {totalActions > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-lg text-sm font-bold border border-amber-200 dark:border-amber-800/30 flex items-center shadow-sm transition-colors">
              <AlertTriangle size={18} className="mr-2" />
              {totalActions} Action{totalActions !== 1 ? 's' : ''} Required
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
          
          {pendingReminders.map(target => (
            <div key={`reminder-${target.id}`} className="bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800/30 shadow-sm p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 border-l-4 border-l-amber-500 hover:shadow-md transition-all duration-300">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded uppercase tracking-wider transition-colors">
                    {target.dept_name}
                  </span>
                  <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-1 rounded uppercase tracking-wider flex items-center transition-colors">
                    <CalendarClock size={12} className="mr-1.5" /> Due by {getMonthName(expectedReportMonth)} 7th
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors">{target.metric_name}</h3>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">
                  <p className="mb-1">Missing Data For: <strong className="text-slate-800 dark:text-slate-200">{getMonthName(expectedReportMonth)} {expectedReportYear}</strong></p>
                  <p>Monthly Target: <strong className="text-slate-800 dark:text-slate-200">{target.operator} {target.target_value} {target.unit}</strong></p>
                </div>
              </div>
              <div className="shrink-0 flex items-center mt-4 md:mt-0 h-full">
                <button 
                  onClick={() => navigate('/supervisor')}
                  className="w-full md:w-auto flex items-center justify-center px-5 py-2.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800/50 rounded-lg font-bold transition-colors shadow-sm"
                >
                  Enter Actual Data
                  <ArrowRight size={18} className="ml-2" />
                </button>
              </div>
            </div>
          ))}

          {pendingCARs.map((item) => {
            const qtdAvg = getQuarterlyAverage(item.dept_name, item.metric_name, item.report_month, globalChartData);
            const quarterText = getQuarterText(item.report_year, item.report_month);

            return (
              <div key={`car-${item.id}`} className="bg-white dark:bg-slate-800 rounded-xl border border-rose-200 dark:border-rose-800/30 shadow-sm p-6 flex flex-col md:flex-row md:items-start justify-between gap-4 border-l-4 border-l-rose-500 hover:shadow-md transition-all duration-300">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-3">
                    <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded uppercase tracking-wider transition-colors">
                      {item.dept_name}
                    </span>
                    <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-1 rounded uppercase tracking-wider transition-colors">
                      {quarterText} CAR Request
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 transition-colors">{item.metric_name}</h3>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors">
                    <p className="mb-1">Quarterly Average Actual: <strong className="text-rose-600 dark:text-rose-400">{qtdAvg.actual} {item.unit}</strong></p>
                    <p>Quarterly Average Target: <strong className="text-slate-800 dark:text-slate-200">{qtdAvg.target} {item.unit}</strong></p>
                  </div>
                </div>
                <div className="shrink-0 flex items-center mt-4 md:mt-0 h-full">
                  <button 
                    onClick={() => initiateResolve({ ...item, quarterText, qtdAvg })}
                    className="w-full md:w-auto flex items-center justify-center px-5 py-2.5 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 border border-brand-200 dark:border-brand-800/50 rounded-lg font-bold transition-colors shadow-sm"
                  >
                    <LinkIcon size={18} className="mr-2" />
                    Link Kintone CAR
                  </button>
                </div>
              </div>
            )
          })}

          {totalActions === 0 && (
            <div className="col-span-1 xl:col-span-2 text-center p-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex flex-col items-center justify-center shadow-sm transition-colors duration-300">
              <CheckCircle size={56} className="text-jira-success dark:text-jira-success/80 mb-4 opacity-80" />
              <p className="text-slate-900 dark:text-slate-100 font-bold text-xl transition-colors">Inbox Zero</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-2 transition-colors">All required data has been submitted and all CARs are properly linked.</p>
            </div>
          )}
        </div>

        {isResolveModalOpen && activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm overflow-y-auto transition-all duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200 transition-colors">
              <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-between items-center transition-colors">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center transition-colors">
                  <LinkIcon size={20} className="mr-2.5 text-brand-600 dark:text-brand-400" />
                  Close the Loop: {activeItem.metric_name}
                </h3>
                <button onClick={() => setIsResolveModalOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between text-sm shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                  <span className="text-slate-500 dark:text-slate-400">Quarter: <strong className="text-slate-800 dark:text-slate-200">{activeItem.quarterText}</strong></span>
                  <span className="text-slate-500 dark:text-slate-400">Target: <strong className="text-slate-800 dark:text-slate-200">{activeItem.qtdAvg?.target} {activeItem.unit}</strong></span>
                  <span className="text-slate-500 dark:text-slate-400">Actual: <strong className="text-rose-600 dark:text-rose-400">{activeItem.qtdAvg?.actual} {activeItem.unit}</strong></span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 transition-colors">Kintone Control No. <span className="text-rose-500 dark:text-rose-400">*</span></label>
                  <div className="flex space-x-3">
                    <input 
                      type="text" 
                      className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-600 bg-white dark:bg-slate-900 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-500 dark:text-slate-100 text-sm transition-all font-medium"
                      value={kintoneIdInput}
                      onChange={(e) => setKintoneIdInput(e.target.value)}
                      placeholder="e.g., CPAR-2026-089"
                      disabled={fetchedCarData !== null || isFetching}
                    />
                    {!fetchedCarData ? (
                      <button 
                        type="button"
                        onClick={handleFetchKintoneData}
                        disabled={!kintoneIdInput.trim() || isFetching}
                        className="px-5 py-2.5 bg-slate-800 dark:bg-brand-600 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center text-sm font-bold shadow-sm"
                      >
                        {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} className="mr-2" />}
                        {isFetching ? ' Fetching...' : 'Fetch Details'}
                      </button>
                    ) : (
                      <button 
                        type="button"
                        onClick={() => setFetchedCarData(null)}
                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-bold text-sm"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-2 transition-colors">Enter the ID to pull the official report from Kintone.</p>
                </div>

                {fetchedCarData && (
                  <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800/50 rounded-xl p-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300 transition-colors">
                    <div className="flex items-center text-brand-700 dark:text-brand-400 font-bold border-b border-brand-200 dark:border-brand-800/50 pb-3 transition-colors">
                      <CheckCircle size={18} className="mr-2" /> Kintone Data Verified
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-wider transition-colors">Problem Title</span>
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-semibold mt-1 transition-colors">{fetchedCarData.problem_title}</p>
                    </div>
                    
                    <div>
                      <span className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-wider transition-colors">Root Cause Analysis</span>
                      <p className="text-sm text-slate-800 dark:text-slate-300 mt-1 transition-colors">{fetchedCarData.root_cause}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-wider transition-colors">Corrective Action Plan</span>
                      <p className="text-sm text-slate-800 dark:text-slate-300 mt-1 transition-colors">{fetchedCarData.action_plan}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-wider transition-colors">PIC</span>
                      <p className="text-sm text-slate-800 dark:text-slate-300 font-medium mt-1 transition-colors">{fetchedCarData.pic}</p>
                    </div>
                  </div>
                )}

                <div className="pt-6 mt-8 border-t border-slate-100 dark:border-slate-700 flex justify-end space-x-3 transition-colors">
                  <button type="button" onClick={() => setIsResolveModalOpen(false)} className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-slate-800 border rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSubmitResolution}
                    disabled={isSubmitting || !fetchedCarData} 
                    className="flex items-center px-5 py-2.5 text-sm font-bold text-white bg-brand-600 dark:bg-brand-500 rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isSubmitting ? 'Linking...' : <><Send size={18} className="mr-2"/> Confirm & Link Record</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default QuarterlyCarInboxPage;