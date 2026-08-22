import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle Theme"
      className={`relative inline-flex items-center justify-between p-1.5 rounded-full w-14 h-8 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
        isDark 
          ? 'bg-slate-800 border border-slate-700/80 text-amber-400' 
          : 'bg-slate-200 border border-slate-300 text-slate-700'
      } ${className}`}
    >
      <Sun className={`w-4 h-4 transition-opacity duration-300 ${isDark ? 'opacity-40 text-slate-400' : 'opacity-100 text-amber-500 font-bold'}`} />
      <Moon className={`w-4 h-4 transition-opacity duration-300 ${isDark ? 'opacity-100 text-amber-400 font-bold' : 'opacity-40 text-slate-400'}`} />
      
      {/* Sliding Pill Indicator */}
      <span
        className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white dark:bg-slate-900 shadow-md transform transition-transform duration-300 flex items-center justify-center ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
          <Moon className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
        )}
      </span>
    </button>
  );
}
