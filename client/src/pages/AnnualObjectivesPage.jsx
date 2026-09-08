import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {  Printer, Download, History, EyeOff } from 'lucide-react';
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
  const [showHistorical, setShowHistorical] = useState(false); // ✨ NEW: Toggle State

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
    const merged = targets.map((target, index) => {
      // Current Year Processing
      const currentSubs = submissions.filter(s => s.target_id === target.id && s.report_year === currentYear);
      const monthlyData = {};
      let ytdSum = 0, ytdCount = 0;
      currentSubs.forEach(sub => {
        monthlyData[sub.report_month] = sub.actual_value;
        ytdSum += parseFloat(sub.actual_value) || 0;
        ytdCount++;
      });
      const ytdActual = ytdCount > 0 ? (ytdSum / ytdCount).toFixed(2) : '-';

      // ✨ NEW: Historical Processing
      const history = {};
      let lastYearActual = '-';
      historicalYears.forEach(year => {
        const hSubs = submissions.filter(s => s.target_id === target.id && s.report_year === year);
        const hYtd = hSubs.length > 0 
          ? (hSubs.reduce((acc, s) => acc + parseFloat(s.actual_value || 0), 0) / hSubs.length).toFixed(2) 
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
        displayIndex: index + 1,
        ytdActual,
        monthlyData,
        history,
        achievedLastYear
      };
    });

    merged.sort((a, b) => {
      const deptA = a.dept_name || '';
      const deptB = b.dept_name || '';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      const catA = a.process_category || '';
      const catB = b.process_category || '';
      if (catA !== catB) return catA.localeCompare(catB);
      return (a.process_type || '').localeCompare(b.process_type || '');
    });

    for (let i = 0; i < merged.length; i++) {
      merged[i].rowSpan = { process_category: 1, process_type: 1, dept_name: 1 };
      ['process_category', 'process_type', 'dept_name'].forEach(field => {
        if (merged[i][field] === null) return; 
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
        const rowData = {
          'No.': row.displayIndex,
          'QMS Process Category': row.process_category || 'Uncategorized',
          'Process Type': row.process_type || '-',
          'Department': row.dept_name || '-',
          'Section': row.section_name || '-',
          'Objectives': row.objective || '-',
          'KPI': row.metric_name,
        };

        // Inject Historical Columns if visible
        if (showHistorical) {
          historicalYears.forEach(year => {
            rowData[`Target (${year})`] = `${row.operator || ''} ${row.target_value || ''} ${row.unit || ''}`.trim();
            const hVal = row.history[year];
            rowData[`Actual (${year})`] = hVal !== '-' ? `${hVal} ${row.unit}`.trim() : '-';
          });
          rowData['Achieved? (Prev Year)'] = row.achievedLastYear || '-';
        }

        // Current Year Data
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-800 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8 font-sans text-slate-900">
      <div className={`${showHistorical ? 'max-w-[2400px]' : 'max-w-[1800px]'} mx-auto space-y-6 transition-all duration-500`}>
        
        {/* Report Header */}
        <div className="flex flex-col md:flex-row items-center justify-between border-b-2 border-blue-900 pb-4">
          <div className="flex items-center gap-4">
            {/* <div className="w-20 h-16 bg-blue-50 border border-blue-900 flex items-center justify-center font-bold text-blue-900 tracking-tighter text-2xl">
              GKG
            </div> */}
            <div>
              <h1 className="text-3xl font-black text-blue-700 tracking-tight uppercase">
                ANNUAL DEPARTMENTAL OBJECTIVES & TARGETS
              </h1>
              {/* <p className="text-xs font-bold text-blue-900 uppercase">Gunma Gohkin Phils. Corp.</p> */}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0 print:hidden">
            <button 
              onClick={() => setShowHistorical(!showHistorical)} 
              className={`flex items-center px-4 py-2 text-sm font-bold border rounded shadow-sm transition-colors ${showHistorical ? 'bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'}`}
            >
              {showHistorical ? <EyeOff size={16} className="mr-2" /> : <History size={16} className="mr-2" />} 
              {showHistorical ? 'Hide History' : 'Show History (5 Yrs)'}
            </button>
            <button onClick={() => window.print()} className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold border border-slate-300 rounded shadow-sm">
              <Printer size={16} className="mr-2" /> Print
            </button>
            <button onClick={handleExportExcel} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded shadow-sm transition-colors">
              <Download size={16} className="mr-2" /> Export Excel
            </button>
          </div>
        </div>

        {/* Master Data Grid */}
        <div className="overflow-x-auto border-2 border-slate-800">
          <table className="w-full text-sm text-center border-collapse">
            <thead className="bg-slate-100 font-bold text-slate-900">
              <tr>
                <th className="border border-slate-800 p-2 w-10" rowSpan={2}>No.</th>
                <th className="border border-slate-800 p-2 w-16" rowSpan={2}>TYPE</th>
                <th className="border border-slate-800 p-2 min-w-[150px]" rowSpan={2}>QMS PROCESS</th>
                <th className="border border-slate-800 p-2 min-w-[150px]" rowSpan={2}>Department / Section</th>
                <th className="border border-slate-800 p-2 min-w-[250px]" rowSpan={2}>Objectives</th>
                <th className="border border-slate-800 p-2 min-w-[150px]" rowSpan={2}>KPI</th>
                
                {/* Historical Headers */}
                {showHistorical && historicalYears.map(year => (
                  <th key={`h-${year}`} className="border border-slate-800 p-1" colSpan={2}>{year}</th>
                ))}
                {showHistorical && (
                  <th className="border border-slate-800 p-1 w-20 text-[10px] uppercase leading-tight" rowSpan={2}>Achieved?</th>
                )}

                <th className="border border-slate-800 p-1" colSpan={2}>{currentYear}</th>
                <th className="border border-slate-800 p-2 min-w-[120px]" rowSpan={2}>Process Owner</th>
                {months.map(m => (
                  <th key={m} className="border border-slate-800 p-2 w-16" rowSpan={2}>{m}</th>
                ))}
              </tr>
              <tr>
                {/* Historical Sub-Headers */}
                {showHistorical && historicalYears.map(year => (
                  <Fragment key={`sub-${year}`}>
                    <th className="border border-slate-800 p-1 min-w-[80px] text-xs">Target</th>
                    <th className="border border-slate-800 p-1 min-w-[80px] text-xs">Actual Result</th>
                  </Fragment>
                ))}
                
                <th className="border border-slate-800 p-1 min-w-[80px] bg-green-100 text-xs">Target</th>
                <th className="border border-slate-800 p-1 min-w-[80px] bg-pink-50 text-xs">Actual Result</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {reportData.map((row) => {
                const targetDisplay = `${row.operator} ${row.target_value}${row.unit}`;
                return (
                  <tr key={row.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="border border-slate-800 p-2 font-medium">{row.displayIndex}</td>
                    
                    {row.rowSpan.process_category > 0 && (
                      <td className="border border-slate-800 p-2 bg-teal-50/50" rowSpan={row.rowSpan.process_category}>
                        {row.process_category || '-'}
                      </td>
                    )}
                    
                    {row.rowSpan.process_type > 0 && (
                      <td className="border border-slate-800 p-2 bg-teal-50/50 text-left" rowSpan={row.rowSpan.process_type}>
                        {row.process_type || '-'}
                      </td>
                    )}
                    
                    {row.rowSpan.dept_name > 0 && (
                      <td className="border border-slate-800 p-2 bg-teal-50/50 text-left" rowSpan={row.rowSpan.dept_name}>
                        <span className="block font-bold">{row.dept_name || '-'}</span>
                        <span className="text-[10px] text-slate-500">{row.section_name || ''}</span>
                      </td>
                    )}

                    <td className="border border-slate-800 p-2 text-left">{row.objective || '-'}</td>
                    <td className="border border-slate-800 p-2 text-left font-semibold">{row.metric_name}</td>
                    
                    {/* Historical Data Cells */}
                    {showHistorical && historicalYears.map(year => {
                      const hVal = row.history[year];
                      const isMissed = hVal !== '-' ? checkIsMissed(hVal, row.target_value, row.operator) : false;
                      return (
                        <Fragment key={`td-${year}`}>
                          <td className="border border-slate-800 p-1">{targetDisplay}</td>
                          <td className={`border border-slate-800 p-1 font-bold ${isMissed ? 'text-rose-600' : (hVal !== '-' ? 'text-green-700' : '')}`}>
                            {hVal !== '-' ? `${hVal}${row.unit}` : '-'}
                          </td>
                        </Fragment>
                      );
                    })}

                    {showHistorical && (
                      <td className={`border border-slate-800 p-1 font-black text-sm ${row.achievedLastYear === 'Y' ? 'text-green-600' : (row.achievedLastYear === 'N' ? 'text-rose-600' : '')}`}>
                        {row.achievedLastYear || '-'}
                      </td>
                    )}

                    <td className="border border-slate-800 p-2 font-bold bg-green-100/50">
                      {targetDisplay}
                    </td>
                    
                    <td className="border border-slate-800 p-2 font-bold text-rose-600 bg-pink-50/50">
                      {row.ytdActual !== '-' ? `${row.ytdActual}${row.unit}` : '-'}
                    </td>
                    
                    <td className="border border-slate-800 p-2 text-[10px] leading-tight text-left font-medium">{row.proposer_name || '-'}</td>

                    {/* Monthly Data Columns */}
                    {months.map((m, i) => {
                      const monthValue = row.monthlyData[i + 1];
                      const isMissing = !monthValue && i < new Date().getMonth();
                      return (
                        <td key={m} className={`border border-slate-800 p-1 ${monthValue ? 'font-bold text-rose-600' : 'text-slate-400'}`}>
                          {monthValue ? `${monthValue}${row.unit === '%' ? '%' : ''}` : (isMissing ? 'No data' : '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={showHistorical ? 21 + (historicalYears.length * 2) + 1 : 21} className="border border-slate-800 p-8 text-slate-500 italic">
                    No approved targets available for the current reporting year.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Required for the inline Fragment rendering in table loops
import { Fragment } from 'react';

export default AnnualObjectivesPage;