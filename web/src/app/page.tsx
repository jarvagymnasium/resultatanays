'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import LoginScreen from '@/components/LoginScreen';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  const { isAuthenticated, isLoading, checkSession } = useAppStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Show loading spinner while checking session
  if (isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#624c9a] via-[#4a3a7a] to-[#e72c81]">
        <div className="text-center text-white">
          <div className="spinner w-12 h-12 mx-auto mb-4 border-white/20 border-l-white"></div>
          <p>Laddar...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Show dashboard
  return <Dashboard />;
}
