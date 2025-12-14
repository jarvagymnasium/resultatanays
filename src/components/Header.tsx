'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import type { TabId } from '@/lib/types';

// Main navigation tabs (shown directly in nav bar)
const MAIN_TABS: { id: TabId; label: string; icon: string; permission?: string }[] = [
  { id: 'warnings', label: 'F-varningar', icon: '⚠️' },
  { id: 'progress', label: 'Utveckling', icon: '📈' },
  { id: 'grades', label: 'Betyg', icon: '📝', permission: 'manage_grades' },
];

// Register dropdown items
const REGISTER_TABS: { id: TabId; label: string; icon: string; permission?: string }[] = [
  { id: 'students', label: 'Elever', icon: '👥', permission: 'manage_students' },
  { id: 'courses', label: 'Kurser', icon: '📚', permission: 'manage_courses' },
  { id: 'classes', label: 'Klasser', icon: '🏫', permission: 'manage_classes' },
];

// Historik dropdown items
const HISTORIK_TABS: { id: TabId; label: string; icon: string; permission?: string }[] = [
  { id: 'quarters', label: 'Kvartal', icon: '📅', permission: 'manage_quarters' },
  { id: 'archive', label: 'Arkiv', icon: '🗄️', permission: 'manage_students' },
  { id: 'compare', label: 'Jämför', icon: '⚖️' },
  { id: 'snapshots', label: 'Snapshots', icon: '📸' },
];

