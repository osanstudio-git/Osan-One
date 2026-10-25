import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, UploadCloud, ChevronDown, ShieldAlert, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import type { LeaveType } from '../../types';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  balances: { yearly: number; sick: number; pregnancy: number };
  userProfile?: any;
}

export function LeaveModal({ isOpen, onClose, onSubmit, balances, userProfile }: LeaveModalProps) {
  const [leaveType, setLeaveType] = useState<LeaveType>('Yearly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive user details (fallbacks for mock stability)
  const gender = userProfile?.gender || 'Male';
  const religion = userProfile?.religion || 'Muslim';
  const nationality = userProfile?.nationality || 'OMAN';
  const joinDate = userProfile?.join_date ? new Date(userProfile.join_date) : new Date('2024-01-01');

  // Verify months served for Annual Leave eligibility
  const servedMonths = useMemo(() => {
    const today = new Date();
    const yearsDiff = today.getFullYear() - joinDate.getFullYear();
    const monthsDiff = today.getMonth() - joinDate.getMonth();
    return (yearsDiff * 12) + monthsDiff;
  }, [joinDate]);

  const isEligibleForYearly = useMemo(() => {
    const isOmani = nationality === 'OMAN' || nationality === 'Omani';
    if (!isOmani) return true; // Expats 1-2 years constraint handles differently, Omani has 6 months lock
    return servedMonths >= 6;
  }, [nationality, servedMonths]);

  // Calculate requested duration in days (excluding weekends for Yearly leave)
  const requestDurationDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let daysCount = 0;
    const current = new Date(start);
    while (current <= end) {
      if (leaveType === 'Yearly') {
        const dayOfWeek = current.getDay(); // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
        const isOmani = nationality === 'OMAN' || nationality === 'Omani';
        if (isOmani) {
          // Omani: skip Friday (5) and Saturday (6)
          if (dayOfWeek !== 5 && dayOfWeek !== 6) {
            daysCount++;
          }
        } else {
          // Expat: skip Friday (5)
          if (dayOfWeek !== 5) {
            daysCount++;
          }
        }
      } else {
        daysCount++;
      }
      current.setDate(current.getDate() + 1);
    }
    return daysCount;
  }, [startDate, endDate, leaveType, nationality]);

  // Enforce Sick Leave Wage structure warning
  const sickLeaveWageInfo = useMemo(() => {
    if (leaveType !== 'Sick' || requestDurationDays <= 0) return null;
    
    // First 21 days: 100% pay
    // 22 to 35: 75% pay
    // 36 to 70: 50% pay
    // 71 to 182: 25% pay
    let text = '';
    if (requestDurationDays <= 21) {
      text = '🎉 Fully Paid (100% Salary) under Omani Labor Law.';
    } else if (requestDurationDays <= 35) {
      text = '⚠️ Partially Paid: Days 1-21 will receive 100% pay, and Days 22-35 will receive 75% pay.';
    } else if (requestDurationDays <= 70) {
      text = '⚠️ Partially Paid: Days 1-21 (100%), Days 22-35 (75%), and Days 36-70 (50% pay).';
    } else if (requestDurationDays <= 182) {
      text = '⚠️ Partially Paid: Days 1-21 (100%), Days 22-35 (75%), Days 36-70 (50%), and Days 71-182 (25% pay).';
    } else {
      text = '❌ Exceeds standard sick leave allowance. Days beyond 182 are unpaid.';
    }
    return text;
  }, [leaveType, requestDurationDays]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;

    if (requestDurationDays <= 0) {
      alert('End Date must be after or equal to Start Date.');
      return;
    }

    // Eligibility guards
    if (leaveType === 'Yearly' && !isEligibleForYearly) {
      alert(`Access Denied: Omani Labor Law requires Omani Nationals to serve at least 6 months before taking Yearly Leave (You have served ${servedMonths} months).`);
      return;
    }

    if (leaveType === 'Maternity' && requestDurationDays > 98) {
      alert('Omani Maternity Leave limit is 98 days maximum.');
      return;
    }

    if (leaveType === 'Paternity' && requestDurationDays > 7) {
      alert('Omani Paternity Leave limit is 7 days maximum.');
      return;
    }

    if (leaveType === 'Marriage' && requestDurationDays > 3) {
      alert('Paid Marriage Leave is limited to 3 days maximum.');
      return;
    }

    if (leaveType === 'Hajj' && requestDurationDays > 15) {
      alert('Paid Hajj Leave is limited to 15 days maximum (granted once).');
      return;
    }

    if (leaveType === 'Exam' && requestDurationDays > 15) {
      alert('Paid Exam Leave is limited to 15 days maximum.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ leaveType, startDate, endDate, durationDays: requestDurationDays, file, notes });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden shadow-2xl transition-colors duration-300"
          >
            <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Request Leave</h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mt-0.5">Omani Labor Law Compliance System</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              {/* Balances Display Cards */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{balances.yearly}</div>
                  <div className="text-xs font-bold text-slate-600 dark:text-gray-300 mt-1">Yearly Days</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{balances.sick}</div>
                  <div className="text-xs font-bold text-slate-600 dark:text-gray-300 mt-1">Sick Days</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-3 text-center">
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{balances.pregnancy}</div>
                  <div className="text-xs font-bold text-slate-600 dark:text-gray-300 mt-1">Maternity</div>
                </div>
              </div>

              {/* Yearly leave 6-months guard check message */}
              {leaveType === 'Yearly' && !isEligibleForYearly && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div className="font-medium">
                    <strong className="font-extrabold">Yearly Leave Locked:</strong> Under Omani Labor Law, Omani nationals are only entitled to yearly leave after 6 months of active service. (Served: {servedMonths} months).
                  </div>
                </div>
              )}

              {/* Leave Type Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">Leave Category *</label>
                <div className="relative">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-3 px-4 text-slate-900 dark:text-white font-semibold appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-xs cursor-pointer"
                  >
                    <option value="Yearly" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Yearly Leave (30 Days)</option>
                    <option value="Sick" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Sick Leave (Paid Scale)</option>
                    
                    {/* Gender and Religion constraints */}
                    {gender === 'Female' && (
                      <option value="Maternity" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Maternity Leave (98 Days)</option>
                    )}
                    {gender === 'Male' && (
                      <option value="Paternity" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Paternity Leave (7 Days)</option>
                    )}
                    
                    <option value="Marriage" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Marriage Leave (3 Days)</option>
                    
                    <option value="Bereavement_Immediate" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Immediate Family (3 Days)</option>
                    <option value="Bereavement_Extended" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Extended Family (2 Days)</option>
                    <option value="Bereavement_Spouse" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Spouse (10 Days)</option>
                    
                    {gender === 'Female' && religion === 'Muslim' && (
                      <option value="Mourning_Muslim" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Mourning Leave - Muslim Female (130 Days)</option>
                    )}
                    {gender === 'Female' && religion === 'Non-Muslim' && (
                      <option value="Mourning_NonMuslim" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Mourning Leave - Non-Muslim Female (14 Days)</option>
                    )}
                    
                    <option value="Hajj" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Hajj Leave (15 Days - Once per Service)</option>
                    <option value="Exam" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Examination Leave (15 Days)</option>
                    <option value="Unpaid" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Unpaid Leave</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">Start Date *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-3 pl-11 pr-4 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-xs"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">End Date *</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-3 pl-11 pr-4 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-xs"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Duration & Sick Pay warnings */}
              {requestDurationDays > 0 && (
                <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-600 dark:text-gray-400">Total Requested Duration:</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-right">
                      {requestDurationDays} Days
                      {leaveType === 'Yearly' && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold mt-0.5">
                          (excluding {nationality === 'OMAN' || nationality === 'Omani' ? 'Fri/Sat' : 'Fri'} weekends)
                        </span>
                      )}
                    </span>
                  </div>
                  {sickLeaveWageInfo && (
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 leading-normal pt-2 border-t border-slate-200 dark:border-white/5">
                      {sickLeaveWageInfo}
                    </div>
                  )}
                </div>
              )}

              {/* Reason / Notes Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Reason / Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="State the reason or purpose for your leave request..."
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-xs resize-none placeholder:text-slate-400"
                />
              </div>

              {/* File Attachment */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    {leaveType === 'Sick' || leaveType === 'Maternity'
                      ? 'Medical Report / Sick Certificate (Optional)'
                      : 'Required Documentation (Optional)'}
                  </label>
                  {(leaveType === 'Sick' || leaveType === 'Maternity') && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                      Can also upload after visiting doctor
                    </span>
                  )}
                </div>
                {file ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" /> Ready to upload ({(Math.round(file.size / 1024))} KB)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl p-5 text-center bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer group">
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      accept="image/*,.pdf"
                    />
                    <div className="flex flex-col items-center justify-center gap-2">
                      <UploadCloud className="w-7 h-7 text-slate-400 dark:text-gray-400 group-hover:text-primary transition-colors" />
                      <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                        {leaveType === 'Sick' || leaveType === 'Maternity'
                          ? 'Attach Hospital Sick Leave Certificate or Medical Note'
                          : 'Attach Medical Report, Certificate, or Official Document'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500">Supports PDF, JPG, PNG (Max 10MB)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (leaveType === 'Yearly' && !isEligibleForYearly)}
                className="w-full bg-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 mt-4 text-xs cursor-pointer active:scale-95"
              >
                {isSubmitting ? 'Submitting Request...' : 'Submit Leave Request'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
