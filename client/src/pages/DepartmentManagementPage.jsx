import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Building2, Edit, X, ShieldAlert, Layers, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

// Official ISO/QMS Process Taxonomy
const PROCESS_TAXONOMY = {
  MBO: [
    'Continual Improvement Management',
    'QMS Planning',
    'Performance Review',
    'Feedback Management',
    'Internal Audit'
  ],
  COP: [
    'Order Handling/Sales',
    'Production Planning',
    'Planning',
    'Inspection',
    'Material Control',
    'Product Quality Planning',
    'Product Safety Management',
    'Outsourced Process Management'
  ],
  SOP: [
    'Accounting Process',
    'Human Resources Management',
    'Documentation Management',
    'Infrastructure Management',
    'Control Of Inspection Monitoring & Test Equipment',
    'Mold Management',
    'Information Technology',
    'Workplace Safety & 5S Management'
  ]
};

const DepartmentManagementPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedProcessTypes, setSelectedProcessTypes] = useState([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch departments (triggers auto-sync from Kintone on backend)
  useEffect(() => {
    let isMounted = true;
    const fetchDepartments = async () => {
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/departments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load departments');
        const data = await res.json();
        if (isMounted) setDepartments(data);
      } catch (error) {
        console.error(error);
        if (isMounted) addToast('Failed to sync departments from Kintone.', 'error');
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchDepartments();
    return () => { isMounted = false; };
  }, [token, refreshTrigger, addToast]);

  const handleManualSync = () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleOpenConfigure = (dept) => {
    setSelectedDept(dept);
    setSelectedProcessTypes(dept.processTypes || []);
    setIsModalOpen(true);
  };

  const toggleProcessType = (category, processName) => {
    setSelectedProcessTypes(prev => {
      const exists = prev.some(p => p.category === category && p.process_name === processName);
      if (exists) {
        return prev.filter(p => !(p.category === category && p.process_name === processName));
      } else {
        return [...prev, { category, process_name: processName }];
      }
    });
  };

  const handleSubmitMappings = async (e) => {
    e.preventDefault();
    if (!selectedDept) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/departments/${selectedDept.id}/process-types`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ processTypes: selectedProcessTypes })
      });

      if (!res.ok) throw new Error('Failed to update process mappings');

      addToast(`Process mappings updated for ${selectedDept.name}.`, 'success');
      setIsModalOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error(error);
      addToast('Failed to save process mappings.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Enforce Administrator RBAC
  if (user?.role !== 'Administrator') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center p-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-center">
          <ShieldAlert size={48} className="text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Access Denied</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Only System Administrators can access Department Management.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Synchronizing Kintone Department Master...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="min-h-screen p-4 bg-slate-50 dark:bg-slate-900 md:p-8 font-sans transition-colors duration-300">
        <div className="max-w-[1600px] mx-auto space-y-8">
          
          {/* Header */}
          <div className="flex flex-col gap-4 pb-6 border-b md:flex-row md:items-end justify-between border-slate-200 dark:border-slate-800 transition-colors">
            <div>
              <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 uppercase transition-colors">
                DEPARTMENT PROCESS MAPPING
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">
                Map MBO, COP, and SOP process types to synchronized Kintone departments.
              </p>
            </div>
            <button 
              onClick={handleManualSync}
              disabled={isRefreshing}
              className="flex items-center px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Syncing...' : 'Sync Kintone Departments'}
            </button>
          </div>

          {/* Department Data Grid */}
          <div className="overflow-hidden bg-white dark:bg-slate-800 border rounded-xl shadow-sm border-slate-200 dark:border-slate-700 transition-colors duration-300">
            <div className="flex items-center px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">Synchronized Kintone Departments</h3>
              <span className="ml-4 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm text-slate-600 dark:text-slate-300 transition-colors">
                {departments.length} Departments
              </span>
            </div>
              
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 min-w-[900px]">
                <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                  <tr>
                    <th className="px-6 py-4 font-bold">Kintone Department Name</th>
                    <th className="px-6 py-4 font-bold">Plant Location</th>
                    <th className="px-6 py-4 font-bold">Assigned Process Types</th>
                    <th className="px-6 py-4 font-bold text-right">Configure</th>
                  </tr>
                </thead> 
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors">
                  {departments.map(dept => (
                    <tr key={dept.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{dept.name}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{dept.plant || '-'}</td>
                      <td className="px-6 py-4">
                        {dept.processTypes && dept.processTypes.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {dept.processTypes.map((pt, idx) => (
                              <span 
                                key={idx} 
                                className="px-2 py-0.5 text-[11px] font-bold bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 rounded-md"
                              >
                                [{pt.category}] {pt.process_name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic text-xs">No processes mapped yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleOpenConfigure(dept)} 
                          className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-slate-600 border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-lg transition-colors shadow-sm"
                        >
                          <Edit size={14} className="mr-1.5" /> Attach Processes
                        </button>
                      </td>
                    </tr>
                  ))}
                  {departments.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-800/30 font-medium">
                        No departments retrieved from Kintone. Check Kintone API connectivity.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal for Process Type Assignment */}
        {isModalOpen && selectedDept && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300 overflow-y-auto">
            <div className="w-full max-w-5xl my-8 overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
              <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 transition-colors">
                <div>
                  <h3 className="flex items-center text-lg font-bold text-slate-900 dark:text-slate-100">
                    <Building2 size={20} className="mr-2.5 text-brand-600 dark:text-brand-400"/>
                    Configure Process Types for: <span className="ml-2 text-brand-600 dark:text-brand-400 font-extrabold">{selectedDept.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Department name is immutable (managed in Kintone Master App).</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSubmitMappings} className="p-8 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {Object.entries(PROCESS_TAXONOMY).map(([category, processes]) => (
                    <div key={category} className="bg-slate-50 dark:bg-slate-900/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors">
                      <div className="flex items-center mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                        <Layers size={16} className="text-slate-400 dark:text-slate-500 mr-2" />
                        <h5 className="font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">{category} Processes</h5>
                      </div>
                      <div className="space-y-3">
                        {processes.map(processName => {
                          const isChecked = selectedProcessTypes.some(p => p.category === category && p.process_name === processName);
                          return (
                            <label key={processName} className="flex items-start space-x-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                className="w-4 h-4 mt-0.5 text-brand-600 dark:text-brand-500 border-slate-300 dark:border-slate-600 rounded focus:ring-brand-500 transition-colors cursor-pointer bg-white dark:bg-slate-800"
                                checked={isChecked}
                                onChange={() => toggleProcessType(category, processName)}
                              />
                              <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'}`}>
                                {processName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-6 mt-8 space-x-3 border-t border-slate-100 dark:border-slate-700 transition-colors">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-slate-800 border rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Mappings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DepartmentManagementPage;