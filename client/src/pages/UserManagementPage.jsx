import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { UserPlus, Search, Edit, Trash2, ShieldCheck, SearchCode, CheckCircle2, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { API_BASE_URL } from '../services/api';

const UserManagementPage = () => {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('All');

  const roles = ['Administrator', 'Top Management', 'Manager', 'Assistant Manager', 'Acting Assistant Managers', 'Senior Supervisor', 'Acting Supervisor'];
  const departments = ['GLOBAL', 'DX Driving Force', 'Finance & Accounting', 'Corporate Administration',  'Sales & Purchasing', 'Info. Resources Management', 'Quality Management', 'Laguna Plant', 'Cavite Plant', 'Plant Management', 'Tooling Process Development'];  

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [lookupEmail, setLookupEmail] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLookupSuccessful, setIsLookupSuccessful] = useState(false);
  
  const [forceAdmin, setForceAdmin] = useState(false);
  const [forceGlobal, setForceGlobal] = useState(false);
  
  const [originalDept, setOriginalDept] = useState(''); 

  const [formData, setFormData] = useState({ 
    id: null, name: '', email: '', role: '', departments: [], plant: '', status: 'Active' 
  });

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        setUsersList(data);
      } catch (error) {
        console.error("Failed to fetch users", error);
        addToast('Failed to load users from database', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    if (token) fetchUsers();
  }, [token, addToast]); 

  const handleOpenAdd = () => {
    setIsEditing(false);
    setLookupEmail('');
    setIsLookupSuccessful(false);
    setForceAdmin(false);
    setForceGlobal(false);
    setOriginalDept('');
    setFormData({ id: null, name: '', email: '', role: '', departments: [], plant: '', status: 'Active' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (targetUser) => {
    setIsEditing(true);
    setIsLookupSuccessful(true); 
    
    const isAdmin = targetUser.role === 'Administrator';
    setForceAdmin(isAdmin);
    
    const mappedDepartments = targetUser.departments ? targetUser.departments : (targetUser.department ? [targetUser.department] : []);
    
    const isGlobal = mappedDepartments.includes('GLOBAL');
    setForceGlobal(isGlobal);
    
    if (!isGlobal && mappedDepartments.length > 0) {
      setOriginalDept(mappedDepartments[0]);
    } else {
      setOriginalDept('');
    }

    setFormData({ ...targetUser, departments: mappedDepartments });
    setIsModalOpen(true);
  };

  const handleAdminToggle = (isChecked) => {
    setForceAdmin(isChecked);
  };

  const handleGlobalToggle = (isChecked) => {
    setForceGlobal(isChecked);
    setFormData(prev => ({
      ...prev,
      departments: isChecked ? ['GLOBAL'] : (originalDept ? [originalDept] : [])
    }));
  };

  const handleLookup = async () => {
    if (!lookupEmail.trim()) {
      addToast('Please enter an email address to search.', 'info');
      return;
    }
    
    setIsLookingUp(true);
    setIsLookupSuccessful(false);
    setForceAdmin(false);
    setForceGlobal(false);

    try {
      // FIX: Strict Cache-Busting Implementation
      const timestamp = new Date().getTime();
      const response = await fetch(`${API_BASE_URL}/api/users/lookup?email=${encodeURIComponent(lookupEmail)}&_t=${timestamp}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Employee not found in Kintone.');
        throw new Error('Failed to communicate with the server.');
      }

      const emp = await response.json();
      
      // 1. Prioritize Postgres Database Role. Fallback to Kintone Designation mapping if new.
      let finalRole = '';
      if (emp.role && emp.role !== 'Unassigned') {
        finalRole = emp.role;
      } else {
        // Auto-map new users based on HR designation
        if (emp.designation === 'Division Manager') finalRole = 'Top Management';
        else if (emp.designation === 'Manager') finalRole = 'Manager';
        else if (emp.designation === 'Supervisor') finalRole = 'Supervisor';
      }

      // 2. Sync UI Checkboxes with the detected role
      const isAdmin = finalRole === 'Administrator';
      setForceAdmin(isAdmin);

      // 3. Department & Global Visibility Logic
      const rawKintoneDept = emp.department ? emp.department.trim() : '';
      const matchedDept = departments.find(d => d.toLowerCase() === rawKintoneDept.toLowerCase());
      const finalBaseDept = matchedDept || rawKintoneDept; 
      
      setOriginalDept(finalBaseDept); 

      // If they are Top Management OR already assigned GLOBAL in DB, force global view
      const isTopMgmt = finalRole === 'Top Management';
      const isAlreadyGlobal = emp.assignedDepartments && emp.assignedDepartments.includes('GLOBAL');
      const applyGlobal = isTopMgmt || isAlreadyGlobal;
      setForceGlobal(applyGlobal);

      const toTitleCase = (str) => {
        if (!str) return '';
        return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
      };

      // 4. Hydrate React Form State
      setFormData({
        id: null,
        email: lookupEmail,
        name: `${toTitleCase(emp.firstName)} ${toTitleCase(emp.lastName)}`.trim(),
        departments: applyGlobal ? ['GLOBAL'] : (emp.assignedDepartments?.length > 0 ? emp.assignedDepartments : (finalBaseDept ? [finalBaseDept] : [])),
        plant: emp.plant,
        role: finalRole,
        status: emp.status || 'Active'
      });
      
      setIsLookupSuccessful(true);
      addToast('Employee details retrieved successfully!', 'success');
      
      if (!finalRole) {
        addToast('Role not automatically recognized. Please assign manually.', 'info');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      addToast(errorMessage, 'error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    
    const finalRole = forceAdmin ? 'Administrator' : formData.role;

    if (formData.departments.length === 0) {
      addToast('Cannot save user without a department. Please check Kintone data.', 'error');
      return;
    }
    if (!finalRole) {
      addToast('User must have a mapped role or be assigned as Administrator.', 'error');
      return;
    }

    try {
      const url = isEditing ? `${API_BASE_URL}/api/users/${formData.id}` : `${API_BASE_URL}/api/users`;
      const method = isEditing ? 'PUT' : 'POST';

      const payload = { ...formData, role: finalRole };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Operation failed');
      
      const refreshResponse = await fetch(`${API_BASE_URL}/api/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsersList(await refreshResponse.json());

      addToast(`User ${formData.name} successfully ${isEditing ? 'updated' : 'created'}.`, 'success');
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      addToast('Failed to save user data', 'error');
    }
  };

  const initiateDelete = (targetUser) => {
    setUserToDelete(targetUser);
    setIsConfirmModalOpen(true);
  };

  const executeDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Deletion failed');
      setUsersList(prev => prev.filter(u => u.id !== userToDelete.id));
      addToast(`User ${userToDelete.name} has been removed from the system.`, 'info');
    } catch (error) {
      console.error('Error deleting user:', error); 
      addToast('Failed to delete user', 'error');
    } finally {
      setUserToDelete(null);
      setIsConfirmModalOpen(false);
    }
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    const userDepts = u.departments || (u.department ? [u.department] : []);
    const matchesDept = deptFilter === 'All' || userDepts.includes(deptFilter);
    return matchesSearch && matchesRole && matchesDept;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-8 h-8 border-4 border-brand-600 dark:border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="font-medium text-slate-500 dark:text-slate-400 text-sm">Loading User Directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-slate-50 dark:bg-slate-900 md:p-8 font-sans transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* Sleek Enterprise Header */}
        <div className="flex flex-col gap-4 pb-6 border-b md:flex-row md:items-end justify-between border-slate-200 dark:border-slate-800 transition-colors">
          <div>
            <h1 className="text-5xl font-display tracking-tight text-brand-500 dark:text-brand-400 flex items-center uppercase">
              USER MANAGEMENT
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Configure system access, roles, and departmental visibility.
            </p>
          </div>
          <button onClick={handleOpenAdd} className="flex items-center px-5 py-2.5 text-sm font-bold text-white transition-colors rounded-lg shadow-sm bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 hover:shadow">
            <UserPlus size={18} className="mr-2.5" /> Add New User
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col gap-5 p-5 bg-white dark:bg-slate-800 border rounded-xl shadow-sm md:flex-row md:items-end border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <div className="w-full md:flex-1">
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Search Users</label>
            <div className="relative">
              <Search size={16} className="absolute inset-y-0 left-0 flex items-center my-auto ml-3 text-slate-400 dark:text-slate-500 pointer-events-none transition-colors" />
              <input
                type="text"
                className="w-full py-2.5 pl-9 pr-3 text-sm transition-all border rounded-lg border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="w-full shrink-0 md:w-56">
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Role Filter</label>
            <select
              className="w-full px-3 py-2.5 text-sm transition-all border rounded-lg border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 appearance-none"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="All">All Roles</option>
              {roles.map(role => <option key={role} value={role}>{role}</option>)}
            </select>
          </div>

          <div className="w-full shrink-0 md:w-56">
            <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Department Filter</label>
            <select
              className="w-full px-3 py-2.5 text-sm transition-all border rounded-lg border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 appearance-none"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="All">All Departments</option>
              {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>
        </div>

        {/* User Directory Table */}
        <div className="overflow-hidden bg-white dark:bg-slate-800 border rounded-xl shadow-sm border-slate-200 dark:border-slate-700 transition-colors duration-300">
          <div className="flex items-center px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
            <div className="w-1.5 h-5 bg-brand-600 dark:bg-brand-500 rounded-full mr-3"></div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-colors">System Directory</h3>
            <span className="ml-4 px-2.5 py-0.5 rounded-md text-xs font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm text-slate-600 dark:text-slate-300 transition-colors">
              {filteredUsers.length} Users
            </span>
          </div>
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-slate-600 dark:text-slate-300 min-w-[1000px]">
              <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">
                <tr>
                  <th className="px-6 py-4 font-bold">Name & Email</th>
                  <th className="px-6 py-4 font-bold">Role</th>
                  <th className="px-6 py-4 font-bold">Plant</th>
                  <th className="px-6 py-4 font-bold min-w-[200px]">Assigned Department</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 transition-colors">
                {filteredUsers.map(u => {
                  const userDepts = u.departments || (u.department ? [u.department] : []);
                  return (
                    <tr key={u.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 text-base mb-0.5 transition-colors">{u.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors ${u.role === 'Administrator' ? 'bg-slate-800 dark:bg-slate-700 border-slate-700 dark:border-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 transition-colors">{u.plant || '--'}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {userDepts.length > 0 ? userDepts.map(d => (
                            <span key={d} className={`px-2.5 py-1 rounded-md text-xs font-bold border tracking-wide transition-colors ${d === 'GLOBAL' ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border-brand-200 dark:border-brand-800/50' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 shadow-sm'}`}>
                              {d}
                            </span>
                          )) : <span className="italic text-slate-400 dark:text-slate-500 text-xs transition-colors">None Assigned</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${u.status === 'Active' ? 'bg-jira-success-bg dark:bg-jira-success/20 text-jira-success border-jira-success/30 dark:border-jira-success/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => handleOpenEdit(u)} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 border border-transparent hover:border-brand-200 dark:hover:border-brand-800/50" title="Edit User">
                            <Edit size={18} />
                          </button>
                          <button onClick={() => initiateDelete(u)} disabled={u.id === user?.id} className="p-1.5 transition-colors rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 disabled:opacity-30 disabled:cursor-not-allowed" title="Delete User">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-16 font-medium text-center text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-slate-800/30 transition-colors">No users found matching your search criteria.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
          <div className="w-full max-w-2xl overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200 transition-colors">
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 transition-colors">
              <h3 className="flex items-center text-lg font-bold text-slate-900 dark:text-slate-100 transition-colors">
                {isEditing ? <Edit size={20} className="mr-2 text-brand-600 dark:text-brand-400"/> : <UserPlus size={20} className="mr-2 text-brand-600 dark:text-brand-400"/>}
                {isEditing ? 'Edit User Profile' : 'Link & Create New User'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8">
              {!isEditing && (
                <div className="flex gap-3 mb-8">
                  <div className="flex-1">
                    <input 
                      type="email" 
                      className="w-full px-4 py-2.5 text-sm font-medium border rounded-lg border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 transition-colors disabled:opacity-50"
                      value={lookupEmail} 
                      onChange={(e) => setLookupEmail(e.target.value)}
                      placeholder="Enter corporate email to fetch Kintone data..."
                      disabled={isLookingUp}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleLookup} 
                    disabled={isLookingUp || !lookupEmail}
                    className="flex items-center px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-slate-800 dark:bg-brand-600 hover:bg-slate-900 dark:hover:bg-brand-700 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {isLookingUp ? 'Searching...' : <><SearchCode size={18} className="mr-2" /> Lookup</>}
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmitForm} className={`space-y-6 ${!isLookupSuccessful && !isEditing ? 'opacity-40 pointer-events-none grayscale-[50%]' : 'opacity-100 transition-all duration-300'}`}>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Full Name</label>
                    <input 
                      type="text" disabled
                      className="w-full px-4 py-2.5 text-sm font-bold border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-300 cursor-not-allowed transition-colors"
                      value={formData.name || 'Awaiting synchronization...'} 
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Plant Location</label>
                    <input 
                      type="text" disabled
                      className="w-full px-4 py-2.5 text-sm font-bold border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-300 cursor-not-allowed transition-colors"
                      value={formData.plant || 'Awaiting synchronization...'} 
                    />
                  </div>
                </div>

                {/* RBAC Overrides */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className={`p-5 border rounded-xl transition-colors ${forceAdmin ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-800/50' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-700'}`}>
                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-5 h-5 mt-0.5 text-brand-600 dark:text-brand-500 border-brand-300 dark:border-brand-700 rounded focus:ring-brand-500 dark:focus:ring-brand-400 transition-colors bg-white dark:bg-slate-800"
                        checked={forceAdmin}
                        onChange={(e) => handleAdminToggle(e.target.checked)}
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">System Administrator</span>
                        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed transition-colors">Overrides operational role. Grants read/write access to User & Workflow Control.</span>
                      </div>
                    </label>
                  </div>
                  
                  <div className={`p-5 border rounded-xl transition-colors ${forceGlobal ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-200 dark:border-brand-800/50' : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-brand-200 dark:hover:border-brand-700'}`}>
                    <label className="flex items-start space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="w-5 h-5 mt-0.5 text-brand-600 dark:text-brand-500 border-brand-300 dark:border-brand-700 rounded focus:ring-brand-500 dark:focus:ring-brand-400 transition-colors bg-white dark:bg-slate-800"
                        checked={forceGlobal}
                        onChange={(e) => handleGlobalToggle(e.target.checked)}
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">Global Data Access</span>
                        <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 leading-relaxed transition-colors">Overrides single department. Grants read access to all company dashboards.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Mapped Portal Role</label>
                    <div className="flex items-center w-full px-4 py-2.5 text-sm font-bold border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 transition-colors">
                      {forceAdmin ? (
                        <><ShieldCheck size={18} className="mr-2.5 text-brand-600 dark:text-brand-400"/> Administrator</>
                      ) : formData.role ? (
                        <><CheckCircle2 size={18} className="mr-2.5 text-jira-success"/> {formData.role}</>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 font-medium">Pending...</span>
                      )}
                    </div>
                  </div>
                    
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Assigned Department</label>
                    <div className="flex items-center w-full px-4 py-2.5 text-sm font-bold border rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 transition-colors">
                       {formData.departments.length > 0 ? (
                         <span className={forceGlobal ? 'text-brand-600 dark:text-brand-400' : 'text-slate-800 dark:text-slate-200'}>
                           {formData.departments.join(', ')}
                         </span>
                       ) : (
                         <span className="text-slate-400 dark:text-slate-500 font-medium">Pending...</span>
                       )}
                    </div>
                  </div>
                </div>

                {isEditing && (
                  <div>
                    <label className="block mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors">Account Status</label>
                    <select 
                      className="w-full px-4 py-2.5 text-sm font-semibold border rounded-lg border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-600 dark:focus:ring-brand-500 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 transition-colors"
                      value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="Active">Active / Permitted</option>
                      <option value="Deactivated">Deactivated / Blocked</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end pt-6 mt-8 space-x-3 border-t border-slate-100 dark:border-slate-700 transition-colors">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold bg-white dark:bg-slate-800 border rounded-lg text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={!isLookupSuccessful} className="px-5 py-2.5 text-sm font-bold text-white rounded-lg bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                    {isEditing ? 'Save Configuration' : 'Provision User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeDelete}
        title="Revoke User Access"
        message={`Are you absolutely sure you want to permanently delete the portal account for ${userToDelete?.name}? This action cannot be undone.`}
        confirmText="Revoke Access"
        isDestructive={true}
      />
    </div>
  );
};

export default UserManagementPage;