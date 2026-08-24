import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const Layout = () => {
  return (
    <div className="flex h-screen w-full bg-jira-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet /> {/* This is where page content (e.g., SupervisorDashboard) injects */}
      </main>
    </div>
  );
};

export default Layout;