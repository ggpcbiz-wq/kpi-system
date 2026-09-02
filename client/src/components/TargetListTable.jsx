import { MessageSquare, Layers, PlusCircle, AlertCircle, SplitSquareHorizontal } from 'lucide-react';

const TargetListTable = ({ targets, onSelectTarget }) => {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active':
        return 'bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border-jira-success/30 dark:border-jira-success/30';
      case 'Pending QMR Approval':
        return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50';
      case 'Pending Top Management Approval':
        return 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-800/50';
      case 'Pending Final Activation':
        return 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50';
      case 'Rejected':
        return 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col transition-colors duration-300">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center shrink-0 transition-colors">
        <div className="w-1.5 h-5 bg-brand-500 rounded-full mr-3"></div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Department KPI Targets</h3>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 table-fixed min-w-[1300px]">
          <thead className="text-xs uppercase bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 tracking-wider transition-colors">
            <tr>
              <th className="px-6 py-4 font-bold w-[14%]">Metric</th>
              <th className="px-6 py-4 font-bold w-[8%]">Category</th>
              <th className="px-6 py-4 font-bold w-[14%]">Process Type</th>
              <th className="px-6 py-4 font-bold w-[8%]">Freq</th>
              <th className="px-6 py-4 font-bold w-[12%]">
                <div className="flex items-center">
                  <Layers size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Dept
                </div>
              </th>
              <th className="px-6 py-4 font-bold w-[12%]">
                <div className="flex items-center">
                  <SplitSquareHorizontal size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Section
                </div>
              </th>
              <th className="px-6 py-4 font-bold w-[8%]">Target</th>
              <th className="px-6 py-4 font-bold w-[12%]">Status</th>
              <th className="px-6 py-4 font-bold w-[12%]">
                <div className="flex items-center">
                  <MessageSquare size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Remarks
                </div>
              </th>
              
              {onSelectTarget && (
                <th className="px-6 py-4 font-bold text-right w-[8%]">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
            {targets.map(target => {
              const isActive = target.status === 'Active';
              
              return (
                <tr key={target.id} className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50 ${target.isOverdue ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 truncate" title={target.metric_name}>
                    {target.metric_name}
                  </td>
                  
                  <td className="px-6 py-4">
                    {target.process_category ? (
                      <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-brand-50 dark:bg-slate-600 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 rounded-md">
                        {target.process_category}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-xs">--</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300 truncate" title={target.process_type}>
                    {target.process_type || <span className="text-slate-400 dark:text-slate-500 italic text-xs">Uncategorized</span>}
                  </td>
                  
                  <td className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    {target.frequency || 'Monthly'}
                  </td>

                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-semibold truncate" title={target.dept_name}>
                    {target.dept_name || <span className="text-slate-400 dark:text-slate-500 italic font-normal">Unassigned</span>}
                  </td>

                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-semibold truncate" title={target.section_name}>
                    {target.section_name || <span className="text-slate-400 dark:text-slate-500 italic font-normal">--</span>}
                  </td>
                  
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-black whitespace-nowrap">
                    {target.operator} {target.target_value} <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-0.5">{target.unit}</span>
                  </td>
                  
                  <td className="px-6 py-4 flex flex-col items-start gap-1.5">
                    <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${getStatusBadge(target.status)}`}>
                      {target.status}
                    </span>
                    {target.isOverdue && (
                      <span className="flex items-center text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/50 px-2 py-0.5 rounded shadow-sm transition-colors">
                        <AlertCircle size={12} className="mr-1" strokeWidth={2.5} /> No Data
                      </span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 max-w-xs">
                    {target.remarks ? (
                      <span className="text-slate-600 dark:text-slate-300 wrap-break-word text-xs block line-clamp-2 hover:line-clamp-none transition-all duration-200 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-md border border-slate-200 dark:border-slate-700 shadow-inner shadow-slate-100 dark:shadow-none" title={target.remarks}>
                        {target.remarks}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-xs">No remarks</span>
                    )}
                  </td>
                  
                  {onSelectTarget && (
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onSelectTarget(target)}
                        disabled={!isActive}
                        className={`flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-sm ${
                          isActive 
                            ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 hover:bg-brand-50 dark:hover:bg-brand-900/50 hover:border-brand-300 dark:hover:border-brand-700' 
                            : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700 shadow-none'
                        }`}
                        title={isActive ? "Enter Monthly Data" : "Target must be Active to enter data"}
                      >
                        <PlusCircle size={14} className="mr-1.5" /> Data
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
            
            {targets.length === 0 && (
              <tr>
                <td colSpan={onSelectTarget ? "10" : "9"} className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors">
                  No KPI targets proposed or registered for your departments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TargetListTable;