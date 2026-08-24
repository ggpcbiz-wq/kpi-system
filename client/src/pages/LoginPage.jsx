import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle } from 'lucide-react';

// Import your logo here
import logoStacked from '../assets/gunma gohkin logo.png'; 

const LoginPage = () => {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  
  const isGoogleInitialized = useRef(false);

  // Automatically route the user based on their role the moment they are logged in
  useEffect(() => {
    if (user) {
      switch (user.role) {
        case 'Administrator':
          navigate('/admin');
          break;
        case 'Top Management':
          navigate('/top-management');
          break;
        case 'Manager':
          navigate('/manager');
          break;
        case 'Supervisor':
          navigate('/supervisor');
          break;
        default:
          navigate('/overview');
      }
    }
  }, [user, navigate]);

  const handleGoogleLogin = async (response) => {
    try {
      setError('');
      
      if (!response || !response.credential) {
        setError("Google blocked the sign-in window. Please check your browser settings.");
        return;
      }

      await loginWithGoogle(response.credential);
      
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.message || 'Failed to authenticate with Google. Please try again.');
    }
  };

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && !isGoogleInitialized.current) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID, 
          callback: handleGoogleLogin
        });

        window.google.accounts.id.renderButton(
          document.getElementById("signInDiv"),
          // Scaled up button width to match the new larger card
          { theme: "outline", size: "large", shape: "rectangular", text: "continue_with", width: "360" }
        );
        
        isGoogleInitialized.current = true;
      }
    };

    if (window.google) {
      initializeGoogleSignIn();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleSignIn;
      document.body.appendChild(script);

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col justify-center items-center p-4 font-sans">
      
      {/* Background Blobs (Updated to Blue/Sky palette) */}
      <div className="absolute top-1/4 left-1/4 w-md h-112 bg-blue-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>
      <div className="absolute bottom-1/4 right-1/4 w-md h-112 bg-sky-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70"></div>

      {/* Main Authentication Card (Scaled up max-w and padding, changed to blue border) */}
      <div className="relative z-10 w-full max-w-120 bg-white rounded-lg shadow-2xl shadow-slate-200/50 border border-slate-100 border-t-4 border-t-blue-600 p-12 flex flex-col items-center">
        
        {/* Logo & Title (Scaled up) */}
        <img 
          src={logoStacked} 
          alt="Company Logo" 
          className="h-20 object-contain mb-6"
        />
        
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-10 text-center">
          KPI Management System
        </h1>

        {/* Form Area (Scaled typography) */}
        <div className="w-full flex flex-col items-start">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Log in</h2>
          
          <p className="text-base text-slate-500 mb-8 leading-relaxed">
            Authentication is restricted to authorized corporate Google Workspace accounts.
          </p>

          {error && (
            <div className="w-full mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm flex items-start">
              <AlertCircle size={18} className="mr-2 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google SSO Injection Point */}
          <div className="w-full flex justify-center bg-slate-50 py-5 rounded border border-slate-200">
            <div id="signInDiv" className="min-h-11"></div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="relative z-10 mt-10 text-center">
         <p className="text-sm font-medium text-slate-400">
           &copy; {new Date().getFullYear()} Gunma Gohkin Philippines Corp. All Rights Reserved
         </p>
      </div>

    </div>
  );
};

export default LoginPage;