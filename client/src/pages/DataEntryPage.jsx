import { useState, useEffect } from 'react';
import MonthlyDataEntryForm from '../components/MonthlyDataEntryForm';
import { useAuth } from '../context/AuthContext';

const DataEntryPage = () => {
  const { user } = useAuth();
  const [activeTargets, setActiveTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Enforce the Business Rule: Fetch ONLY targets marked as 'Active' 
  useEffect(() => {
    const fetchActiveTargets = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 600)); // Mock network delay
        
        // Mock payload representing Active targets for DEPT-001
        setActiveTargets([
          { id: '1', metric_name: 'Production Yield', target_value: '95.5', status: 'Active' },
          { id: '3', metric_name: '100% On-time delivery', target_value: '100', status: 'Active' }
        ]);
      } catch (error) {
        console.error("Failed to fetch active targets", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActiveTargets();
  }, [user.departmentId]);

  const selectedTarget = activeTargets.find(t => t.id === selectedTargetId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-jira-bg">
        <p className="text-jira-text-muted font-medium animate-pulse">Loading active KPI targets...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-jira-bg">
      {/* MAXIMIZED CONTAINER WIDTH */}
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="border-b border-jira-border pb-4">
          <h1 className="text-2xl font-bold text-jira-text">Monthly Data Entry</h1>
          <p className="text-sm text-jira-text-muted mt-1">
            Select an active KPI target to log current month performance.
          </p>
        </div>

        {/* Target Selector Dropdown */}
        <div className="bg-white p-6 rounded-lg border border-jira-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-2xl">
            <label className="block text-sm font-semibold text-jira-text mb-2">Select KPI Metric</label>
            <select 
              className="w-full px-4 py-2.5 border border-jira-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50 text-jira-text font-medium"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
            >
              <option value="">-- Choose an Active Target --</option>
              {activeTargets.map(target => (
                <option key={target.id} value={target.id}>
                  {target.metric_name} (Target: {target.target_value})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Render the Form only if a target is selected */}
        {selectedTarget ? (
          <MonthlyDataEntryForm activeTarget={selectedTarget} />
        ) : (
          <div className="text-center p-16 border-2 border-dashed border-jira-border rounded-lg bg-slate-50">
            <p className="text-jira-text-muted font-medium text-lg">Please select a KPI metric from the dropdown above to begin data entry.</p>
          </div>
        )}
        
      </div>
    </div>
  );
};

export default DataEntryPage;