import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PunchRing } from '../components/employee/PunchRing';
import { LeaveModal } from '../components/employee/LeaveModal';
import { PipWindow } from '../components/pwa/PipWindow';
import { CompactWidget } from '../components/employee/CompactWidget';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, Clock, LogOut, CheckCircle2, History, Coffee, Play, AlertTriangle, Building2, MapPin, FileText, XCircle, X } from 'lucide-react';
import { getCompanySettings, type CompanySettings } from '../lib/settings';
import { supabase } from '../lib/supabase';
import { MOCK_COMPANIES } from './hr/mockData';
import { saveOfflinePunch } from '../lib/offlineQueue';
import { recordPunchInDb, getTodayAttendanceLogFromDb, createLeaveRequestInDb, getEmployeeLeaveRequestsFromDb } from '../lib/databaseService';

interface WorkSession {
  id: string;
  checkIn: Date;
  checkOut?: Date;
  durationMs: number;
}

export function EmployeeDashboard() {
  const { profile, signOut } = useAuth();
  const { t, language } = useLanguage();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const balances = profile?.leave_balances || { yearly: 30, sick: 14, pregnancy: 0 };

  // Multi-session punch tracking
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [firstCheckInTime, setFirstCheckInTime] = useState<Date | null>(null);
  const [currentSessionStart, setCurrentSessionStart] = useState<Date | null>(null);

  // Break state
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState<Date | null>(null);
  const [breakDurationMinutes, setBreakDurationMinutes] = useState(0);

  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [companyName, setCompanyName] = useState<string>('');

  // Restore today's active check-in state from DB & localStorage on page refresh
  useEffect(() => {
    if (!profile?.id) return;

    const localSaved = localStorage.getItem(`osan_punch_${profile.id}`);
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (parsed.isCheckedIn && parsed.checkInTime) {
          const inDate = new Date(parsed.checkInTime);
          const today = new Date();
          if (inDate.toDateString() === today.toDateString()) {
            setIsCheckedIn(true);
            setCurrentSessionStart(inDate);
            setFirstCheckInTime(inDate);
            if (parsed.isOnBreak && parsed.breakStartTime) {
              setIsOnBreak(true);
              setBreakStartTime(new Date(parsed.breakStartTime));
            }
          }
        }
      } catch (e) {
        console.error('Error parsing local punch state:', e);
      }
    }

    getTodayAttendanceLogFromDb(profile.id).then(log => {
      if (log && log.clock_in_time) {
        const inDate = new Date(log.clock_in_time);
        setFirstCheckInTime(inDate);
        if (!log.clock_out_time) {
          setIsCheckedIn(true);
          setCurrentSessionStart(inDate);
          localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({ isCheckedIn: true, checkInTime: log.clock_in_time }));
          
          if (log.break_start_time && !log.break_end_time) {
            const bDate = new Date(log.break_start_time);
            setIsOnBreak(true);
            setBreakStartTime(bDate);
          }
        } else {
          const outDate = new Date(log.clock_out_time);
          setIsCheckedIn(false);
          setIsOnBreak(false);
          setCurrentSessionStart(null);
          setSessions([{
            id: 'today-log',
            checkIn: inDate,
            checkOut: outDate,
            durationMs: Math.max(0, outDate.getTime() - inDate.getTime())
          }]);
          localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({ isCheckedIn: false }));
        }
      }
    }).catch(console.error);
  }, [profile?.id]);

  useEffect(() => {
    const compKey = profile?.company_id || profile?.company;
    if (compKey) {
      getCompanySettings(compKey).then(setSettings);

      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(compKey);
      if (isUuid) {
        supabase.from('companies').select('name').eq('id', compKey).single()
          .then(({ data }) => {
            if (data?.name) {
              setCompanyName(data.name);
            } else if (profile?.company) {
              setCompanyName(profile.company);
            }
          });
      } else {
        setCompanyName(compKey);
      }
    }
  }, [profile?.company_id, profile?.company]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Update break duration live timer
  useEffect(() => {
    if (!isOnBreak || !breakStartTime) {
      setBreakDurationMinutes(0);
      return;
    }
    const updateBreak = () => {
      const diffMs = new Date().getTime() - breakStartTime.getTime();
      setBreakDurationMinutes(Math.floor(diffMs / 60000));
    };
    updateBreak();
    const interval = setInterval(updateBreak, 10000);
    return () => clearInterval(interval);
  }, [isOnBreak, breakStartTime]);

  // Update current active session elapsed time
  useEffect(() => {
    if (!isCheckedIn || !currentSessionStart) {
      setElapsedTime('00:00');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - currentSessionStart.getTime()) / 1000);

      const hours = Math.floor(diffInSeconds / 3600);
      const minutes = Math.floor((diffInSeconds % 3600) / 60);

      const formattedHours = hours.toString().padStart(2, '0');
      const formattedMinutes = minutes.toString().padStart(2, '0');

      setElapsedTime(`${formattedHours}:${formattedMinutes}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isCheckedIn, currentSessionStart]);

  // Check for employee's own expiring or expired documents (<= 30 days)
  const expiringDocuments = useMemo(() => {
    if (!profile?.documents || !Array.isArray(profile.documents)) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return profile.documents.map(doc => {
      if (!doc.expiryDate) return null;
      const expDate = new Date(doc.expiryDate);
      expDate.setHours(0, 0, 0, 0);
      const diffTime = expDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining <= 30) {
        return {
          ...doc,
          daysRemaining
        };
      }
      return null;
    }).filter(Boolean) as Array<any>;
  }, [profile?.documents]);

  // Cumulative worked milliseconds (Completed sessions + active session)
  const cumulativeWorkedMs = useMemo(() => {
    const completedMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
    const activeMs = isCheckedIn && currentSessionStart ? (now.getTime() - currentSessionStart.getTime()) : 0;
    return completedMs + activeMs;
  }, [sessions, isCheckedIn, currentSessionStart, now]);

  const formattedCumulativeWorked = useMemo(() => {
    const diffSecs = Math.floor(cumulativeWorkedMs / 1000);
    const hrs = Math.floor(diffSecs / 3600);
    const mins = Math.floor((diffSecs % 3600) / 60);
    const secs = diffSecs % 60;
    
    if (language === 'ar') {
      let result = '';
      if (hrs > 0) result += `${hrs} ساعة و `;
      result += `${mins} دقيقة و ${secs} ثانية`;
      return result;
    }

    let result = '';
    if (hrs > 0) result += `${hrs}h `;
    result += `${mins}m ${secs.toString().padStart(2, '0')}s`;
    return result;
  }, [cumulativeWorkedMs, language]);



  const handlePunch = async (_verifiedIp?: string) => {
    await new Promise(r => setTimeout(r, 600));

    const nowTime = new Date();

    if (!navigator.onLine) {
      await saveOfflinePunch({
        userId: profile?.id || 'emp-user',
        companyId: profile?.company_id || 'company-1',
        type: !isCheckedIn ? 'clock_in' : 'clock_out',
        timestamp: nowTime.toISOString(),
        date: nowTime.toISOString().split('T')[0]
      });
    }

    if (!isCheckedIn) {
      // Check in
      if (!firstCheckInTime) {
        setFirstCheckInTime(nowTime);
      }
      setCurrentSessionStart(nowTime);
      setIsCheckedIn(true);
      if (profile?.id) {
        localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({ isCheckedIn: true, checkInTime: nowTime.toISOString() }));
        recordPunchInDb(profile.id, 'clock_in', nowTime, profile.company_id).catch(console.error);
      }
    } else {
      // Check out
      if (currentSessionStart) {
        const sessionMs = nowTime.getTime() - currentSessionStart.getTime();
        const newSession: WorkSession = {
          id: Math.random().toString(36).substring(2, 9),
          checkIn: currentSessionStart,
          checkOut: nowTime,
          durationMs: sessionMs
        };
        setSessions(prev => [...prev, newSession]);
      }
      setCurrentSessionStart(null);
      setIsCheckedIn(false);
      setIsOnBreak(false);
      setBreakStartTime(null);
      if (profile?.id) {
        localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({ isCheckedIn: false }));
        recordPunchInDb(profile.id, 'clock_out', nowTime, profile.company_id).catch(console.error);
      }
    }
  };

  const handleToggleBreak = async () => {
    if (!profile?.id || !isCheckedIn) return;

    const nowTime = new Date();
    if (!isOnBreak) {
      // Start break
      setIsOnBreak(true);
      setBreakStartTime(nowTime);
      localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({
        isCheckedIn: true,
        checkInTime: currentSessionStart?.toISOString(),
        isOnBreak: true,
        breakStartTime: nowTime.toISOString()
      }));
      await recordPunchInDb(profile.id, 'break_start', nowTime, profile.company_id);
    } else {
      // End break
      setIsOnBreak(false);
      setBreakStartTime(null);
      localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({
        isCheckedIn: true,
        checkInTime: currentSessionStart?.toISOString(),
        isOnBreak: false
      }));
      await recordPunchInDb(profile.id, 'break_end', nowTime, profile.company_id);
    }
  };

  // Leave requests & balance tracking
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [isLeavesModalOpen, setIsLeavesModalOpen] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const loadEmployeeLeaves = async () => {
    if (!profile?.id) return;
    setLoadingLeaves(true);
    try {
      const leaves = await getEmployeeLeaveRequestsFromDb(profile.id, profile.email);
      setMyLeaves(leaves);
    } catch (err) {
      console.error('Failed to load employee leaves:', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  useEffect(() => {
    loadEmployeeLeaves();

    const channel = supabase
      .channel(`emp-leaves-${profile?.id || 'live'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadEmployeeLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleLeaveSubmit = async (data: any) => {
    if (!profile?.id) return;
    try {
      let documentUrl: string | undefined = undefined;
      if (data.file) {
        try {
          documentUrl = await convertFileToBase64(data.file);
        } catch (e) {
          console.error('Failed to convert document file to base64:', e);
        }
      }

      const res = await createLeaveRequestInDb({
        userId: profile.id,
        userEmail: profile.email,
        leaveType: data.leaveType,
        startDate: data.startDate,
        endDate: data.endDate,
        durationDays: data.durationDays || 1,
        documentUrl,
      });

      if (res.success) {
        alert(t('uploadSuccess') || 'Leave request submitted successfully! Pending HR approval.');
        setIsLeaveModalOpen(false);
        await loadEmployeeLeaves();
      } else {
        alert(res.error || t('uploadFailed') || 'Failed to submit leave request. Please check details and try again.');
      }
    } catch (err: any) {
      console.error('Failed to submit leave request:', err);
      alert(t('uploadFailed') || 'Failed to submit leave request. Please try again.');
    }
  };

  // Leave balances and metrics calculation
  const approvedYearlyDays = useMemo(() => {
    return myLeaves
      .filter(l => l.status === 'Approved' && (l.leaveType || '').toLowerCase().includes('yearly'))
      .reduce((sum, l) => sum + (l.durationDays || 0), 0);
  }, [myLeaves]);

  const approvedSickDays = useMemo(() => {
    return myLeaves
      .filter(l => l.status === 'Approved' && (l.leaveType || '').toLowerCase().includes('sick'))
      .reduce((sum, l) => sum + (l.durationDays || 0), 0);
  }, [myLeaves]);

  const pendingRequestsCount = useMemo(() => {
    return myLeaves.filter(l => l.status === 'Pending').length;
  }, [myLeaves]);

  const yearlyRemaining = profile?.leave_balances?.yearly ?? Math.max(0, 30 - approvedYearlyDays);
  const sickRemaining = profile?.leave_balances?.sick ?? Math.max(0, 14 - approvedSickDays);

  const [isPipActive, setIsPipActive] = useState(false);

  const disabledMessage = null;



  const renderJourneyBar = () => {
    if (!profile) return null;
    const isOmani = profile.nationality === 'Omani';
    const activeCompany = MOCK_COMPANIES.find(c => c.name === companyName) || MOCK_COMPANIES[0];
    const shiftStart = isOmani ? activeCompany.omaniShiftStart : activeCompany.expatShiftStart;
    const shiftEnd = isOmani ? activeCompany.omaniShiftEnd : activeCompany.expatShiftEnd;

    const [startHr, startMin] = (shiftStart || "08:30").split(':').map(Number);
    const [endHr, endMin] = (shiftEnd || "17:00").split(':').map(Number);

    const start = new Date(now);
    start.setHours(startHr, startMin, 0, 0);
    const end = new Date(now);
    end.setHours(endHr, endMin, 0, 0);

    const totalMs = end.getTime() - start.getTime();
    const elapsedMs = now.getTime() - start.getTime();
    let progress = (elapsedMs / totalMs) * 100;
    progress = Math.max(0, Math.min(100, progress));

    return (
      <div className="w-full max-w-md mt-8">
        <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 font-bold mb-2 px-1">
          <span translate="no">{shiftStart} ({t('shiftStart')})</span>
          <span translate="no">{shiftEnd} ({t('shiftEnd')})</span>
        </div>
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-1000 relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-r from-transparent to-white/30" />
          </div>
        </div>
      </div>
    );
  };

  const renderPunchUI = () => {
    const formattedTime = now.toLocaleTimeString(language === 'ar' ? 'ar-OM' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = language === 'ar'
      ? now.toLocaleDateString('ar-OM', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
      : now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        {/* Main Panel Clock */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow-xs mb-2 sm:mb-3" translate="no">
            {formattedTime}
          </div>
          <div className="text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs sm:text-sm flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="truncate">{formattedDate}</span>
          </div>

          {/* Active Branch Office Indicator */}
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-gray-300 shadow-2xs">
            <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t('branch')}: <strong className="text-slate-900 dark:text-white font-extrabold" translate="no">{companyName || profile?.company || 'Office'}</strong></span>
            {settings?.office_latitude && settings?.office_longitude ? (
              <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5" translate="no">
                <MapPin className="w-2.5 h-2.5" /> {t('geoActive')}
              </span>
            ) : null}
          </div>
        </div>

        {/* CUMULATIVE WORKED HOURS TODAY KPI BADGE */}
        <div className="mb-8 px-6 py-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 shadow-lg shadow-emerald-500/5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col text-left rtl:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/80">{t('cumulativeWorkedToday')}</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight" translate="no">{formattedCumulativeWorked}</span>
          </div>
        </div>

        <PunchRing
          isCheckedIn={isCheckedIn}
          onPunch={handlePunch}
          disabledMessage={disabledMessage}
          companySettings={settings}
          companyName={companyName || profile?.company}
          companyId={profile?.company_id || profile?.company}
        />

        {/* BREAK ACTION BUTTON & WARNING INDICATOR */}
        {isCheckedIn && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button
              onClick={handleToggleBreak}
              className={`px-5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                isOnBreak
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25 animate-pulse'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-amber-500 text-slate-800 dark:text-white hover:text-amber-500'
              }`}
            >
              {isOnBreak ? (
                <>
                  <Play className="w-4 h-4 fill-white rtl:rotate-180" />
                  <span translate="no">{t('resumeWork')} ({t('breakTime')}: {breakDurationMinutes} {t('minutes')})</span>
                </>
              ) : (
                <>
                  <Coffee className="w-4 h-4 text-amber-500" />
                  <span translate="no">{t('takeBreak')}</span>
                </>
              )}
            </button>

            {isOnBreak && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  {breakDurationMinutes > 75 
                    ? '⚠️ Over-Break Warning (>75m Grace Period Exceeded)!'
                    : `Active Break: ${breakDurationMinutes} mins used (Standard: 60m)`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Small text check-in time display */}
        {isCheckedIn && currentSessionStart && (
          <div className="mt-5 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-6 py-2 rounded-full font-bold shadow-lg shadow-emerald-500/5 text-sm">
              <Clock className="w-4 h-4" />
              <span>Active Session • {elapsedTime}</span>
            </div>
            <span className="text-xs text-slate-500 dark:text-gray-400 tracking-wide font-semibold mt-1">
              Current Punch-In: <strong className="text-slate-900 dark:text-gray-200">{currentSessionStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong>
              {firstCheckInTime && <span className="ml-2 text-slate-400 dark:text-gray-500">(1st Shift Punch: {firstCheckInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>}
            </span>
          </div>
        )}

        {/* Completed Sessions Log Breakdown */}
        {sessions.length > 0 && (
          <div className="mt-8 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 mb-3">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Today's Sessions ({sessions.length})
              </div>
              {firstCheckInTime && (
                <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">
                  First Punch: <strong className="text-emerald-600 dark:text-emerald-400">{firstCheckInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {sessions.map((s, idx) => {
                const durSecs = Math.floor(s.durationMs / 1000);
                const hrs = Math.floor(durSecs / 3600);
                const mins = Math.floor((durSecs % 3600) / 60);
                return (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-gray-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Session #{idx + 1}: <strong>{s.checkIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> → <strong>{s.checkOut?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                    </div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      {hrs > 0 ? `${hrs}h ` : ''}{mins}m
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {renderJourneyBar()}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col items-center pt-12 px-4 pb-24 relative transition-colors duration-300">
      <div className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 sm:mb-12">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold mb-1 text-slate-900 dark:text-white">
            <span>{t('hello')}, </span>
            <span translate="no">{profile?.name || 'Employee'}</span>
          </h1>
          <p className="text-primary text-xs sm:text-sm font-bold tracking-wider uppercase" translate="no">
            {companyName || 'OSAN GROUP'}
          </p>

          {/* Quick Leave Balances Indicator Button */}
          <button
            onClick={() => setIsLeavesModalOpen(true)}
            className="mt-2 px-3 py-1.5 rounded-xl bg-blue-500/10 dark:bg-white/5 border border-blue-500/20 dark:border-white/10 hover:border-blue-500/40 text-xs font-semibold text-slate-800 dark:text-gray-200 inline-flex items-center gap-2 cursor-pointer transition-all shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>{t('myLeaves')}:</span>
            <span className="font-extrabold text-[#1D70B8] dark:text-blue-400">
              {yearlyRemaining} {t('days')} {t('remaining')}
            </span>
            {pendingRequestsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                {pendingRequestsCount} {t('pending')}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <LanguageToggle />
          <ThemeToggle />

          {('documentPictureInPicture' in window) && (
            <button
              onClick={() => setIsPipActive(true)}
              disabled={isPipActive}
              className="px-3 sm:px-3.5 py-2 bg-blue-500/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 hover:bg-blue-500/20 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="12" width="7" height="5"></rect><line x1="12" y1="12" x2="19" y2="17"></line></svg>
              <span translate="no">{t('popOut')}</span>
            </button>
          )}

          <button
            onClick={signOut}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer"
            title={t('signOut')}
          >
            <LogOut className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* DOCUMENT EXPIRATION ALERT BANNER */}
      {expiringDocuments.length > 0 && (
        <div className="w-full max-w-4xl mb-6 space-y-2">
          {expiringDocuments.map((doc, idx) => {
            const isExpired = doc.daysRemaining < 0;
            return (
              <div
                key={doc.id || idx}
                className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
                  isExpired
                    ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${isExpired ? 'bg-red-500/20 text-red-600 dark:text-red-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-extrabold text-sm">
                      {isExpired ? 'Action Required: Document Expired' : 'Document Renewal Notice'}
                    </p>
                    <p className="opacity-90 mt-0.5">
                      Your <strong>{doc.name}</strong> ({doc.type || 'Official ID'}) {isExpired ? `expired ${Math.abs(doc.daysRemaining)} days ago` : `will expire in ${doc.daysRemaining} days`} on <strong>{new Date(doc.expiryDate).toLocaleDateString('en-GB')}</strong>.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isExpired ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'}`}>
                    {isExpired ? 'Expired' : `${doc.daysRemaining}d Left`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center w-full">
        {isPipActive ? (
          <div className="text-center p-12 border border-dashed border-slate-300 dark:border-gray-700 rounded-3xl bg-white dark:bg-slate-900/60 opacity-60">
            <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Widget is Active</h2>
            <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Your check-in ring is hovering on your screen.</p>
          </div>
        ) : (
          renderPunchUI()
        )}
      </div>

      {/* FLOATING ACTION DOCK FOR LEAVES & BALANCES */}
      <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 rtl:right-auto rtl:left-4 rtl:md:left-8 flex items-center gap-2.5 z-40">
        <button
          onClick={() => setIsLeavesModalOpen(true)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white p-3.5 sm:px-4 rounded-2xl shadow-xl transition-all flex items-center gap-2.5 group cursor-pointer"
          title={t('myLeaves')}
        >
          <div className="relative">
            <Calendar className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
            )}
          </div>
          <span className="font-bold text-xs hidden sm:inline">{t('myLeaves')}</span>
        </button>

        <button
          onClick={() => setIsLeaveModalOpen(true)}
          className="bg-[#1D70B8] hover:bg-[#155994] text-white p-3.5 sm:px-5 rounded-2xl shadow-xl shadow-[#1D70B8]/25 transition-all flex items-center gap-2 group cursor-pointer"
        >
          <Calendar className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="font-bold text-xs" translate="no">{t('requestLeave')}</span>
        </button>
      </div>

      {/* MY LEAVES & BALANCES EXPANDED MODAL */}
      {isLeavesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 dark:border-white/5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span>{t('myLeaves')}</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  View your available allocations, taken leaves, and application statuses.
                </p>
              </div>
              <button
                onClick={() => setIsLeavesModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
              {/* Balances KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Annual Leave */}
                <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300">{t('annualLeave')}</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Omani Law
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="text-3xl font-extrabold text-[#1D70B8] dark:text-blue-400">
                      {yearlyRemaining} <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">{t('days')} {t('remaining')}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium flex items-center justify-between border-t border-blue-200/40 dark:border-blue-900/30 pt-2 mt-1">
                    <span>{t('used')}: <strong>{approvedYearlyDays}d</strong></span>
                    <span>{t('total')}: <strong>30d</strong></span>
                  </div>
                </div>

                {/* Sick Leave */}
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-300">{t('sickLeave')}</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      Medical
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                      {sickRemaining} <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">{t('days')} {t('remaining')}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium flex items-center justify-between border-t border-amber-200/40 dark:border-amber-900/30 pt-2 mt-1">
                    <span>{t('used')}: <strong>{approvedSickDays}d</strong></span>
                    <span>{t('total')}: <strong>14d</strong></span>
                  </div>
                </div>

                {/* Pending Requests */}
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-gray-300">{t('status')}</span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      HR Review
                    </span>
                  </div>
                  <div className="my-2">
                    <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {pendingRequestsCount} <span className="text-sm font-semibold text-slate-500 dark:text-gray-400">{t('pending')}</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-gray-400 font-medium flex items-center justify-between border-t border-slate-200/40 dark:border-white/5 pt-2 mt-1">
                    <span>Total Applied: <strong>{myLeaves.length}</strong></span>
                  </div>
                </div>
              </div>

              {/* Action Banner to Apply */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Need to take time off?</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Submit a new leave application with optional medical or travel documents.</p>
                </div>
                <button
                  onClick={() => setIsLeaveModalOpen(true)}
                  className="px-4 py-2 bg-[#1D70B8] hover:bg-[#155994] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{t('requestNewLeave')}</span>
                </button>
              </div>

              {/* Applications History Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Leave Applications History</span>
                  <span className="text-xs font-semibold text-slate-400">{myLeaves.length} records</span>
                </h3>

                {loadingLeaves ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading leave applications...</div>
                ) : myLeaves.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 text-xs font-semibold">
                    {t('noLeavesYet')}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10">
                    <table className="w-full text-left rtl:text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="p-3 pl-4">{t('appliedOn')}</th>
                          <th className="p-3">{t('leaveType')}</th>
                          <th className="p-3">{t('dates')}</th>
                          <th className="p-3">{t('status')}</th>
                          <th className="p-3 pr-4 text-right rtl:text-left">{t('viewDocument')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                        {myLeaves.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="p-3 pl-4 text-slate-500 dark:text-gray-400 font-mono text-[11px]">
                              {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : '-'}
                            </td>
                            <td className="p-3 font-bold text-slate-900 dark:text-white">
                              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${
                                l.leaveType === 'Sick'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-blue-500/10 text-[#1D70B8] dark:text-blue-400'
                              }`}>
                                {l.leaveType} Leave
                              </span>
                            </td>
                            <td className="p-3 text-slate-700 dark:text-gray-300 font-mono text-[11px]">
                              {l.startDate} <span className="text-slate-400">➔</span> {l.endDate}
                              <span className="ml-1.5 font-bold text-slate-900 dark:text-white">({l.durationDays}d)</span>
                            </td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 ${
                                l.status === 'Approved'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                  : l.status === 'Rejected'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}>
                                {l.status === 'Approved' ? <CheckCircle2 className="w-3 h-3" /> : l.status === 'Rejected' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                <span>{l.status === 'Approved' ? t('approved') : l.status === 'Rejected' ? t('rejected') : t('pending')}</span>
                              </span>
                            </td>
                            <td className="p-3 pr-4 text-right rtl:text-left">
                              {l.documentUrl ? (
                                <button
                                  onClick={() => setPreviewDocUrl(l.documentUrl)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-white/20 text-[#1D70B8] dark:text-blue-400 font-bold text-[11px] border border-blue-200/60 dark:border-white/10 inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <FileText className="w-3 h-3" />
                                  <span>{t('viewDocument')}</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">None</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewDocUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Document Attachment Preview</span>
              </h3>
              <button
                onClick={() => setPreviewDocUrl(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-black/30">
              {previewDocUrl.startsWith('data:image') || previewDocUrl.match(/\.(png|jpe?g|webp)$/i) ? (
                <img src={previewDocUrl} alt="Attachment" className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-sm" />
              ) : (
                <iframe src={previewDocUrl} className="w-full h-[60vh] rounded-xl border-0" title="Attached Document" />
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2 bg-slate-50 dark:bg-white/5">
              <a
                href={previewDocUrl}
                download="leave_attachment"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#1D70B8] hover:bg-[#155994] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                Download / Open Full
              </a>
            </div>
          </div>
        </div>
      )}

      <LeaveModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={handleLeaveSubmit}
        balances={balances}
        userProfile={profile}
      />

      {isPipActive && (
        <PipWindow width={300} height={220} onClose={() => setIsPipActive(false)}>
          <CompactWidget
            isCheckedIn={isCheckedIn}
            onPunch={handlePunch}
            elapsedTime={elapsedTime}
          />
        </PipWindow>
      )}
    </div>
  );
}
