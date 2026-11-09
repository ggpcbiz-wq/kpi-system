// client/src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { PlantProvider } from './context/PlantProvider'; // Import the new PlantProvider

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
import DepartmentManagementPage from './pages/DepartmentManagementPage';
import AnnualObjectivesPage from './pages/AnnualObjectivesPage';

import LoginPage from './pages/LoginPage';

const Unauthorized = () => <h2 className="p-8">403 - Unauthorized Access</h2>;

const RootRedirect = () => {
  const { user, isLoading } = useAuth(); 
  if (isLoading) return <div className="p-8 text-slate-500 animate-pulse">Loading Session...</div>;
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'Administrator': return <Navigate to="/overview" replace />;
    case 'Supervisor': return <Navigate to="/supervisor" replace />;
    case 'Senior Supervisor': return <Navigate to="/supervisor" replace />;
    case 'Manager': return <Navigate to="/manager" replace />;
    case 'Top Management': return <Navigate to="/top-management" replace />;
    default: return <Navigate to="/unauthorized" replace />;
  }
};

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        {/* PlantProvider must be inside AuthProvider to access the logged-in user's default plant */}
        <PlantProvider>
          <Router>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              
              <Route path="/login" element={<LoginPage />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              <Route element={<Layout />}>
                
                <Route element={<ProtectedRoute allowedRoles={['Administrator']} />}>
                  <Route path="/admin" element={<UserManagementPage />} />
                  <Route path="/admin/workflow" element={<WorkflowControlPage />} />
                  <Route path="/admin/departments" element={<DepartmentManagementPage />} />
                  <Route path="/reports/annual-objectives" element={<AnnualObjectivesPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Supervisor', 'Senior Supervisor', 'Manager']} />}>
                   <Route path="/inbox" element={<QuarterlyCarInboxPage />} />
                </Route>
                
               <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Supervisor', 'Senior Supervisor']} />}>
                 <Route path="/supervisor" element={<SupervisorPage />} />
                 <Route path="/supervisor/data-entry" element={<DataEntryPage />} />
               </Route>

                <Route element={<ProtectedRoute allowedRoles={['Manager']} />}>
                  <Route path="/manager" element={<ManagerPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Top Management']} />}>
                  <Route path="/manager/targets" element={<ManagerPage targetSettingOnly />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Top Management']} />}>
                  <Route path="/top-management" element={<TopManagementPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Supervisor', 'Senior Supervisor', 'Manager', 'Top Management']} />}>
                  <Route path="/car-tracking" element={<CarTrackingPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Administrator', 'Supervisor', 'Senior Supervisor', 'Manager', 'Top Management']} />}>
                  <Route path="/overview" element={<CompanyOverviewPage />} />
                </Route>
              </Route>
            </Routes>
          </Router>
        </PlantProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;