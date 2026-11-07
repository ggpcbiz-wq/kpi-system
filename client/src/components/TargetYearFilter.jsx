const TargetYearFilter = ({ years, value, onChange }) => (
  <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
    Target Year
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 normal-case tracking-normal"
    >
      <option value="All Years">All Years</option>
      {years.map(year => (
        <option key={year} value={String(year)}>{year}</option>
      ))}
    </select>
  </label>
);

export default TargetYearFilter;
