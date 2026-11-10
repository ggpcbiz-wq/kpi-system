import { useState } from 'react';
import { MessageSquare, PlusCircle, SplitSquareHorizontal, ChevronLeft, ChevronRight, Factory } from 'lucide-react';
import { usePlant } from '../context/usePlant';
import TargetYearFilter from './TargetYearFilter';

const TargetListTable = ({ targets, onSelectTarget }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [prevTargets, setPrevTargets] = useState(targets);
  const [selectedYear, setSelectedYear] = useState('All Years');
  const { selectedPlant } = usePlant();
  const ITEMS_PER_PAGE = 10;

  if (targets !== prevTargets) {
    setPrevTargets(targets);
    setCurrentPage(1);
  }

  const years = [...new Set(targets.map(target => Number(target.target_year)).filter(Number.isInteger))]
    .sort((a, b) => b - a);
  const filteredTargets = selectedYear === 'All Years'
    ? targets
    : targets.filter(target => Number(target.target_year) === Number(selectedYear));

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredTargets.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTargets = filteredTargets.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePrev = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active': return 'bg-jira-success-bg text-jira-success border-jira-success/30';
      case 'Pending QMR Approval': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Pending Top Management Approval': return 'bg-brand-50 text-brand-600 border-brand-200';
      case 'Pending Final Activation': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'Rejected': return 'bg-rose-50 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center">
          <div className="w-1.5 h-5 bg-brand-500 rounded-full mr-3"></div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {selectedPlant === 'All Plants' ? 'Company-Wide KPI Targets' : `${selectedPlant} Targets`}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <TargetYearFilter years={years} value={selectedYear} onChange={handleYearChange} />
          <div className="text-xs font-medium text-slate-500">
            Showing {filteredTargets.length > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredTargets.length)} of {filteredTargets.length}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 table-auto min-w-[1450px]">
          <thead className="text-xs uppercase bg-white dark:bg-slate-800 text-slate-500 border-b border-slate-200 tracking-wider">
            <tr>
              {selectedPlant === 'All Plants' && (
                <th className="px-4 py-4 font-bold min-w-[8rem]">
                  <div className="flex items-center"><Factory size={14} className="mr-1.5 shrink-0 text-slate-400" /> Plant</div>
                </th>
              )}
              <th className="px-4 py-4 font-bold min-w-[6rem]">Year</th>
              <th className="px-4 py-4 font-bold min-w-[10rem]"><div className="flex items-center"><SplitSquareHorizontal size={14} className="mr-1.5 shrink-0 text-slate-400" /> Section</div></th>
              <th className="px-4 py-4 font-bold min-w-[14rem]">KPI</th>
              <th className="px-4 py-4 font-bold min-w-[18rem]">Objective</th>
              <th className="px-4 py-4 font-bold min-w-[12rem]">Process Type</th>
              <th className="px-4 py-4 font-bold min-w-[9rem]">Target</th>
              <th className="px-4 py-4 font-bold min-w-[11rem]">Status</th>
              <th className="px-4 py-4 font-bold min-w-[16rem]"><div className="flex items-center"><MessageSquare size={14} className="mr-1.5 shrink-0 text-slate-400" /> Remarks</div></th>
              {onSelectTarget && <th className="px-4 py-4 font-bold text-right min-w-[10rem]">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {paginatedTargets.map(target => {
              const isActive = target.status === 'Active';
              const isDataEntryDisabled = !isActive || target.hasSubmittedCurrentPeriod || target.isSubmissionLocked;
              const actionLabel = target.isSubmissionLocked
                ? 'Locked'
                : target.hasRejectedCurrentPeriod ? 'Resubmit' : target.hasSubmittedCurrentPeriod ? 'Submitted' : 'Data';
              return (
                <tr key={target.id} className="align-top hover:bg-slate-50/80">
                  {selectedPlant === 'All Plants' && (
                    <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200 min-w-[8rem] break-words">{target.plant}</td>
                  )}
                  <td className="px-4 py-4 font-semibold min-w-[6rem]">{target.target_year || '--'}</td>
                  <td className="px-4 py-4 font-semibold min-w-[10rem] break-words">{target.section_name || '--'}</td>
                  <td className="px-4 py-4 font-bold text-slate-900 min-w-[14rem] break-words">{target.metric_name}</td>
                  <td className="px-4 py-4 min-w-[18rem] max-w-[24rem] text-[13px] leading-5 whitespace-pre-wrap break-words">{target.objective || '--'}</td>
                  <td className="px-4 py-4 font-medium min-w-[12rem] break-words">{target.process_type || 'Uncategorized'}</td>
                  <td className="px-4 py-4 font-black whitespace-nowrap min-w-[9rem]">{target.operator} {target.target_value} <span className="text-xs font-bold text-slate-500 ml-0.5">{target.unit}</span></td>
                  <td className="px-4 py-4 min-w-[11rem]">
                    <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold border whitespace-normal break-words ${getStatusBadge(target.status)}`}>{target.status}</span>
                  </td>
                  <td className="px-4 py-4 min-w-[16rem] max-w-[24rem] text-[13px] leading-5 whitespace-pre-wrap break-words">{target.remarks || <span className="text-slate-400 italic">No remarks</span>}</td>
                  {onSelectTarget && (
                    <td className="px-4 py-4 text-right min-w-[10rem]">
                      <button 
                        onClick={() => onSelectTarget(target)}
                        disabled={isDataEntryDisabled}
                        title={target.isSubmissionLocked
                          ? 'Monthly submissions are locked for this section and reporting period.'
                          : target.hasRejectedCurrentPeriod
                          ? 'Your previous submission was rejected. Submit corrected data.'
                          : target.hasSubmittedCurrentPeriod ? 'You have already submitted data for this reporting month.' : undefined}
                        className={`flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-bold shadow-sm whitespace-nowrap ${isDataEntryDisabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed border border-slate-200' : 'bg-white text-brand-600 border border-brand-200 hover:bg-brand-50'}`}
                      >
                        <PlusCircle size={14} className="mr-1.5" /> {actionLabel}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
            {filteredTargets.length === 0 && (
              <tr><td colSpan={8 + (selectedPlant === 'All Plants' ? 1 : 0) + (onSelectTarget ? 1 : 0)} className="px-6 py-16 text-center text-slate-500 font-medium">No KPI targets found for this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      
      {filteredTargets.length > ITEMS_PER_PAGE && (
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs font-medium text-slate-500">Page {currentPage} of {totalPages}</div>
          <div className="flex items-center space-x-2">
            <button onClick={handlePrev} disabled={currentPage === 1} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16} /></button>
            <button onClick={handleNext} disabled={currentPage === totalPages} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetListTable;