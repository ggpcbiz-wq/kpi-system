import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Printer, Download, History, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../services/api';
import * as XLSX from 'xlsx';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const currentYear = new Date().getFullYear();
const historicalYears = Array.from({ length: 5 }, (_, i) => currentYear - 5 + i);
const plantLabels = {
  Cavite: 'CDPC (Cavite Plant)',
  Laguna: 'GGPC (Laguna Plant)'
};

const normalizePlant = (plant) => {
  const value = String(plant || '').trim();
  if (/cavite/i.test(value)) return 'Cavite';
  if (/laguna/i.test(value)) return 'Laguna';
  return value || 'Unassigned';
};

const getPlantLabel = (plant) => plantLabels[normalizePlant(plant)] || normalizePlant(plant);

const parseNumericValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numericValue = Number(String(value).replace(/[$,%\s,]/g, ''));
  return Number.isFinite(numericValue) ? numericValue : null;
};

const checkIsMissed = (actual, target, operator) => {
  const act = parseNumericValue(actual);
  const tgt = parseNumericValue(target);
  if (act === null || tgt === null) return false;
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
  const [selectedPlant, setSelectedPlant] = useState('All');

  useEffect(() => {
    let isMounted = true;
    const fetchReportData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/annual-objectives?_t=${Date.now()}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch annual objectives');
        const { targets: rawTargets, submissions: rawSubs } = await response.json();

        if (isMounted) {
          setTargets(rawTargets);
          setSubmissions(rawSubs);
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

  const plantOptions = useMemo(() => {
    const otherPlants = [...new Set(targets
      .map(target => normalizePlant(target.plant))
      .filter(plant => !['Cavite', 'Laguna'].includes(plant)))];
    return [
      { value: 'All', label: 'All Plants' },
      { value: 'Cavite', label: plantLabels.Cavite },
      { value: 'Laguna', label: plantLabels.Laguna },
      ...otherPlants.map(plant => ({ value: plant, label: plant }))
    ];
  }, [targets]);

  const reportData = useMemo(() => {
    const visibleTargets = targets.filter(target =>
      selectedPlant === 'All' || normalizePlant(target.plant) === selectedPlant
    );
    const merged = visibleTargets.map((target, index) => {
      const isCumulative = target.unit?.trim() !== '%';
      
      const currentSubs = submissions.filter(s => s.target_id === target.id && s.report_year === currentYear);
      
      const monthlyData = {};
      currentSubs.forEach(sub => {
        monthlyData[sub.report_month] = sub.actual_value;
      });
      const currentNumericValues = currentSubs
        .map(sub => parseNumericValue(sub.actual_value))
        .filter(value => value !== null);
      const ytdSum = currentNumericValues.reduce((sum, value) => sum + value, 0);
      const ytdCount = currentNumericValues.length;
      
      const ytdActual = ytdCount > 0 
        ? (isCumulative ? ytdSum : (ytdSum / ytdCount)).toFixed(2) 
        : '-';

      const history = {};
      let lastYearActual = '-';
      
      historicalYears.forEach(year => {
        const hSubs = submissions.filter(s => s.target_id === target.id && s.report_year === year);
        const historicalValues = hSubs
          .map(sub => parseNumericValue(sub.actual_value))
          .filter(value => value !== null);
        const historicalSum = historicalValues.reduce((sum, value) => sum + value, 0);
        const hYtd = historicalValues.length > 0
          ? (isCumulative ? historicalSum : (historicalSum / historicalValues.length)).toFixed(2)
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
        achievedLastYear,
        dept_section_key: `${normalizePlant(target.plant)}|${target.dept_name || ''}|${target.section_name || ''}`
      };
    });

    merged.sort((a, b) => {
      const plantA = normalizePlant(a.plant);
      const plantB = normalizePlant(b.plant);
      if (plantA !== plantB) return plantA.localeCompare(plantB);

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
        if (i > 0
          && normalizePlant(merged[i].plant) === normalizePlant(merged[i - 1].plant)
          && merged[i][field] === merged[i - 1][field]) {
          merged[i].rowSpan[field] = 0;
          let originIndex = i - 1;
          while (originIndex > 0 && merged[originIndex].rowSpan[field] === 0) originIndex--;
          merged[originIndex].rowSpan[field]++;
        }
      });
    }

    return merged;
  }, [targets, submissions, selectedPlant]);

  const handleExportExcel = () => {
    try {
      if (reportData.length === 0) return addToast("No data available to export.", "info");

      const excelData = reportData.map(row => {
        const deptDisplay = row.dept_name || '-';
        // ✨ ARCHITECTURAL FIX: Export code explicitly associated with the Section
        const sectionDisplay = row.section_code ? `[${row.section_code}] ${row.section_name}` : row.section_name;
        const deptSectionDisplay = sectionDisplay ? `${deptDisplay} / ${sectionDisplay}` : deptDisplay;

        const rowData = {
          'Plant': getPlantLabel(row.plant),
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
          rowData[month] = val !== undefined && val !== null && val !== ''
            ? `${val} ${row.unit === '%' && parseNumericValue(val) !== null ? '%' : ''}`.trim()
            : '-';
        });

        return rowData;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `Objectives ${currentYear}`);
      const plantFilename = selectedPlant === 'All' ? 'All_Plants' : selectedPlant.replace(/\s+/g, '_');
      XLSX.writeFile(workbook, `Annual_Objectives_${currentYear}_${plantFilename}.xlsx`);
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
            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
              Plant
              <select
                value={selectedPlant}
                onChange={event => setSelectedPlant(event.target.value)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                {plantOptions.map(plant => (
                  <option key={plant.value} value={plant.value}>{plant.label}</option>
                ))}
              </select>
            </label>
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
                              <span className="block font-bold text-slate-800 dark:text-slate-200">
                                {row.dept_name}
                              </span>
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-700 dark:text-violet-300">
                                {getPlantLabel(row.plant)}
                              </span>
                              <span className="block text-[10px] font-black text-brand-600 dark:text-brand-400 uppercase mt-1 tracking-wider">
                                {/* ✨ ARCHITECTURAL FIX: Badge applied to section name */}
                                {row.section_code ? `[${row.section_code}] ` : ''}{row.section_name}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="block font-bold text-brand-600 dark:text-brand-400">
                                {row.dept_name || '-'}
                              </span>
                              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-[9px] font-bold text-violet-700 dark:text-violet-300">
                                {getPlantLabel(row.plant)}
                              </span>
                            </>
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
                      
                      <td className={`border border-slate-200 dark:border-slate-700 p-3 font-bold bg-rose-50/50 dark:bg-rose-900/10 ${row.ytdActual === '-' ? '' : (checkIsMissed(row.ytdActual, row.target_value, row.operator) ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}`}>
                        {row.ytdActual !== '-' ? `${row.ytdActual}${row.unit}` : '-'}
                      </td>
                      
                      <td className="border border-slate-200 dark:border-slate-700 p-3 text-[10px] leading-tight text-left font-medium">{row.proposer_name || '-'}</td>

                      {months.map((m, i) => {
                        const monthValue = row.monthlyData[i + 1];
                        const hasMonthValue = monthValue !== undefined && monthValue !== null && monthValue !== '';
                        const isMissing = !hasMonthValue && i < new Date().getMonth();
                        const numericMonthValue = parseNumericValue(monthValue);
                        const isMissed = hasMonthValue && numericMonthValue !== null && checkIsMissed(monthValue, row.target_value, row.operator);
                        const valueClass = numericMonthValue === null
                          ? 'text-slate-500 dark:text-slate-400'
                          : `font-bold ${isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`;
                        return (
                          <td key={m} className={`border border-slate-200 dark:border-slate-700 p-2 ${hasMonthValue ? valueClass : 'text-slate-400 dark:text-slate-500'}`}>
                            {hasMonthValue
                              ? `${monthValue}${row.unit === '%' && numericMonthValue !== null ? '%' : ''}`
                              : (isMissing ? 'No data' : '')}
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