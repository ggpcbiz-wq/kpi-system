import { Info, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';

const FinalizedSubmissionsTable = ({
  rows = [],
  emptyText = 'No finalized submissions available.',
  showPagination = false,
  currentPage = 1,
  itemsPerPage = 5,
  totalRows = rows.length,
  onPageChange,
  getMonthName,
  checkIsMissed,
}) => {
  const totalPages = showPagination ? Math.max(1, Math.ceil(totalRows / itemsPerPage)) : 1;
  const startIndex = showPagination ? (currentPage - 1) * itemsPerPage : 0;
  const visibleRows = showPagination ? rows.slice(startIndex, startIndex + itemsPerPage) : rows;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden mb-8 transition-colors duration-300">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0 transition-colors">
        <div className="flex items-center">
          <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Company-Wide Finalized Submissions
          </h3>
        </div>
        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-md text-xs font-bold border border-slate-200 dark:border-slate-600 uppercase tracking-wide transition-colors">
          Global Visibility
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300 min-w-[1000px]">
          <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
            <tr>
              <th className="px-6 py-4 font-bold">Department</th>
              <th className="px-6 py-4 font-bold">Metric (Month)</th>
              <th className="px-6 py-4 font-bold">Target vs Actual</th>
              <th className="px-6 py-4 font-bold">
                <div className="flex items-center">
                  <Info size={14} className="mr-1.5 text-slate-400 dark:text-slate-500" /> Explanation History
                </div>
              </th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold text-right">CPAR Link</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800 transition-colors">
            {visibleRows.map((data) => {
              const isMissed = checkIsMissed(data.actual_value, data.target_value, data.operator);
              const monthName = getMonthName(data.report_month);

              return (
                <tr key={data.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100">{data.dept_name}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-200">
                    {data.metric_name}{' '}
                    <span className="font-medium text-slate-500 dark:text-slate-400 text-xs">({monthName})</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {data.operator} {data.target_value}
                    </span>{' '}
                    /{' '}
                    <strong className={isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-jira-success dark:text-jira-success/90'}>
                      {data.actual_value}
                    </strong>{' '}
                    <span className="text-xs ml-0.5 text-slate-400 dark:text-slate-500">{data.unit}</span>
                  </td>

                  <td className="px-6 py-4 min-w-[250px] max-w-[400px]">
                    {data.remarks ? (
                      <div className="text-slate-600 dark:text-slate-300 text-xs bg-slate-50 dark:bg-slate-900/50 p-3 rounded-md border border-slate-200 dark:border-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner shadow-slate-100 dark:shadow-none transition-colors">
                        {data.remarks}
                      </div>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 italic text-xs block">
                        No explanation history
                      </span>
                    )}

                    {data.supporting_data && (
                      <a
                        href={data.supporting_data.replace(/^"|"$/g, '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center mt-2.5 text-[10px] font-bold text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-slate-600 px-2.5 py-1.5 rounded border border-brand-200 dark:border-brand-800/50 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors shadow-sm"
                        title="View Supporting Evidence"
                      >
                        <FileSpreadsheet size={12} className="mr-1.5" />
                        View Attachment
                      </a>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    {isMissed ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 whitespace-nowrap shadow-sm transition-colors">
                        Missed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border border-jira-success/30 dark:border-jira-success/30 whitespace-nowrap shadow-sm transition-colors">
                        Achieved
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      {data.kintone_car_id ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800/50 whitespace-nowrap shadow-sm transition-colors" title="Linked Kintone Record">
                          {data.kintone_car_id}
                        </span>
                      ) : data.status === 'CAR Requested' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 whitespace-nowrap shadow-sm transition-colors">
                          CAR Pending
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium text-[11px] italic pr-2">N/A</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan="6"
                  className="px-6 py-16 text-center text-slate-500 dark:text-slate-400 font-medium bg-slate-50/30 dark:bg-slate-800/30 transition-colors"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showPagination && totalRows > 0 && (
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
          <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Showing{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {startIndex + 1}
            </span>{' '}
            to{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {Math.min(startIndex + itemsPerPage, totalRows)}
            </span>{' '}
            of{' '}
            <span className="font-bold text-slate-700 dark:text-slate-200">{totalRows}</span> entries
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Per Page:
              </span>
              <select
                className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 outline-none shadow-sm cursor-pointer transition-colors"
                value={itemsPerPage}
                onChange={(e) => onPageChange?.(1, Number(e.target.value))}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1 transition-colors"></div>

            <div className="flex items-center space-x-2">
              <button
                disabled={currentPage === 1}
                onClick={() => onPageChange?.(currentPage - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft size={16} strokeWidth={2.5} />
              </button>

              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 px-2">
                {currentPage} <span className="text-slate-400 dark:text-slate-500 font-medium mx-1">/</span> {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages || totalPages === 0}
                onClick={() => onPageChange?.(currentPage + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next Page"
              >
                <ChevronRight size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalizedSubmissionsTable;