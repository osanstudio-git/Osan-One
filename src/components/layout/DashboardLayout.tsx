import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, LayoutDashboard, Menu, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../common/ThemeToggle';
import { OsanLogo } from '../common/OsanLogo';
import { getSavedLocalAvatar, invalidateEmployeeCache, invalidateCompanyCache } from '../../lib/databaseService';

interface DashboardLayoutProps {
  children?: ReactNode;
  title?: string;
  links?: { label: string; path: string; icon: any }[];
}

export function DashboardLayout({ children, title, links }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1280;
    }
    return false;
  });

  const handleHardRefresh = async () => {
    setIsSyncing(true);
    try {
      invalidateEmployeeCache();
      invalidateCompanyCache();

      // Clear Service Worker Caches
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      }

      // Update Service Worker registration
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }

      setTimeout(() => {
        window.location.reload();
      }, 350);
    } catch (e) {
      console.warn('Hard refresh error:', e);
      window.location.reload();
    }
  };

  // Responsive sidebar auto-collapse for tablets (< 1280px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Infer title from active link if not explicitly provided
  const activeLink = links?.find(l => location.pathname === l.path || location.pathname.startsWith(l.path + '/'));
  const displayTitle = title || activeLink?.label || 'Dashboard';

  return (
    <div className="h-[100dvh] bg-slate-50 dark:bg-background text-slate-900 dark:text-white flex overflow-hidden transition-colors duration-300">
      {/* 1. Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* 2. Mobile Drawer Navigation (< lg screens) */}
      <aside
        className={`fixed inset-y-0 left-0 w-[280px] max-w-[85vw] bg-white dark:bg-slate-900 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:hidden border-r border-slate-200 dark:border-white/10 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 dark:border-white/10">
          <OsanLogo size="sm" />
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Navigation Links */}
        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
            Main Menu
          </div>

          {links ? (
            links.map(link => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })
          ) : (
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl bg-primary/10 text-primary font-semibold text-sm">
              <LayoutDashboard className="w-5 h-5 text-primary shrink-0" />
              <span>{displayTitle}</span>
            </div>
          )}
        </div>

        {/* Drawer Footer User Profile */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shadow-xs shrink-0 text-sm overflow-hidden">
              {(profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : undefined)) ? (
                <img
                  src={profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : '')}
                  alt={profile?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.name?.charAt(0) || 'U'
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {profile?.name || 'User'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                {profile?.role || 'Role'}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              signOut();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/10 transition-colors text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* 3. Desktop / Tablet Docked Sidebar (>= lg screens) */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 transition-all duration-300 ease-in-out shrink-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5 h-20">
          {!isCollapsed && <OsanLogo size="sm" />}
          {isCollapsed && (
            <div className="mx-auto w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
              O
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <div className="px-3 py-5 flex-1 flex flex-col gap-1.5 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-1">
              Main Menu
            </div>
          )}

          {links ? (
            links.map(link => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.path}
                  to={link.path}
                  title={isCollapsed ? link.label : undefined}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all ${
                    isCollapsed ? 'justify-center' : ''
                  } ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{link.label}</span>}
                </NavLink>
              );
            })
          ) : (
            <div className={`flex items-center gap-3 px-3 py-3 rounded-xl bg-primary/10 text-primary font-semibold ${isCollapsed ? 'justify-center' : ''}`}>
              <LayoutDashboard className="w-5 h-5 text-primary shrink-0" />
              {!isCollapsed && <span className="truncate">{displayTitle}</span>}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-200 dark:border-white/5">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 mb-3 px-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 dark:bg-white/10 dark:border-white/10 flex items-center justify-center font-bold text-slate-800 dark:text-white shadow-xs shrink-0 text-sm overflow-hidden">
                  {(profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : undefined)) ? (
                    <img
                      src={profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : '')}
                      alt={profile?.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile?.name?.charAt(0) || 'U'
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                    {profile?.name || 'User'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate">
                    {profile?.role || 'Role'}
                  </span>
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors text-xs font-medium border border-slate-200/80 dark:border-transparent cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={signOut}
              title="Sign Out"
              className="w-full flex items-center justify-center py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* 4. Main Content Area */}
      <main className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-slate-50 dark:bg-background transition-colors duration-300 min-w-0">
        {/* Responsive Header Bar */}
        <header className="h-16 lg:h-20 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 backdrop-blur-md flex items-center justify-between px-3.5 sm:px-6 lg:px-8 shrink-0 transition-colors duration-300 z-10">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            {/* Mobile Hamburger Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white truncate">
              {displayTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* 1-Tap Hard Refresh & Cloud Sync button */}
            <button
              type="button"
              onClick={handleHardRefresh}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Hard Refresh & Cloud Sync: Bypasses tablet cache and reloads live cloud data"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            <ThemeToggle />
          </div>
        </header>

        {/* Dynamic Responsive Viewport Container */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 md:p-6 lg:p-8 relative bg-slate-50 dark:bg-background transition-colors duration-300">
          <div className="max-w-7xl mx-auto w-full">
            {children || <Outlet />}
          </div>
        </div>
      </main>
    </div>
  );
}
