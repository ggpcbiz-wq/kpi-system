import { useState } from 'react';
import { Search, Loader2, FileText, CheckCircle, X } from 'lucide-react';

// Moved outside the component so it doesn't get recreated on every render
const mockMboDatabase = [
  { id: 'OBJ-2026-0040', title: 'Achieve 99% First Pass Yield in Assembly', owner: 'Mildred Negranza', status: 'Active' },
  { id: 'OBJ-2026-0041', title: 'Reduce Logistics Freight Cost by 5%', owner: 'Bryan Magpantay', status: 'Active' },
  { id: 'OBJ-2026-00402', title: 'Zero Safety Incidents for Q1-Q2', owner: 'Ivan Golosinda', status: 'Active' },
  { id: 'OBJ-2026-00403', title: 'Improve On-Time Delivery to 100%', owner: 'Nia Castro', status: 'Active' },
];

const KintoneMBOLookupModal = ({ isOpen, onClose, onSelect }) => {
  // 1. Initialize state with defaults
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(mockMboDatabase);

  // 2. Reset state when closing the modal
  const handleClose = () => {
    setSearchQuery('');
    setResults(mockMboDatabase);
    onClose();
  };

  // 3. Reset state when making a selection
  const handleSelect = (mbo) => {
    setSearchQuery('');
    setResults(mockMboDatabase);
    onSelect(mbo);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    
    // Simulate Kintone API latency
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const filtered = mockMboDatabase.filter(mbo => 
      mbo.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      mbo.id.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setResults(filtered);
    setIsSearching(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-jira-border bg-slate-50 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-jira-text flex items-center">
            <FileText size={20} className="mr-2 text-brand-500" />
            Lookup Kintone MBO Record
          </h3>
          {/* Use handleClose here */}
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="p-4 border-b border-jira-border shrink-0">
          <form onSubmit={handleSearch} className="flex space-x-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-jira-text-muted" />
              </div>
              <input 
                type="text" 
                className="w-full pl-9 pr-3 py-2 border border-jira-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Search by MBO Title or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isSearching}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center shrink-0"
            >
              {isSearching ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-4 bg-slate-50">
          <div className="space-y-3">
            {results.map((mbo) => (
              <div key={mbo.id} className="bg-white border border-jira-border rounded-md p-4 flex items-center justify-between hover:border-brand-300 hover:shadow-sm transition-all">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{mbo.id}</span>
                    <span className="text-xs font-medium text-jira-text-muted">Owner: {mbo.owner}</span>
                  </div>
                  <p className="text-sm font-semibold text-jira-text">{mbo.title}</p>
                </div>
                {/* Use handleSelect here */}
                <button 
                  onClick={() => handleSelect(mbo)}
                  className="flex items-center px-3 py-1.5 text-sm font-medium text-jira-success bg-jira-success-bg border border-jira-success/20 rounded hover:bg-green-100 transition-colors shrink-0"
                >
                  <CheckCircle size={16} className="mr-1.5" /> Select
                </button>
              </div>
            ))}

            {results.length === 0 && !isSearching && (
              <div className="text-center py-8 text-jira-text-muted">
                <p>No MBO records found matching your search.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default KintoneMBOLookupModal;