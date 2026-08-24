import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout'; 

import DataEntryPage from './pages/DataEntryPage';
import CarTrackingPage from './pages/CarTrackingPage';
import WorkflowControlPage from './pages/WorkflowControlPage';
import UserManagementPage from './pages/UserManagementPage';
import CompanyOverviewPage from './pages/CompanyOverviewPage';
import SupervisorPage from './pages/SupervisorPage';
import ManagerPage from './pages/ManagerPage';
import TopManagementPage from './pages/TopManagementPage';
import QuarterlyCarInboxPage from './pages/QuarterlyCarInboxPage';
// ✨ FIX: Imported the new Department Management component
import DepartmentManagementPage from './pages/DepartmentManagementPage';

import LoginPage from './pages/LoginPage';

const Unauthorized = () => <h2 className="p-8">403 - Unauthorized Access</h2>;

const RootRedirect = () => {
  const { user, isLoading } = useAuth(); 
  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Loading Session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'Administrator': return <Navigate to="/overview" replace />;
    case 'Supervisor': return <Navigate to="/supervisor" replace />;
    case 'Manager': return <Navigate to="/manager" replace />;
    case 'Top Management': return <Navigate to="/top-management" replace />;
    default: return <Navigate to="/unauthorized" replace />;
  }
};

function App() {
  // ToastProvider is the outermost wrapper so toasts work everywhere
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            <Route element={<Layout />}>
              
              {/* ✨ FIX: Administrator-only routes */}
              <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
                <Route path="/admin" element={<UserManagementPage />} />
                <Route path="/admin/workflow" element={<WorkflowControlPage />} />
                {/* ✨ FIX: Registered the Department Management route */}
                <Route path="/admin/departments" element={<DepartmentManagementPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['Supervisor', 'Manager']} />}>
                 <Route path="/inbox" element={<QuarterlyCarInboxPage />} />
              </Route>
              
              <Route element={<ProtectedRoute allowedRoles={['Supervisor']} />}>
                <Route path="/supervisor" element={<SupervisorPage />} />
                <Route path="/supervisor/data-entry" element={<DataEntryPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['Manager']} />}>
                <Route path="/manager" element={<ManagerPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['Top Management']} />}>
                <Route path="/top-management" element={<TopManagementPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['Supervisor', 'Manager', 'Top Management']} />}>
                <Route path="/car-tracking" element={<CarTrackingPage />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Supervisor', 'Manager', 'Top Management']} />}>
                <Route path="/overview" element={<CompanyOverviewPage />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;