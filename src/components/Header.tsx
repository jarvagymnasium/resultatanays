'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '@/lib/store';
import type { TabId } from '@/lib/types';

// Main navigation tabs (shown directly in header)
const MAIN_TABS: { id: TabId; label: string; icon?: string; permission?: string }[] = [
  { id: 'warnings', label: 'Overview', icon: '⚡' },
  { id: 'progress', label: 'Utveckling', icon: '📈' },
  { id: 'grades', label: 'Betyg', permission: 'manage_grades' },
];

// Register submenu tabs
const REGISTER_TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'students', label: 'Elever', permission: 'manage_students' },
  { id: 'courses', label: 'Kurser', permission: 'manage_courses' },
  { id: 'classes', label: 'Klasser', permission: 'manage_classes' },
];

// Statistik submenu tabs
const STATISTIK_TABS: { id: TabId; label: string; permission?: string }[] = [
  { id: 'quarters', label: 'Kvartal', permission: 'manage_quarters' },
  { id: 'archive', label: 'Arkiv', permission: 'manage_students' },
  { id: 'compare', label: 'Jämför' },
  { id: 'snapshots', label: 'Snapshots' },
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
  const [showStatistikMenu, setShowStatistikMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [registerDropdownPos, setRegisterDropdownPos] = useState({ top: 0, left: 0 });
  const [statistikDropdownPos, setStatistikDropdownPos] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  
  const registerBtnRef = useRef<HTMLButtonElement>(null);
  const registerMenuRef = useRef<HTMLDivElement>(null);
  const statistikBtnRef = useRef<HTMLButtonElement>(null);
  const statistikMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (registerMenuRef.current && !registerMenuRef.current.contains(event.target as Node) &&
          registerBtnRef.current && !registerBtnRef.current.contains(event.target as Node)) {
        setShowRegisterMenu(false);
      }
      if (statistikMenuRef.current && !statistikMenuRef.current.contains(event.target as Node) &&
          statistikBtnRef.current && !statistikBtnRef.current.contains(event.target as Node)) {
        setShowStatistikMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRegisterClick = () => {
    if (!showRegisterMenu && registerBtnRef.current) {
      const rect = registerBtnRef.current.getBoundingClientRect();
      setRegisterDropdownPos({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowRegisterMenu(!showRegisterMenu);
    setShowStatistikMenu(false);
  };

  const handleStatistikClick = () => {
    if (!showStatistikMenu && statistikBtnRef.current) {
      const rect = statistikBtnRef.current.getBoundingClientRect();
      setStatistikDropdownPos({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
    setShowStatistikMenu(!showStatistikMenu);
    setShowRegisterMenu(false);
  };

  const getUserInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return email.substring(0, 2).toUpperCase();
  };

  const visibleMainTabs = MAIN_TABS.filter(tab => !tab.permission || userCan(tab.permission as any));
  const visibleRegisterTabs = REGISTER_TABS.filter(tab => !tab.permission || userCan(tab.permission as any));
  const visibleStatistikTabs = STATISTIK_TABS.filter(tab => !tab.permission || userCan(tab.permission as any));
  const isRegisterTabActive = REGISTER_TABS.some(tab => tab.id === activeTab);
  const isStatistikTabActive = STATISTIK_TABS.some(tab => tab.id === activeTab);

  // All tabs for mobile menu
  const allTabs = [
    ...visibleMainTabs,
    ...visibleRegisterTabs,
    ...visibleStatistikTabs
  ];

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

          {/* Separator - Desktop only */}
          <div className="h-6 w-px bg-[var(--border-subtle)] hidden lg:block"></div>

          {/* Navigation - Desktop */}
          <nav className="hidden lg:flex items-center gap-1">
            {visibleMainTabs.map((tab) => (
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

            {/* Statistik Dropdown Trigger */}
            {visibleStatistikTabs.length > 0 && (
              <button
                ref={statistikBtnRef}
                onClick={handleStatistikClick}
                className={`nav-tab flex items-center gap-1 ${isStatistikTabActive ? 'nav-tab-active' : ''}`}
              >
                Statistik
                <svg className={`w-3.5 h-3.5 transition-transform ${showStatistikMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            )}
          </nav>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* Quarter Indicator - Pill Style */}
          {activeQuarter && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {activeQuarter.name}
              </span>
            </div>
          )}

          {/* User Profile - Desktop */}
          <div className="relative hidden lg:block">
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

          {/* Hamburger Menu Button - Mobile/Tablet */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
            aria-label="Öppna meny"
          >
            {showMobileMenu ? (
              <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="lg:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <nav className="p-4 space-y-1">
            {/* Main Tabs */}
            <div className="text-xs font-semibold text-[var(--text-tertiary)] px-3 py-2 uppercase tracking-wider">
              Navigation
            </div>
            {visibleMainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setShowMobileMenu(false);
                }}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] font-medium' 
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.icon && <span className="opacity-70">{tab.icon}</span>}
                {tab.label}
              </button>
            ))}

            {/* Register Section */}
            {visibleRegisterTabs.length > 0 && (
              <>
                <div className="text-xs font-semibold text-[var(--text-tertiary)] px-3 py-2 uppercase tracking-wider mt-4">
                  Register
                </div>
                {visibleRegisterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] font-medium' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </>
            )}

            {/* Statistik Section */}
            {visibleStatistikTabs.length > 0 && (
              <>
                <div className="text-xs font-semibold text-[var(--text-tertiary)] px-3 py-2 uppercase tracking-wider mt-4">
                  Statistik
                </div>
                {visibleStatistikTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id 
                        ? 'bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] font-medium' 
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </>
            )}

            {/* User Section */}
            <div className="border-t border-[var(--border-subtle)] mt-4 pt-4">
              <div className="px-3 py-2 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center text-[var(--color-primary-dark)] text-sm font-bold">
                  {user?.email ? getUserInitials(user.email) : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user?.email}</p>
                  <p className="text-xs text-[var(--text-tertiary)] capitalize">{userRole || 'User'}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  logout();
                  setShowMobileMenu(false);
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 mt-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logga ut
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Register Dropdown Portal - Desktop */}
      {showRegisterMenu && mounted && createPortal(
        <div 
          ref={registerMenuRef}
          className="fixed z-[2000] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-1 min-w-[200px] animate-enter"
          style={{ top: registerDropdownPos.top, left: registerDropdownPos.left }}
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

      {/* Statistik Dropdown Portal - Desktop */}
      {showStatistikMenu && mounted && createPortal(
        <div 
          ref={statistikMenuRef}
          className="fixed z-[2000] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl shadow-xl p-1 min-w-[200px] animate-enter"
          style={{ top: statistikDropdownPos.top, left: statistikDropdownPos.left }}
        >
          <div className="text-xs font-semibold text-[var(--text-tertiary)] px-3 py-2 uppercase tracking-wider">
            Statistik & Historik
          </div>
          {visibleStatistikTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setShowStatistikMenu(false);
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
