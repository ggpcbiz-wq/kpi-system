import { Search, Filter, MapPin, Calendar, Briefcase } from 'lucide-react';

const FilterBar = ({ 
  filters, 
  onFilterChange, 
  config = { showPlant: false, showDept: false, showDate: true, showSearch: true },
  departments = [] 
}) => {

  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const handleClear = () => {
    onFilterChange({ search: '', plant: 'All', period: '', department: 'All' });
  };

  const isFiltered = filters.search || filters.plant !== 'All' || filters.period || filters.department !== 'All';

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-end mb-8 transition-colors duration-300">
      
      {/* Search Filter */}
      {config.showSearch && (
        <div className="w-full md:flex-1">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 transition-all"
              placeholder="Search metrics..."
              value={filters.search || ''}
              onChange={(e) => handleChange('search', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Plant Filter */}
      {config.showPlant && (
        <div className="w-full md:w-48 shrink-0">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">Plant Location</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <select
              className="w-full pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 appearance-none transition-all"
              value={filters.plant || 'All'}
              onChange={(e) => handleChange('plant', e.target.value)}
            >
              <option value="All">All Plants</option>
              <option value="Laguna">Laguna</option>
              <option value="Cavite">Cavite</option>
            </select>
          </div>
        </div>
      )}

      {/* Department Filter */}
      {config.showDept && (
        <div className="w-full md:w-48 shrink-0">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">Department</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Briefcase size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <select
              className="w-full pl-9 pr-8 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 appearance-none transition-all"
              value={filters.department || 'All'}
              onChange={(e) => handleChange('department', e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Date/Period Filter */}
      {config.showDate && (
        <div className="w-full md:w-48 shrink-0">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 transition-colors">Period</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <input
              type="month"
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 transition-all"
              value={filters.period || ''}
              onChange={(e) => handleChange('period', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Clear Button */}
      <div className="w-full md:w-auto shrink-0">
        <button 
          onClick={handleClear}
          className="w-full px-5 py-2.5 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isFiltered}
        >
          <Filter size={16} className="mr-2" />
          Clear
        </button>
      </div>

    </div>
  );
};

export default FilterBar;