export default function Header() {
  const { 
    user, 
    userRole, 
    activeTab, 
    activeQuarter,
    setActiveTab, 
    logout,
    userCan
  } = useAppStore();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showRegisterMenu, setShowRegisterMenu] = useState(false);
  const [showHistorikMenu, setShowHistorikMenu] = useState(false);
  const [registerDropdownPos, setRegisterDropdownPos] = useState({ top: 0, left: 0 });
  const [historikDropdownPos, setHistorikDropdownPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const registerMenuRef = useRef<HTMLDivElement>(null);
  const historikBtnRef = useRef<HTMLButtonElement>(null);
  const historikMenuRef = useRef<HTMLDivElement>(null);

  // Client-side only mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close Register menu
      if (registerMenuRef.current && !registerMenuRef.current.contains(event.target as Node) &&
          registerBtnRef.current && !registerBtnRef.current.contains(event.target as Node)) {
        setShowRegisterMenu(false);
      }
      // Close Historik menu
      if (historikMenuRef.current && !historikMenuRef.current.contains(event.target as Node) &&
          historikBtnRef.current && !historikBtnRef.current.contains(event.target as Node)) {
        setShowHistorikMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate dropdown position when opening Register
  const handleRegisterClick = () => {
    if (!showRegisterMenu && registerBtnRef.current) {
      const rect = registerBtnRef.current.getBoundingClientRect();
      setRegisterDropdownPos({
        top: rect.bottom + 8,
        left: Math.max(10, rect.left + (rect.width / 2) - 90)
      });
    }
    setShowRegisterMenu(!showRegisterMenu);
    setShowHistorikMenu(false); // Close other dropdown
  };

  // Calculate dropdown position when opening Historik
  const handleHistorikClick = () => {
    if (!showHistorikMenu && historikBtnRef.current) {
      const rect = historikBtnRef.current.getBoundingClientRect();
      setHistorikDropdownPos({
        top: rect.bottom + 8,
        left: Math.max(10, rect.left + (rect.width / 2) - 90)
      });
    }
    setShowHistorikMenu(!showHistorikMenu);
    setShowRegisterMenu(false); // Close other dropdown
  };

  const getUserInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleConfig = () => {
    switch (userRole) {
      case 'admin': return { color: 'from-rose-500 to-pink-600', label: 'Admin', icon: '👑' };
      case 'teacher': return { color: 'from-blue-500 to-indigo-600', label: 'Lärare', icon: '👨‍🏫' };
      default: return { color: 'from-emerald-500 to-teal-600', label: 'Analytiker', icon: '📊' };
    }
  };

  const visibleMainTabs = MAIN_TABS.filter(tab => {
    if (!tab.permission) return true;
    return userCan(tab.permission as 'view_data' | 'manage_classes' | 'manage_courses' | 'manage_students' | 'manage_grades' | 'manage_quarters');
  });

  const visibleRegisterTabs = REGISTER_TABS.filter(tab => {
    if (!tab.permission) return true;
    return userCan(tab.permission as 'view_data' | 'manage_classes' | 'manage_courses' | 'manage_students' | 'manage_grades' | 'manage_quarters');
  });

  const visibleHistorikTabs = HISTORIK_TABS.filter(tab => {
    if (!tab.permission) return true;
    return userCan(tab.permission as 'view_data' | 'manage_classes' | 'manage_courses' | 'manage_students' | 'manage_grades' | 'manage_quarters');
  });

  const isRegisterTabActive = REGISTER_TABS.some(tab => tab.id === activeTab);
  const isHistorikTabActive = HISTORIK_TABS.some(tab => tab.id === activeTab);
  const showRegister = visibleRegisterTabs.length > 0;
  const showHistorik = visibleHistorikTabs.length > 0;

  const roleConfig = getRoleConfig();

  return (
    <header className="header-wrapper">
      {/* Animated background */}
      <div className="header-bg">
        <div className="header-gradient"></div>
        <div className="header-mesh"></div>
        <div className="header-glow"></div>
      </div>
      
      <div className="header-content">
        {/* Top bar */}
        <div className="header-top">
          {/* Logo */}
          <div className="header-logo group">
            <div className="logo-mark">
              <span className="logo-icon">📊</span>
              <div className="logo-ring"></div>
            </div>
            <div className="logo-text">
              <span className="logo-school">Järva Gymnasium</span>
              <span className="logo-app">Resultatanalys</span>
            </div>
          </div>

          {/* Right side */}
          <div className="header-actions">
            {/* Quarter badge */}
            {activeQuarter && (
              <div className="quarter-badge">
                <span className="quarter-dot"></span>
                <span className="quarter-label">Kvartal</span>
                <span className="quarter-name">{activeQuarter.name}</span>
              </div>
            )}

            {/* User menu */}
            <div className="relative">
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="user-btn"
              >
                <div className="user-avatar-wrapper">
                  <div className={`user-avatar-ring bg-gradient-to-br ${roleConfig.color}`}></div>
                  <div className="user-avatar-inner">
                    {user?.email ? getUserInitials(user.email) : '?'}
                  </div>
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.email?.split('@')[0] || 'Användare'}</span>
                  <span className="user-role">
                    <span>{roleConfig.icon}</span>
                    <span>{roleConfig.label}</span>
                  </span>
                </div>
                <svg className={`user-chevron ${showUserMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                  <div className="user-dropdown">
                    <div className="user-dropdown-header">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${roleConfig.color} flex items-center justify-center text-white font-bold`}>
                        {user?.email ? getUserInitials(user.email) : '?'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{user?.email?.split('@')[0]}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[180px]">{user?.email}</div>
                      </div>
                    </div>
                    <div className="user-dropdown-divider"></div>
                    <button onClick={logout} className="user-dropdown-item user-dropdown-logout">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logga ut
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="header-nav">
          <div className="nav-track">
            {/* Main tabs: F-varningar, Utveckling, Betyg */}
            {visibleMainTabs.map((tab, index) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
                style={{ '--tab-index': index } as React.CSSProperties}
              >
                <span className="nav-tab-icon">{tab.icon}</span>
                <span className="nav-tab-label">{tab.label}</span>
                {activeTab === tab.id && <span className="nav-tab-indicator"></span>}
              </button>
            ))}

            {/* Register dropdown */}
            {showRegister && (
              <>
                <button
                  ref={registerBtnRef}
                  onClick={handleRegisterClick}
                  className={`nav-tab nav-tab-dropdown ${isRegisterTabActive ? 'nav-tab-active' : ''}`}
                  style={{ '--tab-index': visibleMainTabs.length } as React.CSSProperties}
                >
                  <span className="nav-tab-icon">📋</span>
                  <span className="nav-tab-label">Register</span>
                  <svg 
                    className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${showRegisterMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {isRegisterTabActive && <span className="nav-tab-indicator"></span>}
                </button>

                {/* Register dropdown menu - rendered via portal */}
                {showRegisterMenu && mounted && createPortal(
                  <div 
                    ref={registerMenuRef}
                    className="register-dropdown"
                    style={{ top: registerDropdownPos.top, left: registerDropdownPos.left }}
                  >
                    {visibleRegisterTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowRegisterMenu(false);
                        }}
                        className={`register-dropdown-item ${activeTab === tab.id ? 'register-dropdown-item-active' : ''}`}
                      >
                        <span className="text-base">{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </>
            )}

            {/* Historik dropdown */}
            {showHistorik && (
              <>
                <button
                  ref={historikBtnRef}
                  onClick={handleHistorikClick}
                  className={`nav-tab nav-tab-dropdown ${isHistorikTabActive ? 'nav-tab-active' : ''}`}
                  style={{ '--tab-index': visibleMainTabs.length + 1 } as React.CSSProperties}
                >
                  <span className="nav-tab-icon">📜</span>
                  <span className="nav-tab-label">Historik</span>
                  <svg 
                    className={`w-3.5 h-3.5 ml-1 transition-transform duration-200 ${showHistorikMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {isHistorikTabActive && <span className="nav-tab-indicator"></span>}
                </button>

                {/* Historik dropdown menu - rendered via portal */}
                {showHistorikMenu && mounted && createPortal(
                  <div 
                    ref={historikMenuRef}
                    className="register-dropdown"
                    style={{ top: historikDropdownPos.top, left: historikDropdownPos.left }}
                  >
                    {visibleHistorikTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowHistorikMenu(false);
                        }}
                        className={`register-dropdown-item ${activeTab === tab.id ? 'register-dropdown-item-active' : ''}`}
                      >
                        <span className="text-base">{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
