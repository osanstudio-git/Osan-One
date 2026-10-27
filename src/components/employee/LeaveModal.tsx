import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, ChevronDown, ShieldAlert, UploadCloud, FileText, CheckCircle2, Trash2, Plus } from 'lucide-react';
import type { LeaveType } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  balances?: { yearly: number; sick: number; pregnancy: number };
  userProfile?: any;
}

export function LeaveModal({ isOpen, onClose, onSubmit, userProfile }: LeaveModalProps) {
  const { t, language } = useLanguage();
  const isArabic = language === 'ar';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [leaveType, setLeaveType] = useState<LeaveType>('Yearly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [medicalFiles, setMedicalFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derive user details based on registered employee profile in database
  const gender = useMemo<'Male' | 'Female'>(() => {
    const raw = (userProfile?.gender || '').trim().toLowerCase();
    if (raw === 'female' || raw === 'f' || raw === 'woman' || raw === 'girl') return 'Female';
    return 'Male';
  }, [userProfile?.gender]);

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

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const newFiles: File[] = [];
    const maxFileSize = 10 * 1024 * 1024; // 10MB per file

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      if (f.size > maxFileSize) {
        alert(isArabic ? `الملف ${f.name} يتجاوز 10 ميجابايت` : `File "${f.name}" exceeds 10MB limit`);
        continue;
      }
      if (!medicalFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        newFiles.push(f);
      }
    }

    if (newFiles.length > 0) {
      setMedicalFiles(prev => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setMedicalFiles(prev => prev.filter((_, i) => i !== index));
  };

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
      await onSubmit({
        leaveType,
        startDate,
        endDate,
        durationDays: requestDurationDays,
        notes,
        files: leaveType === 'Sick' ? medicalFiles : [],
        file: leaveType === 'Sick' ? (medicalFiles[0] || undefined) : undefined,
      });
      setMedicalFiles([]);
      setStartDate('');
      setEndDate('');
      setNotes('');
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setMedicalFiles([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
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
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {t('newLeaveRequest') || 'Request Leave'}
                </h2>
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mt-0.5">
                  {t('omaniComplianceSubtitle') || 'Omani Labor Law Compliance System'}
                </p>
              </div>
              <button 
                onClick={handleClose} 
                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">

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
                    
                    {/* FEMALE ONLY LEAVES */}
                    {gender === 'Female' && (
                      <option value="Maternity" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Maternity Leave (98 Days)</option>
                    )}

                    {/* MALE ONLY LEAVES */}
                    {gender === 'Male' && (
                      <option value="Paternity" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Paternity Leave (7 Days)</option>
                    )}
                    
                    <option value="Marriage" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Marriage Leave (3 Days)</option>
                    
                    <option value="Bereavement_Immediate" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Immediate Family (3 Days)</option>
                    <option value="Bereavement_Extended" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Extended Family (2 Days)</option>
                    
                    {/* Spouse Bereavement: Males get 10 Days, Muslim Females get 130 Days Iddah Mourning */}
                    {gender === 'Male' && (
                      <option value="Bereavement_Spouse" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bereavement - Spouse (10 Days)</option>
                    )}
                    
                    {gender === 'Female' && religion === 'Muslim' && (
                      <option value="Mourning_Muslim" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Mourning Leave - Muslim Female / Iddah (130 Days)</option>
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
                    <span className="font-semibold text-slate-600 dark:text-gray-400">
                      {isArabic ? 'إجمالي المدة المطلوبة:' : 'Total Requested Duration:'}
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-right">
                      {requestDurationDays} {t('days')}
                      {leaveType === 'Yearly' && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-bold mt-0.5">
                          ({isArabic ? 'باستثناء عطلات نهاية الأسبوع' : `excluding ${nationality === 'OMAN' || nationality === 'Omani' ? 'Fri/Sat' : 'Fri'} weekends`})
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

              {/* Optional Medical Report Upload when Sick Leave is selected */}
              {leaveType === 'Sick' && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{t('medicalReportOptional')}</span>
                    </label>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                      {isArabic ? 'اختياري' : 'Optional'}
                    </span>
                  </div>

                  {/* Hidden multi-file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={handleFilesChange}
                  />

                  {medicalFiles.length === 0 ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="group relative border-2 border-dashed border-slate-300 dark:border-white/15 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 rounded-2xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all bg-slate-50/60 dark:bg-slate-950/40 hover:bg-emerald-500/5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                        <UploadCloud className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-gray-200">
                        {t('clickToUploadMulti') || 'Click to select files (Multi-selection enabled)'}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">
                        {t('uploadMedicalReportDesc') || 'Attach doctor note or clinic certificate (PDF or image - max 10MB per file)'}
                      </p>
                      <span className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        {isArabic ? 'يدعم اختيار عدة ملفات معاً' : 'Select multiple documents'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-slate-50 dark:bg-white/5 p-3 rounded-2xl border border-slate-200 dark:border-white/10">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-gray-300 pb-1 border-b border-slate-200/60 dark:border-white/5">
                        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-extrabold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{medicalFiles.length} {t('filesAttached') || 'files selected'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('addMoreFiles') || '+ Add more files'}</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {medicalFiles.map((file, idx) => (
                          <div
                            key={`${file.name}-${idx}`}
                            className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-xl group hover:border-emerald-500/40 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs font-black">
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {file.name}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-gray-400 font-medium">
                                  {(file.size / 1024).toFixed(0)} KB • {isArabic ? 'جاهز للإرفاق' : 'Ready to attach'}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                              title={t('removeFile') || 'Remove file'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reason / Notes Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  {isArabic ? 'السبب / الملاحظات (اختياري)' : 'Reason / Notes (Optional)'}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isArabic ? 'اذكر سبب أو ملاحظات طلب الإجازة...' : 'State the reason or purpose for your leave request...'}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-xs resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || (leaveType === 'Yearly' && !isEligibleForYearly)}
                className="w-full bg-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold py-3.5 rounded-2xl transition-all shadow-lg shadow-primary/20 mt-4 text-xs cursor-pointer active:scale-95"
              >
                {isSubmitting 
                  ? (isArabic ? 'جاري إرسال الطلب...' : 'Submitting Request...') 
                  : (isArabic ? 'إرسال طلب الإجازة' : 'Submit Leave Request')}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
