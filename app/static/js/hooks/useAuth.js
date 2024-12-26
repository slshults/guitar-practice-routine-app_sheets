// hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSpreadsheetAccess, setHasSpreadsheetAccess] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/status');
      if (!response.ok) throw new Error('Auth check failed');
      const data = await response.json();
      console.log('Auth status:', data); // For debugging
      setIsAuthenticated(data.authenticated);
      setHasSpreadsheetAccess(data.hasSpreadsheetAccess);
      setError(null);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setHasSpreadsheetAccess(false);
      setError(error.message);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check auth status immediately
    checkAuth();
    
    // Set up periodic checks every 5 minutes
    const interval = setInterval(checkAuth, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkAuth]);

  const handleLogin = () => {
    window.location.href = '/authorize';
  };

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  return {
    isAuthenticated,
    hasSpreadsheetAccess,
    checking,
    error,
    handleLogin,
    handleLogout,
    checkAuth
  };
};
