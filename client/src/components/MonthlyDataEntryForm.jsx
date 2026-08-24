import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext'; 
import { FileSpreadsheet, Send, Info, Paperclip, X } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

const months = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' }
];

const MonthlyDataEntryForm = ({ activeTarget, onSuccess, onCancel }) => {
  const { user, token } = useAuth(); 
  const { addToast } = useToast(); 
  const fileInputRef = useRef(null);
  
  const currentMonth = new Date().getMonth(); 
  const defaultMonth = currentMonth === 0 ? 12 : currentMonth; 
  const defaultYear = currentMonth === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();

  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [reportYear, setReportYear] = useState(defaultYear);
  const [actualValue, setActualValue] = useState('');
  const [remarks, setRemarks] = useState(''); 
  const [attachment, setAttachment] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);


  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      addToast("File exceeds the 20MB limit.", "error");
      e.target.value = null;
      return;
    }
    setAttachment(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);


    const formData = new FormData();
    formData.append('target_id', activeTarget.id);
    formData.append('submitted_by', user.id);
    formData.append('actual_value', parseFloat(actualValue));
    formData.append('report_month', parseInt(reportMonth, 10));
    formData.append('report_year', parseInt(reportYear, 10));
    formData.append('remarks', remarks.trim());
    
    if (attachment) {
      formData.append('attachment', attachment);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Do NOT set Content-Type to application/json when sending FormData; the browser handles it automatically!
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      addToast("Monthly data and attachment submitted successfully.", "success");
      setActualValue('');
      setRemarks(''); 
      setAttachment(null);
      
      if (onSuccess) onSuccess(); 
      
    } catch (error) {
      console.error("Submission failed", error);
      addToast("Failed to submit data. Please try again.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeTarget) return null;

  const selectedMonthLabel = months.find(m => m.value === parseInt(reportMonth))?.label;

  return (
    <div className="bg-white rounded-lg border border-jira-border shadow-sm w-full max-h-[90vh] overflow-y-auto">
      <div className="px-6 py-4 border-b border-jira-border bg-jira-bg flex justify-between items-center sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-semibold text-jira-text">Monthly Data Entry</h2>
          <p className="text-sm text-jira-text-muted">
            Period: {selectedMonthLabel} {reportYear} | Preparer: {user.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-jira-text-muted">Metric</p>
          <p className="text-lg font-bold text-brand-600">{activeTarget.metric_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div className="bg-brand-50 border border-brand-200 text-brand-700 px-4 py-3 rounded-md flex items-start">
          <Info size={20} className="mr-3 shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>Note:</strong> Performance is evaluated strictly on a quarterly basis. Attach supporting evidence below for faster QMR approval.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2 border-b border-slate-100">
          <div>
            <label className="block text-sm font-bold text-jira-text mb-2">Report Month</label>
            <select required className="w-full px-3 py-2 border border-jira-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-jira-text mb-2">Report Year</label>
            <input type="number" required className="w-full px-3 py-2 border border-jira-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50" value={reportYear} onChange={(e) => setReportYear(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 p-6 rounded-md border border-slate-200 flex flex-col justify-center items-center text-center">
            <label className="block text-sm font-bold text-jira-text-muted uppercase tracking-wide mb-2">Target</label>
            <div className="text-4xl font-light text-slate-500">
               {activeTarget.operator} {activeTarget.target_value} <span className="text-2xl">{activeTarget.unit}</span>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <label className="block text-sm font-bold text-jira-text mb-2">Actual Value Achieved</label>
            <input type="number" step="any" required className="w-full text-3xl px-4 py-4 bg-white border-2 border-jira-border focus:border-brand-500 rounded-md transition-colors focus:outline-none" value={actualValue} onChange={(e) => setActualValue(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="block text-sm font-bold text-jira-text mb-2">Explanation <span className="text-red-500">*</span></label>
          <textarea required className="w-full px-3 py-3 border border-jira-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white resize-none text-sm" rows="3" placeholder="Provide context or explanation regarding this month's performance..." value={remarks} onChange={(e) => setRemarks(e.target.value)}></textarea>
        </div>
        <div className="flex flex-col p-4 bg-slate-50 border border-slate-200 rounded-md">
          <label className="block text-sm font-bold text-jira-text mb-2">Supporting Evidence (Optional)</label>
          
          <input 
            type="file" 
            ref={fileInputRef}
            className="hidden" 
            accept=".pdf,.xls,.xlsx,image/png,image/jpeg,image/jpg"
            onChange={handleFileChange} 
          />
          
          {!attachment ? (
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-slate-300 rounded-md text-slate-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-colors">
              <Paperclip size={18} className="mr-2" /> Click to attach a file (PDF, Excel, Images up to 20MB)
            </button>
          ) : (
            <div className="flex items-center justify-between bg-white border border-slate-200 px-4 py-3 rounded-md">
              <div className="flex items-center truncate">
                <FileSpreadsheet size={18} className="text-brand-500 mr-2 shrink-0" />
                <span className="text-sm font-medium text-slate-700 truncate">{attachment.name}</span>
                <span className="text-xs text-slate-400 ml-2">({(attachment.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button type="button" onClick={() => setAttachment(null)} className="text-slate-400 hover:text-red-500 p-1">
                <X size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-jira-border flex justify-end space-x-3">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={isSubmitting} className="px-6 py-3 border border-jira-border text-jira-text font-medium rounded-md hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          )}
          <button type="submit" disabled={isSubmitting || actualValue === '' || remarks.trim() === ''} className="flex items-center bg-brand-500 hover:bg-brand-600 text-white font-semibold py-3 px-8 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'Uploading Data...' : <><Send size={18} className="mr-2" /> Submit to Manager</>}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MonthlyDataEntryForm;