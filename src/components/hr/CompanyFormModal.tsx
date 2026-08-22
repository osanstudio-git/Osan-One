import { useState, useRef, useEffect } from 'react';
import { X, Building2, Loader2, Upload, MapPin, Mail, Palette, Shield, Clock } from 'lucide-react';
import type { CompanyData } from '../../pages/hr/mockData';
import type { AuthPolicy } from '../../types';

interface CompanyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (company: Omit<CompanyData, 'count'>) => Promise<void>;
  initialData?: CompanyData | null;
}

const THEMES = [
  { name: 'emerald', color: 'bg-emerald-500', border: 'border-emerald-500' },
  { name: 'blue', color: 'bg-blue-500', border: 'border-blue-500' },
  { name: 'amber', color: 'bg-amber-500', border: 'border-amber-500' },
  { name: 'rose', color: 'bg-rose-500', border: 'border-rose-500' },
  { name: 'indigo', color: 'bg-indigo-500', border: 'border-indigo-500' },
];

export function CompanyFormModal({ isOpen, onClose, onSave, initialData }: CompanyFormModalProps) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [theme, setTheme] = useState('emerald');
  const [logoUrl, setLogoUrl] = useState('');
  const [authPolicy, setAuthPolicy] = useState<AuthPolicy>('both');
  
  // Nationality Shift Bounds
  const [omaniShiftStart, setOmaniShiftStart] = useState('08:30');
  const [omaniShiftEnd, setOmaniShiftEnd] = useState('17:00');
  const [expatShiftStart, setExpatShiftStart] = useState('08:30');
  const [expatShiftEnd, setExpatShiftEnd] = useState('18:00');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setLocation(initialData.location || '');
        setContactEmail(initialData.contactEmail || '');
        setTheme(initialData.theme || 'emerald');
        setLogoUrl(initialData.logoUrl || '');
        setAuthPolicy(initialData.authPolicy || 'both');
        setOmaniShiftStart(initialData.omaniShiftStart || '08:30');
        setOmaniShiftEnd(initialData.omaniShiftEnd || '17:00');
        setExpatShiftStart(initialData.expatShiftStart || '08:30');
        setExpatShiftEnd(initialData.expatShiftEnd || '18:00');
      } else {
        setName('');
        setLocation('');
        setContactEmail('');
        setTheme('emerald');
        setLogoUrl('');
        setAuthPolicy('both');
        setOmaniShiftStart('08:30');
        setOmaniShiftEnd('17:00');
        setExpatShiftStart('08:30');
        setExpatShiftEnd('18:00');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        location: location.trim(),
        contactEmail: contactEmail.trim(),
        theme,
        logoUrl,
        authPolicy,
        omaniShiftStart,
        omaniShiftEnd,
        expatShiftStart,
        expatShiftEnd
      });
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to save company. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-lg p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-xl">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{isEditing ? 'Edit Company' : 'Add New Company'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Logo Upload */}
          <div className="flex items-center gap-4">
            <div
              className={`w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center bg-slate-50 dark:bg-white/5 cursor-pointer transition-colors overflow-hidden ${logoUrl ? 'border-primary/50' : 'border-slate-300 dark:border-white/20 hover:border-primary/50'
                }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 text-slate-400 dark:text-gray-500" />
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-900 dark:text-white mb-0.5">Company Logo</label>
              <p className="text-xs text-slate-500 dark:text-gray-400">Click to upload a logo (mock local preview)</p>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1.5">Company Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Osan Studio"
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1.5 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Muscat, Oman"
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-600 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1.5 flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Contact Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="hr@osan.com"
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-600 transition-all"
              />
            </div>
          </div>

          {/* Authentication Policy */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1.5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Authentication Policy
            </label>
            <select
              value={authPolicy}
              onChange={(e) => setAuthPolicy(e.target.value as AuthPolicy)}
              className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none appearance-none transition-all"
            >
              <option value="both" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Allow Both (Email & Phone Number)</option>
              <option value="email" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Email & Google Auth Only</option>
              <option value="phone" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Phone Number & PIN Only</option>
            </select>
          </div>

          {/* Shift configuration bounds per nationality */}
          <div className="space-y-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Shift Configurations (Labor Law)
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">Omani Shift Start</label>
                <input
                  type="time"
                  value={omaniShiftStart}
                  onChange={(e) => setOmaniShiftStart(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">Omani Shift End</label>
                <input
                  type="time"
                  value={omaniShiftEnd}
                  onChange={(e) => setOmaniShiftEnd(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">Expat Shift Start</label>
                <input
                  type="time"
                  value={expatShiftStart}
                  onChange={(e) => setExpatShiftStart(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-gray-400">Expat Shift End</label>
                <input
                  type="time"
                  value={expatShiftEnd}
                  onChange={(e) => setExpatShiftEnd(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-relaxed">
              * Omani Shift operates **Sunday–Thursday** (Fri/Sat rest).<br />
              * Expat Shift operates **Saturday–Thursday** (Fri rest).
            </p>
          </div>

          {/* Theme Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-2 flex items-center gap-2">
              <Palette className="w-4 h-4 text-primary" /> Brand Theme
            </label>
            <div className="flex gap-3">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTheme(t.name)}
                  className={`w-8 h-8 rounded-full ${t.color} transition-all duration-200 flex items-center justify-center ${theme === t.name ? `ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${t.border} scale-110` : 'hover:scale-110 opacity-70 hover:opacity-100'
                    }`}
                  aria-label={`Select ${t.name} theme`}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-gray-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-emerald-600 rounded-xl font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
