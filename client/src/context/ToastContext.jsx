/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react'; // Assuming you are using lucide-react for icons

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);

  const addToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    
    // Automatically hide the toast after 3 seconds
    setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  const clearToast = () => setToast(null);

  // Dynamic colors based on toast type
  const getToastStyles = (type) => {
    switch (type) {
      case 'success': return 'bg-jira-success-bg text-jira-success border-jira-success';
      case 'error': return 'bg-jira-danger-bg text-jira-danger border-jira-danger';
      case 'warning': return 'bg-jira-pending-bg text-jira-pending border-jira-pending';
      default: return 'bg-brand-50 text-brand-700 border-brand-200';
    }
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      
      {/* --- GLOBAL TOAST UI --- */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className={`flex items-center p-4 border rounded-md shadow-lg ${getToastStyles(toast.type)}`}>
            <p className="mr-6 text-sm font-semibold">{toast.message}</p>
            <button 
              onClick={clearToast} 
              className="p-1 transition-colors rounded opacity-70 hover:opacity-100 hover:bg-black/5"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);