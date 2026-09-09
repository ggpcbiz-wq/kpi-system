import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Printer, Download, History, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import * as XLSX from 'xlsx';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentYear = new Date().getFullYear();
const historicalYears = Array.from({ length: 5 }, (_, i) => currentYear - 5 + i);

const checkIsMissed = (actual, target, operator) => {
  const act = parseFloat(actual);
  const tgt = parseFloat(target);
  const op = String(operator).trim();

  if (op === '≤' || op === '<=' || op === '‚â§') return act > tgt;
  if (op === '<') return act >= tgt;
  if (op === '=' || op === '==') return act !== tgt;
  if (op === '≥' || op === '>=' || op === '‚â•') return act < tgt;
  if (op === '>') return act <= tgt;
  return act < tgt; 
};

const AnnualObjectivesPage = () => {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [targets, setTargets] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [showHistorical, setShowHistorical] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchReportData = async () => {
      try {
        const timestamp = new Date().getTime();
        const [targetRes, subRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/targets?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API_BASE_URL}/api/submissions?_t=${timestamp}`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (targetRes.ok && subRes.ok && isMounted) {
          const rawTargets = await targetRes.json();
          const rawSubs = await subRes.json();
          
          setTargets(rawTargets.filter(t => t.status === 'Active'));
          setSubmissions(rawSubs.filter(s => s.status === 'Approved' || s.status === 'CAR Requested'));
        }
      } catch (error) {
        console.error("Report Fetch Error:", error);
        if (isMounted) addToast("Failed to load annual report data", "error");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (token) fetchReportData();
    return () => { isMounted = false; };
  }, [token, addToast]);

  const reportData = useMemo(() => {
    const cumulativeUnits = ['$', '₱', 'Php', 'Count', 'count', 'Days', 'days', 'pcs'];

    const merged = targets.map((target) => {
      const isCumulative = cumulativeUnits.includes(target.unit?.trim());
      const currentSubs = submissions.filter(s => s.target_id === target.id && s.report_year === currentYear);
      
      const monthlyData = {};
      let ytdSum = 0, ytdCount = 0;
      
      currentSubs.forEach(sub => {
        monthlyData[sub.report_month] = sub.actual_value;
        ytdSum += parseFloat(sub.actual_value) || 0;
        ytdCount++;
      });
      
      const ytdActual = ytdCount > 0 
        ? (isCumulative ? ytdSum : (ytdSum / ytdCount)).toFixed(2) 
        : '-';

      const history = {};
      let lastYearActual = '-';
      
      historicalYears.forEach(year => {
        const hSubs = submissions.filter(s => s.target_id === target.id && s.report_year === year);
        const hYtd = hSubs.length > 0 
          ? (hSubs.reduce((acc, s) => acc + parseFloat(s.actual_value || 0), 0) / (isCumulative ? 1 : hSubs.length)).toFixed(2) 
          : '-';
        history[year] = hYtd;
        if (year === currentYear - 1) lastYearActual = hYtd;
      });

      let achievedLastYear = null;
      if (lastYearActual !== '-') {
        achievedLastYear = !checkIsMissed(lastYearActual, target.target_value, target.operator) ? 'Y' : 'N';
      }

      return {
        ...target,
        ytdActual,
        monthlyData,
        history,
        achievedLastYear,
        dept_section_key: `${target.dept_name || ''}|${target.section_name || ''}`
      };
    });

    merged.sort((a, b) => {
      const deptA = a.dept_name || '';
      const deptB = b.dept_name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);

      const secA = a.section_name || '';
      const secB = b.section_name || '';
      if (secA !== secB) return secA.localeCompare(secB);

      const catA = a.process_category || '';
      const catB = b.process_category || '';
      if (catA !== catB) return catA.localeCompare(catB);
      
      return (a.process_type || '').localeCompare(b.process_type || '');
    });

    for (let i = 0; i < merged.length; i++) {
      merged[i].rowSpan = { process_category: 1, process_type: 1, dept_section_key: 1 };
      ['process_category', 'process_type', 'dept_section_key'].forEach(field => {
        if (!merged[i][field]) return; 
        if (i > 0 && merged[i][field] === merged[i - 1][field]) {
          merged[i].rowSpan[field] = 0;
          let originIndex = i - 1;
          while (originIndex > 0 && merged[originIndex].rowSpan[field] === 0) originIndex--;
          merged[originIndex].rowSpan[field]++;
        }
      });
    }

    return merged;
  }, [targets, submissions]);

  const handleExportExcel = () => {
    try {
      if (reportData.length === 0) return addToast("No data available to export.", "info");

      const excelData = reportData.map(row => {
        const deptSectionDisplay = row.section_name 
          ? `${row.dept_name} / ${row.section_name}` 
          : (row.dept_name || '-');

        const rowData = {
          'QMS Process Category': row.process_category || 'Uncategorized',
          'Process Type': row.process_type || '-',
          'Department / Section': deptSectionDisplay,
          'Objectives': row.objective || '-',
          'KPI': row.metric_name,
        };

        if (showHistorical) {
          historicalYears.forEach(year => {
            rowData[`Target (${year})`] = `${row.operator || ''} ${row.target_value || ''} ${row.unit || ''}`.trim();
            const hVal = row.history[year];
            rowData[`Actual (${year})`] = hVal !== '-' ? `${hVal} ${row.unit}`.trim() : '-';
          });
          rowData['Achieved? (Prev Year)'] = row.achievedLastYear || '-';
        }

        rowData[`Target (${currentYear})`] = `${row.operator || ''} ${row.target_value || ''} ${row.unit || ''}`.trim();
        rowData[`Actual (${currentYear})`] = row.ytdActual !== '-' ? `${row.ytdActual} ${row.unit}`.trim() : '-';
        rowData['Process Owner'] = row.proposer_name || '-';

        months.forEach((month, index) => {
          const val = row.monthlyData[index + 1];
          rowData[month] = val ? `${val} ${row.unit === '%' ? '%' : ''}`.trim() : '-';
        });

        return rowData;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Objectives ${currentYear}`);
      XLSX.writeFile(workbook, `GKG_Annual_Objectives_${currentYear}.xlsx`);
      addToast("Excel export generated successfully.", "success");
    } catch (error) {
      console.error("Excel Export Error:", error);
      addToast("Failed to generate Excel file.", "error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Loading Annual Objectives...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 relative font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <div className="w-full space-y-8 transition-all duration-500">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors duration-300">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 uppercase">
              ANNUAL OBJECTIVES & TARGETS
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
              Comprehensive organizational matrix for FY {currentYear}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0 print:hidden">
            <button 
              onClick={() => setShowHistorical(!showHistorical)} 
              className={`flex items-center px-4 py-2 text-sm font-bold border rounded-lg shadow-sm transition-colors ${showHistorical ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              {showHistorical ? <EyeOff size={16} className="mr-2" /> : <History size={16} className="mr-2" />} 
              {showHistorical ? 'Hide History' : 'Show History (5 Yrs)'}
            </button>
            <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-colors">
              <Printer size={16} className="mr-2" /> Print
            </button>
            <button onClick={handleExportExcel} className="flex items-center px-4 py-2 bg-jira-success hover:bg-jira-success/90 text-white text-sm font-bold rounded-lg shadow-sm transition-colors">
              <Download size={16} className="mr-2" /> Export Excel
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center border-collapse text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 font-bold text-slate-700 dark:text-slate-200 transition-colors">
                <tr>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 w-16 uppercase tracking-wider" rowSpan={2}>Type</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 min-w-[150px] uppercase tracking-wider" rowSpan={2}>QMS Process</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 min-w-[150px] uppercase tracking-wider" rowSpan={2}>Department / Section</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 min-w-[250px] uppercase tracking-wider" rowSpan={2}>Objectives</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 min-w-[150px] uppercase tracking-wider" rowSpan={2}>KPI</th>
                  
                  {showHistorical && historicalYears.map(year => (
                    <th key={`h-${year}`} className="border border-slate-200 dark:border-slate-700 p-2" colSpan={2}>{year}</th>
                  ))}
                  {showHistorical && (
                    <th className="border border-slate-200 dark:border-slate-700 p-2 w-20 text-[10px] uppercase leading-tight" rowSpan={2}>Achieved?</th>
                  )}

                  <th className="border border-slate-200 dark:border-slate-700 p-2" colSpan={2}>{currentYear}</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-3 min-w-[120px] uppercase tracking-wider" rowSpan={2}>Process Owner</th>
                  {months.map(m => (
                    <th key={m} className="border border-slate-200 dark:border-slate-700 p-3 w-16 uppercase tracking-wider" rowSpan={2}>{m}</th>
                  ))}
                </tr>
                <tr>
                  {showHistorical && historicalYears.map(year => (
                    <Fragment key={`sub-${year}`}>
                      <th className="border border-slate-200 dark:border-slate-700 p-2 min-w-[80px] text-xs">Target</th>
                      <th className="border border-slate-200 dark:border-slate-700 p-2 min-w-[80px] text-xs">Actual Result</th>
                    </Fragment>
                  ))}
                  
                  <th className="border border-slate-200 dark:border-slate-700 p-2 min-w-[80px] bg-emerald-50/50 dark:bg-emerald-900/10 text-xs text-emerald-700 dark:text-emerald-400">Target</th>
                  <th className="border border-slate-200 dark:border-slate-700 p-2 min-w-[80px] bg-rose-50/50 dark:bg-rose-900/10 text-xs text-rose-700 dark:text-rose-400">Actual Result</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-700/50">
                {reportData.map((row) => {
                  const targetDisplay = `${row.operator} ${row.target_value}${row.unit}`;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/50 transition-colors">
                      {row.rowSpan.process_category > 0 && (
                        <td className="border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/80" rowSpan={row.rowSpan.process_category}>
                          <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{row.process_category || '-'}</span>
                        </td>
                      )}
                      
                      {row.rowSpan.process_type > 0 && (
                        <td className="border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/80 text-left font-medium" rowSpan={row.rowSpan.process_type}>
                          {row.process_type || '-'}
                        </td>
                      )}
                      
                      {row.rowSpan.dept_section_key > 0 && (
                        <td className="border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/80 text-left" rowSpan={row.rowSpan.dept_section_key}>
                          {row.section_name ? (
                            <>
                              <span className="block font-bold text-slate-800 dark:text-slate-200">{row.dept_name}</span>
                              <span className="block text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase mt-1 tracking-wider">{row.section_name}</span>
                            </>
                          ) : (
                            <span className="block font-bold text-brand-600 dark:text-brand-400">{row.dept_name || '-'}</span>
                          )}
                        </td>
                      )}

                      <td className="border border-slate-200 dark:border-slate-700 p-3 text-left">{row.objective || '-'}</td>
                      <td className="border border-slate-200 dark:border-slate-700 p-3 text-left font-bold text-slate-900 dark:text-slate-100">{row.metric_name}</td>
                      
                      {showHistorical && historicalYears.map(year => {
                        const hVal = row.history[year];
                        const isMissed = hVal !== '-' ? checkIsMissed(hVal, row.target_value, row.operator) : false;
                        return (
                          <Fragment key={`td-${year}`}>
                            <td className="border border-slate-200 dark:border-slate-700 p-2 font-medium">{targetDisplay}</td>
                            <td className={`border border-slate-200 dark:border-slate-700 p-2 font-bold ${isMissed ? 'text-rose-600 dark:text-rose-400' : (hVal !== '-' ? 'text-emerald-600 dark:text-emerald-400' : '')}`}>
                              {hVal !== '-' ? `${hVal}${row.unit}` : '-'}
                            </td>
                          </Fragment>
                        );
                      })}

                      {showHistorical && (
                        <td className={`border border-slate-200 dark:border-slate-700 p-2 font-black text-sm ${row.achievedLastYear === 'Y' ? 'text-emerald-600 dark:text-emerald-400' : (row.achievedLastYear === 'N' ? 'text-rose-600 dark:text-rose-400' : '')}`}>
                          {row.achievedLastYear || '-'}
                        </td>
                      )}

                      <td className="border border-slate-200 dark:border-slate-700 p-3 font-bold bg-emerald-50/50 dark:bg-emerald-900/10 text-emerald-800 dark:text-emerald-300">
                        {targetDisplay}
                      </td>
                      
                      <td className="border border-slate-200 dark:border-slate-700 p-3 font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-900/10">
                        {row.ytdActual !== '-' ? `${row.ytdActual}${row.unit}` : '-'}
                      </td>
                      
                      <td className="border border-slate-200 dark:border-slate-700 p-3 text-[10px] leading-tight text-left font-medium">{row.proposer_name || '-'}</td>

                      {months.map((m, i) => {
                        const monthValue = row.monthlyData[i + 1];
                        const isMissing = !monthValue && i < new Date().getMonth();
                        return (
                          <td key={m} className={`border border-slate-200 dark:border-slate-700 p-2 ${monthValue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
                            {monthValue ? `${monthValue}${row.unit === '%' ? '%' : ''}` : (isMissing ? 'No data' : '')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={showHistorical ? 20 + (historicalYears.length * 2) + 1 : 20} className="border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400 italic bg-slate-50/30 dark:bg-slate-800/30">
                      No approved targets available for the current reporting year.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualObjectivesPage;