import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import FilterBar from '../components/FilterBar';

const CarTrackingPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [carLedger, setCarLedger] = useState([]);
  
  // Unified Filter State
  const [filters, setFilters] = useState({ search: '', plant: 'All', period: '', department: 'All' });

  useEffect(() => {
    const fetchCarData = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 600)); 
        setCarLedger([
          {
            id: 'd1', period: '2026-05', plant: 'Laguna', metric: '100% On-time delivery',
            target: '100', actual: '66', kintone_cpar_id: 'CPAR-2026-041',
            problem_description: 'Non-achievement of 100% OTD for overseas customers.',
            problem_cause: 'Insufficient parts to ship and recover backlog.',
            improvement_plan: 'Priority in operation; propose additional machining lines.',
            pic: 'Sales / Prod', target_completion_date: '2026-12-31', status: 'Approved' 
          },
          {
            id: 'd2', period: '2026-04', plant: 'Cavite', metric: 'Production Yield',
            target: '95.0', actual: '91.2', kintone_cpar_id: 'CPAR-2026-022',
            problem_description: 'Porosity issue encountered in production at Gunma Cavite.',
            problem_cause: 'Mold defects resulting in 70-80% porosity.',
            improvement_plan: 'Establish new way to check porosity at real-time; mold improvement actions.',
            pic: 'QA / Mold', target_completion_date: '2026-07-31', status: 'Pending Manager Review'
          }
        ]);
      } catch (error) {
        console.error("Failed to fetch CAR ledger", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchCarData();
  }, [user.departmentId]);

  const formatPeriod = (yyyy_mm) => {
    if (!yyyy_mm) return '';
    const [year, month] = yyyy_mm.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Compound Filtering Logic mapped to the new unified state
  const filteredLedger = carLedger.filter(car => {
    const matchesSearch = !filters.search || 
      car.kintone_cpar_id.toLowerCase().includes(filters.search.toLowerCase()) ||
      car.metric.toLowerCase().includes(filters.search.toLowerCase());
      
    const matchesPlant = filters.plant === 'All' || car.plant === filters.plant;
    const matchesPeriod = !filters.period || car.period === filters.period;

    return matchesSearch && matchesPlant && matchesPeriod;
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading CAR Ledger...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* MAXIMIZED CONTAINER WIDTH */}
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        <div className="border-b border-slate-200 dark:border-slate-800 pb-6 transition-colors duration-300">
          {/* ✨ FIX: Applied Bebas Neue typography and brand primary color */}
          <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 flex items-center uppercase">
            <AlertTriangle className="mr-3 text-brand-500 dark:text-brand-400" size={40} />
            CAR / CPAR TRACKING
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">
            Internal ledger for missed targets and linked Kintone corrective actions.
          </p>
        </div>

        {/* Reusable Filter Bar injected here (Already dark-mode configured) */}
        <FilterBar 
          filters={filters} 
          onFilterChange={setFilters} 
          config={{ showSearch: true, showPlant: true, showDate: true, showDept: false }} 
        />

        {/* HIGH-DENSITY GRID FOR EXTRA LARGE SCREENS */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {filteredLedger.map((car) => (
            <div key={car.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden h-full flex flex-col transition-colors duration-300 hover:shadow-md">
              <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap justify-between items-center gap-4 transition-colors">
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Metric ({formatPeriod(car.period)})</p>
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center transition-colors">
                      {car.metric}
                      <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded uppercase tracking-wider border border-slate-200 dark:border-slate-600 transition-colors">
                        {car.plant}
                      </span>
                    </p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700 hidden md:block transition-colors"></div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 transition-colors">Target vs Actual</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors">
                      {car.target} / <span className="text-rose-600 dark:text-rose-400 font-bold">{car.actual}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 mt-2 md:mt-0">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors shadow-sm ${
                    car.status === 'Approved' 
                      ? 'bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border-jira-success/30 dark:border-jira-success/30' 
                      : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                  }`}>
                    {car.status}
                  </span>
                  <a 
                    href={`https://your-domain.kintone.com/k/car/${car.kintone_cpar_id}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 rounded-md text-sm font-bold transition-colors border border-brand-200 dark:border-brand-800/50 shrink-0 shadow-sm"
                    title="Open in Kintone"
                  >
                    {car.kintone_cpar_id}
                    <ExternalLink size={14} className="ml-2" />
                  </a>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm flex-1">
                <div className="md:col-span-2">
                  <p className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1 transition-colors">Problem Description</p>
                  <p className="text-slate-800 dark:text-slate-300 font-medium transition-colors">{car.problem_description}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1 transition-colors">Root Cause</p>
                  <p className="text-slate-600 dark:text-slate-400 transition-colors">{car.problem_cause}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1 transition-colors">Improvement Plan</p>
                  <p className="text-slate-600 dark:text-slate-400 transition-colors">{car.improvement_plan}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1 transition-colors">PIC</p>
                  <p className="text-slate-800 dark:text-slate-300 font-medium transition-colors">{car.pic}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-brand-600/70 dark:text-brand-400/70 uppercase tracking-widest mb-1 transition-colors">Target Completion</p>
                  <p className="text-slate-800 dark:text-slate-300 font-medium transition-colors">{car.target_completion_date}</p>
                </div>
              </div>
            </div>
          ))}

          {filteredLedger.length === 0 && (
            <div className="col-span-1 xl:col-span-2 text-center p-16 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 flex flex-col items-center justify-center shadow-sm transition-colors duration-300">
              <AlertTriangle size={56} className="text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-900 dark:text-slate-100 font-bold text-xl">No Records Found</p>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-2">No Corrective Action Records match your current filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarTrackingPage;