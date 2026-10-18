import { Languages } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export function LanguageToggle({ className = '' }: { className?: string }) {
  const { language, toggleLanguage } = useLanguage();
  const isAr = language === 'ar';

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      translate="no"
      aria-label="Toggle Language"
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all text-xs font-extrabold shadow-xs cursor-pointer ${
        isAr
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
      } ${className}`}
      title={isAr ? 'Switch to English' : 'التحويل إلى العربية'}
    >
      <Languages className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="font-bold tracking-wide">
        {isAr ? 'EN' : 'عربي'}
      </span>
    </button>
  );
}
