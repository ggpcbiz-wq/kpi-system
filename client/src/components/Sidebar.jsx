import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext'; 
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  AlertCircle, 
  Users, 
  Settings, 
  Globe,
  Inbox,
  LogOut,
  Moon, 
  Sun,
  Building2 // ✨ FIX: Imported new icon for Department Management
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme(); 
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // RBAC Routing configuration
  const getNavLinks = () => {
    switch (user?.role) {
      case 'Administrator':
        return [
          { name: 'Company Scoreboard', path: '/overview', icon: Globe },
          { name: 'User Management', path: '/admin', icon: Users },
          // ✨ FIX: Added the Department Management route explicitly for Admins
          { name: 'Dept. Management', path: '/admin/departments', icon: Building2 }, 
          { name: 'Workflow Control', path: '/admin/workflow', icon: Settings } 
        ];
      case 'Supervisor':
        return [
          { name: 'Company Scoreboard', path: '/overview', icon: Globe },
          { name: 'Department Dashboard', path: '/supervisor', icon: LayoutDashboard },
          { name: 'CAR Tracking', path: '/car-tracking', icon: AlertCircle }, 
          { name: 'Inbox', path: '/inbox', icon: Inbox } 
        ];
      case 'Manager':
        return [
          { name: 'Company Scoreboard', path: '/overview', icon: Globe },
          { name: 'Managers Dashboard', path: '/manager', icon: LayoutDashboard },
          { name: 'CAR Ledger', path: '/car-tracking', icon: AlertCircle }, 
          { name: 'Inbox', path: '/inbox', icon: Inbox } 
        ];
      case 'Top Management': 
        return [
          { name: 'Company Scoreboard', path: '/overview', icon: Globe },
          { name: 'Executive Dashboard', path: '/top-management', icon: LayoutDashboard },
          { name: 'CAR Ledger', path: '/car-tracking', icon: AlertCircle } 
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  const initiateLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const executeLogout = () => {
    setIsLogoutModalOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <>
      <aside 
        className={`relative bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen shrink-0 transition-all duration-300 ease-in-out shadow-sm ${
          isCollapsed ? 'w-20' : 'w-72'
        }`}
      >
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-7 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-100 dark:hover:border-brand-900 hover:shadow-sm transition-all z-10"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
        </button>

        {/* Header Area */}
        <div className={`h-24 flex items-center border-b border-slate-100 dark:border-slate-800 transition-all duration-300 ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}>
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-brand-100 dark:shadow-none">
            <span className="text-white font-display text-2xl tracking-wide">KPI</span>
          </div>
          {!isCollapsed && (
            <div className="ml-4 flex flex-col justify-center overflow-hidden">
              <span className="font-brand font-extrabold text-brand-500 dark:text-brand-400 text-[20px] leading-tight truncate tracking-tight">
                MANAGEMENT
              </span>
              <span className="text-[14px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                SYSTEM
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 py-8 space-y-1.5 overflow-y-auto ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {!isCollapsed && (
            <p className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              Main Menu
            </p>
          )}
          
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            const Icon = link.icon;
            
            return (
              <Link
                key={link.path}
                to={link.path}
                title={isCollapsed ? link.name : undefined}
                className={`flex items-center text-sm font-bold transition-all duration-200 group relative ${
                  isCollapsed ? 'justify-center py-3.5 rounded-xl' : 'px-4 py-3 rounded-xl'
                } ${
                  isActive 
                    ? 'bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-slate-50' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={20} className={`transition-colors ${isActive ? 'text-brand-600 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                {!isCollapsed && (
                  <span className="ml-3.5 whitespace-nowrap overflow-hidden">
                    {link.name}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Profile & Utilities Section */}
        <div className={`border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 flex flex-col ${isCollapsed ? 'p-3 space-y-2' : 'p-5'}`}>
          
          <div className={`flex items-center rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-all ${isCollapsed ? 'justify-center p-2' : 'p-3 mb-3'}`}>
            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-600 dark:text-brand-400 font-black shrink-0 border border-brand-100 dark:border-brand-800">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div className="ml-3 flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">{user?.name}</span>
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate whitespace-nowrap uppercase tracking-widest">{user?.role}</span>
              </div>
            )}
          </div>

          <button
            onClick={toggleTheme}
            title={isCollapsed ? (isDarkMode ? "Light Mode" : "Dark Mode") : undefined}
            className={`flex items-center text-sm font-bold transition-colors text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl mb-1 ${
              isCollapsed ? 'justify-center p-3' : 'px-4 py-3 w-full justify-start'
            }`}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            {!isCollapsed && <span className="ml-3.5">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <button
            onClick={initiateLogout} 
            title={isCollapsed ? "Sign Out" : undefined}
            className={`flex items-center text-sm font-bold transition-colors text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl ${
              isCollapsed ? 'justify-center p-3' : 'px-4 py-3 w-full justify-start'
            }`}
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="ml-3.5">Sign Out</span>}
          </button>

        </div>
      </aside>

      {/* Confirmation Modal */}
      <ConfirmModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={executeLogout}
        title="Sign Out"
        message="Are you sure you want to sign out of the KPI Portal? Any unsaved data entries will be lost."
        confirmText="Sign Out"
        isDestructive={false} 
      />
    </>
  );
};

export default Sidebar;