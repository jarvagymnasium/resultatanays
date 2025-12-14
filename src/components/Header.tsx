'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import type { TabId } from '@/lib/types';

// Main navigation tabs (excluding Register items)
const MAIN_TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'warnings', label: 'F-varningar' },
  { id: 'progress', label: 'Utveckling' },
  { id: 'grades', label: 'Betyg', permission: 'manage_grades' },
  { id: 'quarters', label: 'Kvartal', permission: 'manage_quarters' },
  { id: 'archive', label: 'Arkiv', permission: 'manage_students' },
  { id: 'compare', label: 'Jämför' },
  { id: 'snapshots', label: 'Snapshots' },
];

// Register dropdown items
const REGISTER_TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'students', label: 'Elever', permission: 'manage_students' },
  { id: 'courses', label: 'Kurser', permission: 'manage_courses' },
  { id: 'classes', label: 'Klasser', permission: 'manage_classes' },
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const registerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (registerMenuRef.current && !registerMenuRef.current.contains(event.target as Node) &&
          registerBtnRef.current && !registerBtnRef.current.contains(event.target as Node)) {
        setShowRegisterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRegisterClick = () => {
    if (!showRegisterMenu && registerBtnRef.current) {
      const rect = registerBtnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        left: Math.max(10, rect.left + (rect.width / 2) - 80)
      });
    }
    setShowRegisterMenu(!showRegisterMenu);
  };

  const getUserInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'admin': return 'Admin';
      case 'teacher': return 'Lärare';
      default: return 'Analytiker';
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

  const isRegisterTabActive = REGISTER_TABS.some(tab => tab.id === activeTab);
  const showRegister = visibleRegisterTabs.length > 0;

  return (
    <header className="header-wrapper">
      <div className="header-content">
        {/* Top bar */}
        <div className="header-top">
          {/* Logo */}
          <div className="header-logo">
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
                  <div className="user-avatar-inner">
                    {user?.email ? getUserInitials(user.email) : '?'}
                  </div>
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.email?.split('@')[0] || 'Användare'}</span>
                  <span className="user-role">{getRoleLabel()}</span>
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
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-semibold">
                        {user?.email ? getUserInitials(user.email) : '?'}
                      </div>
                      <div>
                        <div className="font-medium text-[var(--color-text)] text-sm">{user?.email?.split('@')[0]}</div>
                        <div className="text-xs text-[var(--color-text-muted)] truncate max-w-[160px]">{user?.email}</div>
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
            {/* First two main tabs */}
            {visibleMainTabs.slice(0, 2).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
              >
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
                >
                  <span className="nav-tab-label">Register</span>
                  <svg 
                    className={`w-3 h-3 transition-transform duration-150 ${showRegisterMenu ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {isRegisterTabActive && <span className="nav-tab-indicator"></span>}
                </button>

                {/* Register dropdown menu */}
                {showRegisterMenu && mounted && createPortal(
                  <div 
                    ref={registerMenuRef}
                    className="register-dropdown"
                    style={{ top: dropdownPos.top, left: dropdownPos.left }}
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
                        {tab.label}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}
              </>
            )}

            {/* Remaining main tabs */}
            {visibleMainTabs.slice(2).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
              >
                <span className="nav-tab-label">{tab.label}</span>
                {activeTab === tab.id && <span className="nav-tab-indicator"></span>}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
