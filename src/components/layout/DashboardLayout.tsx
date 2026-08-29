import type { ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ThemeToggle } from '../common/ThemeToggle';

import { OsanLogo } from '../common/OsanLogo';

interface DashboardLayoutProps {
  children?: ReactNode;
  title?: string;
  links?: { label: string; path: string; icon: any }[];
}

export function DashboardLayout({ children, title, links }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  // Infer title from active link if not explicitly provided
  const activeLink = links?.find(l => location.pathname === l.path || location.pathname.startsWith(l.path + '/'));
  const displayTitle = title || activeLink?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-white flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white dark:bg-slate-900/60 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 flex flex-col transition-colors duration-300">
        <div className="p-6 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
          <OsanLogo size="sm" />
        </div>

        <div className="px-4 py-6 flex-1 flex flex-col gap-2">
          <div className="px-3 py-2 text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider mb-2">
            Main Menu
          </div>
          
          {links ? (
            links.map(link => {
              const Icon = link.icon;
              return (
                <NavLink 
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-colors ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-sm' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </NavLink>
              );
            })
          ) : (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-primary/10 text-primary font-semibold">
              <LayoutDashboard className="w-5 h-5 text-primary" />
              {displayTitle}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 dark:bg-white/10 dark:border-white/10 flex items-center justify-center font-bold text-slate-800 dark:text-white shadow-sm">
              {profile?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-slate-900 dark:text-white">{profile?.name || 'User'}</span>
              <span className="text-xs text-slate-500 dark:text-gray-400">{profile?.role || 'Role'}</span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors text-sm font-medium border border-slate-200/80 dark:border-transparent"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-background transition-colors duration-300">
        <header className="h-20 border-b border-slate-200 dark:border-white/5 bg-white/80 dark:bg-white/5 backdrop-blur-md flex items-center justify-between px-8 shrink-0 transition-colors duration-300">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{displayTitle}</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 relative bg-slate-50 dark:bg-background transition-colors duration-300">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
}
