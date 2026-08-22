import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, UploadCloud, ChevronDown, ShieldAlert } from 'lucide-react';
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
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive user details (fallbacks for mock stability)
  const gender = userProfile?.gender || 'Male';
  const religion = userProfile?.religion || 'Muslim';
  const nationality = userProfile?.nationality || 'Omani';
  const joinDate = userProfile?.join_date ? new Date(userProfile.join_date) : new Date('2024-01-01');

  // Verify months served for Annual Leave eligibility
  const servedMonths = useMemo(() => {
    const today = new Date();
    const yearsDiff = today.getFullYear() - joinDate.getFullYear();
    const monthsDiff = today.getMonth() - joinDate.getMonth();
    return (yearsDiff * 12) + monthsDiff;
  }, [joinDate]);

  const isEligibleForYearly = useMemo(() => {
    if (nationality !== 'Omani') return true; // Expats 1-2 years constraint handles differently, Omani has 6 months lock
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
        const isOmani = nationality === 'Omani';
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
      await onSubmit({ leaveType, startDate, endDate, durationDays: requestDurationDays, file });
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
            className="relative w-full max-w-lg glass rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
              <div>
                <h2 className="text-xl font-semibold text-white">Request Leave</h2>
                <p className="text-xs text-gray-400 mt-0.5">Omani Labor Law Compliance System</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              {/* Balances Display */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-semibold text-primary">{balances.yearly}</div>
                  <div className="text-xs text-gray-400 mt-1">Yearly Days</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-semibold text-amber-500">{balances.sick}</div>
                  <div className="text-xs text-gray-400 mt-1">Sick Days</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-semibold text-blue-400">{balances.pregnancy}</div>
                  <div className="text-xs text-gray-400 mt-1">Maternity</div>
                </div>
              </div>

              {/* Yearly leave 6-months guard check message */}
              {leaveType === 'Yearly' && !isEligibleForYearly && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Yearly Leave Locked:</strong> Under Omani Labor Law, Omani nationals are only entitled to yearly leave after 6 months of active service. (Served: {servedMonths} months).
                  </div>
                </div>
              )}

              {/* Leave Type Select */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Leave Category</label>
                <div className="relative">
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                  >
                    <option value="Yearly" className="bg-gray-900 text-white">Yearly Leave (30 Days)</option>
                    <option value="Sick" className="bg-gray-900 text-white">Sick Leave (Paid Scale)</option>
                    
                    {/* Gender and Religion constraints */}
                    {gender === 'Female' && (
                      <option value="Maternity" className="bg-gray-900 text-white">Maternity Leave (98 Days)</option>
                    )}
                    {gender === 'Male' && (
                      <option value="Paternity" className="bg-gray-900 text-white">Paternity Leave (7 Days)</option>
                    )}
                    
                    <option value="Marriage" className="bg-gray-900 text-white">Marriage Leave (3 Days)</option>
                    
                    <option value="Bereavement_Immediate" className="bg-gray-900 text-white">Bereavement - Immediate Family (3 Days)</option>
                    <option value="Bereavement_Extended" className="bg-gray-900 text-white">Bereavement - Extended Family (2 Days)</option>
                    <option value="Bereavement_Spouse" className="bg-gray-900 text-white">Bereavement - Spouse (10 Days)</option>
                    
                    {gender === 'Female' && religion === 'Muslim' && (
                      <option value="Mourning_Muslim" className="bg-gray-900 text-white">Mourning Leave - Muslim Female (130 Days)</option>
                    )}
                    {gender === 'Female' && religion === 'Non-Muslim' && (
                      <option value="Mourning_NonMuslim" className="bg-gray-900 text-white">Mourning Leave - Non-Muslim Female (14 Days)</option>
                    )}
                    
                    <option value="Hajj" className="bg-gray-900 text-white">Hajj Leave (15 Days - Once per Service)</option>
                    <option value="Exam" className="bg-gray-900 text-white">Examination Leave (15 Days)</option>
                    <option value="Unpaid" className="bg-gray-900 text-white">Unpaid Leave</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Start Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full text-sm"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">End Date</label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full text-sm"
                    />
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Duration & Sick Pay warnings */}
              {requestDurationDays > 0 && (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Total Requested Duration:</span>
                    <span className="font-bold text-white text-right">
                      {requestDurationDays} Days
                      {leaveType === 'Yearly' && (
                        <span className="text-[10px] text-emerald-400 block font-normal mt-0.5">
                          (excluding {nationality === 'Omani' ? 'Fri/Sat' : 'Fri'} weekends)
                        </span>
                      )}
                    </span>
                  </div>
                  {sickLeaveWageInfo && (
                    <div className="text-xs font-medium text-amber-400 leading-normal pt-1.5 border-t border-white/5">
                      {sickLeaveWageInfo}
                    </div>
                  )}
                </div>
              )}

              {/* File Attachment */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Required Documentation (Optional)</label>
                <div className="relative border-2 border-dashed border-white/20 rounded-xl p-6 text-center hover:bg-white/5 transition-colors cursor-pointer group">
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept="image/*,.pdf"
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-primary transition-colors" />
                    <span className="text-sm text-gray-300">
                      {file ? file.name : 'Attach Medical Report, Certificate, or Marriage License'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (leaveType === 'Yearly' && !isEligibleForYearly)}
                className="w-full bg-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 mt-4 text-sm"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
