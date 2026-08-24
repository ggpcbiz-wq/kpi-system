/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react';
import { useToast } from './ToastContext'; 
import { API_BASE_URL } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { addToast } = useToast();

  // FIX 1: Lazy Initialization. 
  // React reads localStorage exactly once during the initial load. No useEffect needed!
  const [token, setToken] = useState(() => localStorage.getItem('app_token') || null);
  
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('app_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Since we initialize synchronously now, loading is instantly false.
  const [isLoading, setIsLoading] = useState(false);

  const loginWithGoogle = async (googleCredential) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: googleCredential }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      setToken(data.token);
      setUser(data.user);
      
      localStorage.setItem('app_token', data.token);
      localStorage.setItem('app_user', JSON.stringify(data.user));

      if (addToast) addToast(`Welcome back, ${data.user.name}!`, 'success');
      
    } catch (error) {
      console.error('Login Error:', error);
      if (addToast) addToast(error.message, 'error');
      throw error; 
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('app_token');
    localStorage.removeItem('app_user');
    if (addToast) addToast('You have been securely logged out.', 'info');
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);