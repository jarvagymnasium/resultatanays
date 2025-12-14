'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import type { TabId } from '@/lib/types';

// Main navigation tabs
const MAIN_TABS: { id: TabId; label: string; icon?: string; permission?: string }[] = [
  { id: 'warnings', label: 'Overview', icon: '⚡' },
  { id: 'progress', label: 'Utveckling', icon: '📈' },
  { id: 'grades', label: 'Betyg', permission: 'manage_grades' },
  { id: 'quarters', label: 'Kvartal', permission: 'manage_quarters' },
  { id: 'archive', label: 'Arkiv', permission: 'manage_students' },
  { id: 'compare', label: 'Jämför' },
  { id: 'snapshots', label: 'Snapshots' },
];

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

  useEffect(() => { setMounted(true); }, []);

  // Close menus on click outside
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
        left: rect.left
      });
    }
    setShowRegisterMenu(!showRegisterMenu);
  };

  const getUserInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.substring(0, 2).toUpperCase();
  };

  const visibleMainTabs = MAIN_TABS.filter(tab => !tab.permission || userCan(tab.permission as any));
  const visibleRegisterTabs = REGISTER_TABS.filter(tab => !tab.permission || userCan(tab.permission as any));
  const isRegisterTabActive = REGISTER_TABS.some(tab => tab.id === activeTab);

  return (
    <header className="header-wrapper">
      <div className="header-content">
        {/* Left: Brand & Main Nav */}
        <div className="flex items-center gap-8">
          {/* Brand */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/30">
              J
            </div>
            <div className="flex flex-col">
              <span className="text-[0.95rem] font-bold tracking-tight text-[var(--text-primary)] leading-tight">
                Resultatanalys
              </span>
              <span className="text-[0.7rem] font-medium text-[var(--text-tertiary)] tracking-wide uppercase">
                Järva Gymnasium
              </span>
            </div>
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-[var(--border-subtle)] hidden md:block"></div>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleMainTabs.slice(0, 3).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
              >
                {tab.icon && <span className="mr-1.5 opacity-70">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}

            {/* Register Dropdown Trigger */}
            {visibleRegisterTabs.length > 0 && (
              <button
                ref={registerBtnRef}
                onClick={handleRegisterClick}
                className={`nav-tab flex items-center gap-1 ${isRegisterTabActive ? 'nav-tab-active' : ''}`}
              >
                Register
                <svg className={`w-3.5 h-3.5 transition-transform ${showRegisterMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}

            {visibleMainTabs.slice(3).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-4">
          {/* Quarter Indicator - Pill Style */}
          {activeQuarter && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {activeQuarter.name}
              </span>
            </div>
          )}

          {/* User Profile */}
          <div className="relative">
            <button 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-[var(--bg-hover)] transition-colors border border-transparent hover:border-[var(--border-subtle)]"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary-dark)] text-xs font-bold border border-[var(--color-primary-light)]/20">
                {user?.email ? getUserInitials(user.email) : '?'}
              </div>
              <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
                <div className="absolute right-0 top-full mt-2 w-64 p-1 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl z-50 animate-enter">
                  <div className="p-3 border-b border-[var(--border-subtle)] mb-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{user?.email}</p>
                    <p className="text-xs text-[var(--text-tertiary)] capitalize">{userRole || 'User'}</p>
                  </div>
                  <button 
                    onClick={logout}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Register Dropdown Portal */}
      {showRegisterMenu && mounted && createPortal(
        <div 
          ref={registerMenuRef}
          className="fixed z-[2000] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-1 min-w-[200px] animate-enter"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className="text-xs font-semibold text-[var(--text-tertiary)] px-3 py-2 uppercase tracking-wider">
            Registerhantering
          </div>
          {visibleRegisterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowRegisterMenu(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                activeTab === tab.id 
                  ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] font-medium' 
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </header>
  );
}
