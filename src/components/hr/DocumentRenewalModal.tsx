import { useState, useEffect } from 'react';
import { X, RefreshCw, Upload, CheckCircle2, ShieldAlert } from 'lucide-react';

interface DocumentRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  documentItem: {
    id: string;
    name: string;
    type: string;
    expiryDate?: string;
    number?: string;
  } | null;
  onRenew: (docId: string, newExpiryDate: string, newNumber?: string, attachedFile?: string) => void;
}

export function DocumentRenewalModal({
  isOpen,
  onClose,
  employeeName,
  documentItem,
  onRenew
}: DocumentRenewalModalProps) {
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (documentItem) {
      setNewNumber(documentItem.number || '');
      // Default to 2 years from today or 1 year from current expiry
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      setNewExpiryDate(nextYear.toISOString().split('T')[0]);
    }
  }, [documentItem]);

  if (!isOpen || !documentItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpiryDate) return;

    onRenew(documentItem.id, newExpiryDate, newNumber, file?.name);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 rounded-xl">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Renew Document / Visa</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400">{employeeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center space-y-3 animate-in zoom-in duration-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 dark:text-emerald-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Renewal Logged Successfully!</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400">Document expiration date updated and warning cleared.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
              <div className="text-slate-500 dark:text-gray-400">Target Document</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{documentItem.name}</div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                Current Expiry: {documentItem.expiryDate || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">New Expiry Date *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={newExpiryDate}
                  onChange={(e) => setNewExpiryDate(e.target.value)}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Document / License Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 9845-2026-X"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Upload Scanned Document Copy (PDF/JPG)</label>
              <div className="border border-dashed border-slate-300 dark:border-white/20 rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-slate-50 dark:bg-white/5 cursor-pointer">
                <input
                  type="file"
                  id="renew-file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="renew-file" className="cursor-pointer flex flex-col items-center gap-1.5">
                  <Upload className="w-5 h-5 text-primary" />
                  <span className="text-xs font-medium text-slate-700 dark:text-gray-300">
                    {file ? file.name : 'Click to upload updated scan'}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">Supports PDF, PNG, JPG (Max 5MB)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" /> Confirm & Update Expiry Record
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
