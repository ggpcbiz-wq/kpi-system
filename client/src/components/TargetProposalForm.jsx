import { useState, useEffect } from 'react';
import { Target, Send, Building2, Briefcase, CalendarClock, Layers, SplitSquareHorizontal, BookOpen } from 'lucide-react';
import { useToast } from '../context/ToastContext'; 
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

const TargetProposalForm = ({ onSubmit, isSubmitting }) => {
  const { user, token } = useAuth();
  const { addToast } = useToast(); 

  const operators = ['', '≥', '≤', '>', '<', 'min', 'max'];
  const units = ['%', 'Pcs', 'Hrs', 'mins', '$', 'Days', 'Incidents'];

  const managerDepartments = user?.departments?.length > 0 
    ? user.departments 
    : (user?.department ? [user.department] : ['Department Not Set']);

  const [deptMappings, setDeptMappings] = useState([]);

  const [formData, setFormData] = useState({ 
    plant: user?.plant || 'Laguna Plant',
    department: managerDepartments[0], 
    section: '',
    frequency: 'Monthly',
    process_category: '',
    process_type: '',
    metric_name: '', // Retained internally to prevent systemic breaks
    objective: '',   // ✨ New Objective Field
    operator: '≥', 
    target_value: '',
    unit: '%'      
  });

  useEffect(() => {
    let isMounted = true;
    const fetchDeptMappings = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/departments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setDeptMappings(data);
          
          const initialDept = data.find(d => d.name === managerDepartments[0]);
          if (initialDept && initialDept.sections && initialDept.sections.length > 0) {
            setFormData(prev => ({ ...prev, section: initialDept.sections[0].name }));
          }
        }
      } catch (error) {
        console.error("Failed to load department mappings", error);
      }
    };
    if (token) fetchDeptMappings();
    return () => { isMounted = false; };
  }, [token]);

  const selectedDeptModel = deptMappings.find(d => d.name === formData.department);
  const availableSections = selectedDeptModel?.sections || [];
  
  const selectedSectionModel = availableSections.find(s => s.name === formData.section);
  const availableProcesses = selectedSectionModel?.processTypes || [];

  const handleDepartmentChange = (e) => {
    const newDeptName = e.target.value;
    const newDeptModel = deptMappings.find(d => d.name === newDeptName);
    const firstSection = newDeptModel?.sections?.[0]?.name || '';

    setFormData({
      ...formData, 
      department: newDeptName,
      section: firstSection,
      process_category: '',
      process_type: ''
    });
  };

  const handleSectionChange = (e) => {
    setFormData({
      ...formData,
      section: e.target.value,
      process_category: '',
      process_type: ''
    });
  };

  const handleProcessChange = (e) => {
    const val = e.target.value;
    if (val === '|') {
      setFormData({ ...formData, process_category: '', process_type: '' });
    } else {
      const [cat, type] = val.split('|');
      setFormData({ ...formData, process_category: cat, process_type: type });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.process_category || !formData.process_type) {
      addToast('Please select an ISO Process Type mapped to this Section.', 'error');
      return;
    }
    
    const finalData = {
      ...formData,
      formatted_target: `${formData.operator} ${formData.target_value} ${formData.unit}`
    };
    
    onSubmit(finalData);
    
    setFormData(prev => ({ 
      ...prev,
      process_category: '',
      process_type: '',
      metric_name: '', 
      objective: '',
      target_value: '' 
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* ROW 1: Context Setup */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Plant Location
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Building2 size={16} className="text-slate-400 dark:text-slate-500 transition-colors" />
            </div>
            <input 
              type="text" 
              readOnly
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed transition-colors"
              value={formData.plant}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Department <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Briefcase size={16} className={managerDepartments.length > 1 ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"} />
            </div>
            
            {managerDepartments.length > 1 ? (
              <select 
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 appearance-none cursor-pointer transition-colors shadow-sm"
                value={formData.department}
                onChange={handleDepartmentChange}
              >
                {managerDepartments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            ) : (
              <input 
                type="text" 
                readOnly
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed transition-colors"
                value={formData.department}
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Section <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <SplitSquareHorizontal size={16} className={availableSections.length > 0 ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"} />
            </div>
            <select 
              required
              disabled={availableSections.length === 0}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 appearance-none cursor-pointer transition-colors shadow-sm"
              value={formData.section}
              onChange={handleSectionChange}
            >
              {availableSections.length > 0 ? (
                availableSections.map(sec => (
                  <option key={sec.id} value={sec.name}>{sec.name} ({sec.segment})</option>
                ))
              ) : (
                <option value="">-- No Sections Found --</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* ROW 2: Analytical Dimensions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Data Collection Frequency <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <CalendarClock size={16} className="text-brand-600 dark:text-brand-400 transition-colors" />
            </div>
            <select 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 appearance-none cursor-pointer transition-colors shadow-sm"
              value={formData.frequency}
              onChange={(e) => setFormData({...formData, frequency: e.target.value})}
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Assigned Section Process Type <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Layers size={16} className={availableProcesses.length > 0 ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"} />
            </div>
            <select 
              required
              disabled={availableProcesses.length === 0}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900/50 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 disabled:text-slate-400 appearance-none cursor-pointer transition-colors shadow-sm"
              value={formData.process_category && formData.process_type ? `${formData.process_category}|${formData.process_type}` : '|'}
              onChange={handleProcessChange}
            >
              <option value="|" disabled>
                {availableProcesses.length > 0 ? '-- Select Mapped Process --' : '-- No Processes Mapped to Section --'}
              </option>
              {availableProcesses.map(p => (
                <option key={`${p.category}|${p.process_name}`} value={`${p.category}|${p.process_name}`}>
                  [{p.category}] {p.process_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ROW 3: Metric Thresholds */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            KPI <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Target size={16} className="text-slate-400 dark:text-slate-500 transition-colors" />
            </div>
            <input 
              type="text" 
              required 
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-white dark:bg-slate-900/50 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors shadow-sm"
              value={formData.metric_name}
              onChange={(e) => setFormData({...formData, metric_name: e.target.value})}
              placeholder="e.g., First Pass Yield"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
            Proposed Target Value <span className="text-rose-600 dark:text-rose-400">*</span>
          </label>
          <div className="flex border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900/50 focus-within:ring-2 focus-within:ring-brand-600 dark:focus-within:ring-brand-500 transition-colors shadow-sm overflow-hidden">
            <div className="border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <select
                className="pl-3.5 pr-4 py-2.5 bg-transparent text-sm font-black text-brand-600 dark:text-brand-400 focus:outline-none cursor-pointer appearance-none text-center"
                value={formData.operator}
                onChange={(e) => setFormData({...formData, operator: e.target.value})}
              >
                {operators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            <input 
              type="number" 
              step="any" 
              required 
              className="w-full px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none text-center placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors"
              value={formData.target_value}
              onChange={(e) => setFormData({...formData, target_value: e.target.value})}
              placeholder="e.g., 99.5"
            />
            
            <div className="border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center shrink-0 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <select
                className="pl-3.5 pr-4 py-2.5 bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer appearance-none text-center"
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
              >
                {units.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ✨ ROW 4: New Objective Field */}
      <div>
        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">
          Objective <span className="text-rose-600 dark:text-rose-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute top-3 left-0 pl-3.5 flex items-start pointer-events-none">
            <BookOpen size={16} className="text-slate-400 dark:text-slate-500 transition-colors" />
          </div>
          <textarea 
            required 
            rows={3}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-white dark:bg-slate-900/50 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition-colors shadow-sm resize-none"
            value={formData.objective}
            onChange={(e) => setFormData({...formData, objective: e.target.value})}
            placeholder="Describe the objective or goal associated with this KPI..."
          />
        </div>
      </div>
      
      <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-8 transition-colors">
        <button 
          type="submit" 
          disabled={isSubmitting || !formData.metric_name || !formData.objective || !formData.target_value || !formData.process_type || !formData.section}
          className="flex items-center bg-brand-600 dark:bg-brand-500 hover:bg-brand-700 dark:hover:bg-brand-600 text-white text-sm font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Routing...' : <><Send size={16} className="mr-2" /> Route for Approval</>}
        </button>
      </div>
    </form>
  );
};

export default TargetProposalForm;