import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PunchRing } from '../components/employee/PunchRing';
import { LeaveModal } from '../components/employee/LeaveModal';
import { PipWindow } from '../components/pwa/PipWindow';
import { CompactWidget } from '../components/employee/CompactWidget';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { LanguageToggle } from '../components/common/LanguageToggle';
import { useLanguage } from '../contexts/LanguageContext';
import { Calendar, Clock, LogOut, CheckCircle2, History, AlertTriangle, Building2, MapPin, FileText, XCircle, X, RefreshCw, UploadCloud } from 'lucide-react';
import { getCompanySettings, type CompanySettings } from '../lib/settings';
import { supabase } from '../lib/supabase';
import { MOCK_COMPANIES } from './hr/mockData';
import { saveOfflinePunch } from '../lib/offlineQueue';
import { recordPunchInDb, getTodayAttendanceLogFromDb, createLeaveRequestInDb, getEmployeeLeaveRequestsFromDb, getSavedLocalAvatar, getEmployeeAvatarFromDb, syncAvatarToCloud, invalidateEmployeeCache, invalidateCompanyCache, attachMedicalReportToLeaveInDb } from '../lib/databaseService';
import { EmployeeProfileModal } from '../components/employee/EmployeeProfileModal';
import { EmployeeAttendanceTimesheet } from '../components/employee/EmployeeAttendanceTimesheet';

interface WorkSession {
  id: string;
  checkIn: Date;
  checkOut?: Date;
  durationMs: number;
}

export function EmployeeDashboard() {
  const { profile, signOut, updateCurrentUserProfile } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'punch' | 'timesheet'>('punch');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleHardRefresh = async () => {
    setIsSyncing(true);
    try {
      invalidateEmployeeCache();
      invalidateCompanyCache();

      // Check for Service Worker update safely without deleting Workbox precache
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
      window.location.reload();
    }
  };

  // Dynamic avatar state with multi-key cache & cloud sync
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(() => {
    return profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : undefined);
  });

  useEffect(() => {
    if (!profile) return;
    const local = getSavedLocalAvatar(profile.id, profile.email, profile.phone);
    const initial = profile.avatar_url || local;
    if (initial) {
      setAvatarUrl(initial);
      if (profile.id && local) {
        syncAvatarToCloud(profile.id, local);
      }
    }

    if (profile.id) {
      getEmployeeAvatarFromDb(profile.id, profile.email, profile.phone).then(cloudAv => {
        if (cloudAv) {
          setAvatarUrl(cloudAv);
          if (!profile.avatar_url) {
            updateCurrentUserProfile({ avatar_url: cloudAv });
          }
        }
      });
    }
  }, [profile?.id, profile?.avatar_url, profile?.email, profile?.phone]);

  useEffect(() => {
    const handleAvatarUpdate = (e: any) => {
      const detail = e?.detail;
      if (detail && profile && (detail.id === profile.id || detail.id === profile.email)) {
        setAvatarUrl(detail.avatarUrl);
      }
    };
    window.addEventListener('osan_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('osan_avatar_updated', handleAvatarUpdate);
  }, [profile?.id, profile?.email]);

  // Multi-session punch tracking
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [firstCheckInTime, setFirstCheckInTime] = useState<Date | null>(null);
  const [currentSessionStart, setCurrentSessionStart] = useState<Date | null>(null);

  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [companyName, setCompanyName] = useState<string>('');

  const isAsas = useMemo(() => {
    const cName = (companyName || profile?.company || profile?.company_id || '').toLowerCase();
    return cName.includes('asas') || cName.includes('sanad');
  }, [companyName, profile?.company, profile?.company_id]);

  const dayOfWeek = now.getDay();
  const isThursday = dayOfWeek === 4;
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

  // Selected shift for ASAS / dual-shift centers
  const [selectedShift, setSelectedShift] = useState<'morning' | 'evening'>(() => {
    const today = new Date();
    if (today.getDay() === 4) return 'morning'; // Thursday only has morning shift
    const dateStr = today.toISOString().split('T')[0];
    const saved = typeof window !== 'undefined' ? localStorage.getItem(`osan_shift_${dateStr}`) : null;
    if (saved === 'evening' || saved === 'morning') return saved;
    // Auto-select based on time: after 11:15 AM defaults to evening
    const mins = today.getHours() * 60 + today.getMinutes();
    return mins >= (11 * 60 + 15) ? 'evening' : 'morning';
  });

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
            if (parsed.shiftType) {
              setSelectedShift(parsed.shiftType);
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

        } else {
          const outDate = new Date(log.clock_out_time);
          setIsCheckedIn(false);
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
        localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({
          isCheckedIn: true,
          checkInTime: nowTime.toISOString(),
          shiftType: selectedShift
        }));
        recordPunchInDb(
          profile.id,
          'clock_in',
          nowTime,
          profile.company_id,
          selectedShift,
          companyName || profile?.company
        ).catch(console.error);
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
      if (profile?.id) {
        localStorage.setItem(`osan_punch_${profile.id}`, JSON.stringify({ isCheckedIn: false }));
        recordPunchInDb(
          profile.id,
          'clock_out',
          nowTime,
          profile.company_id,
          selectedShift,
          companyName || profile?.company
        ).catch(console.error);
      }
    }
  };



  // Leave requests & balance tracking
  const [myLeaves, setMyLeaves] = useState<any[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [isLeavesModalOpen, setIsLeavesModalOpen] = useState(false);
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  // Live employee balances directly synchronized with database
  const [liveBalances, setLiveBalances] = useState<{ yearly: number; sick: number; pregnancy: number }>({
    yearly: profile?.leave_balances?.yearly ?? 30,
    sick: profile?.leave_balances?.sick ?? 14,
    pregnancy: profile?.leave_balances?.pregnancy ?? 98,
  });

  // Ensure avatar is synced immediately from local storage cache & Supabase
  useEffect(() => {
    if (!profile?.id) return;
    const cached = getSavedLocalAvatar(profile.id, profile.email, profile.phone);
    if (cached && profile.avatar_url !== cached) {
      updateCurrentUserProfile({ avatar_url: cached });
    }

    getEmployeeAvatarFromDb(profile.id).then(cloudAvatar => {
      if (cloudAvatar && profile.avatar_url !== cloudAvatar) {
        updateCurrentUserProfile({ avatar_url: cloudAvatar });
      }
    });

    const handleAvatarUpdate = (e: any) => {
      const { id, avatarUrl } = e.detail || {};
      if (id && profile && (profile.id === id || profile.email === id || profile.phone === id)) {
        updateCurrentUserProfile({ avatar_url: avatarUrl });
      }
    };
    window.addEventListener('osan_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('osan_avatar_updated', handleAvatarUpdate);
  }, [profile?.id, profile?.email, profile?.phone]);

  const loadEmployeeLeaves = async () => {
    if (!profile?.id) return;
    setLoadingLeaves(true);
    try {
      const leaves = await getEmployeeLeaveRequestsFromDb(profile.id, profile.email);
      setMyLeaves(leaves);

      // Query live balances safely from users table without nonexistent avatar_url column
      const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(profile.id);
      let query = supabase.from('users').select('id, name, gender, religion, nationality, leave_balance_yearly, leave_balance_sick, leave_balance_maternity, documents');
      if (isUuid) {
        query = query.eq('id', profile.id);
      } else if (profile.email) {
        query = query.eq('email', profile.email);
      }

      const { data: userData } = await query.maybeSingle();
      if (userData) {
        const updated = {
          yearly: userData.leave_balance_yearly ?? 30,
          sick: userData.leave_balance_sick ?? 14,
          pregnancy: userData.leave_balance_maternity ?? 98,
        };
        setLiveBalances(updated);

        const cloudAvatar = await getEmployeeAvatarFromDb(profile.id);
        const localAvatar = getSavedLocalAvatar(profile.id, profile.email, profile.phone);
        const effectiveAvatar = cloudAvatar || localAvatar || profile.avatar_url;

        updateCurrentUserProfile({
          ...(effectiveAvatar && profile.avatar_url !== effectiveAvatar ? { avatar_url: effectiveAvatar } : {}),
          ...(userData.gender ? { gender: userData.gender } : {}),
          ...(userData.religion ? { religion: userData.religion } : {}),
          ...(userData.nationality ? { nationality: userData.nationality } : {})
        });

        // Also sync local demo profile so any other components read the latest balances
        const saved = localStorage.getItem('osan_demo_profile');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            parsed.leave_balances = updated;
            if (effectiveAvatar) parsed.avatar_url = effectiveAvatar;
            if (userData.gender) parsed.gender = userData.gender;
            if (userData.religion) parsed.religion = userData.religion;
            if (userData.nationality) parsed.nationality = userData.nationality;
            localStorage.setItem('osan_demo_profile', JSON.stringify(parsed));
          } catch (e) { }
        }
      }
    } catch (err) {
      console.error('Failed to load employee leaves and balances:', err);
    } finally {
      setLoadingLeaves(false);
    }
  };

  useEffect(() => {
    loadEmployeeLeaves();

    // 1. Subscribe to leave request status changes (Pending -> Approved/Rejected)
    const leaveChannel = supabase
      .channel(`emp-leaves-${profile?.id || 'live'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadEmployeeLeaves();
      })
      .subscribe();

    // 2. Subscribe to user balance updates in realtime
    const userChannel = supabase
      .channel(`emp-user-bal-${profile?.id || 'live'}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, () => {
        loadEmployeeLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(userChannel);
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
        notes: data.notes,
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

  const handleUploadMedicalDoc = async (leaveId: string, file: File) => {
    try {
      const base64 = await convertFileToBase64(file);
      const success = await attachMedicalReportToLeaveInDb(leaveId, base64);
      if (success) {
        alert('Medical report uploaded successfully! HR can now review it.');
        await loadEmployeeLeaves();
      } else {
        alert('Failed to upload medical report. Please try again.');
      }
    } catch (e) {
      console.error('Failed to upload medical report:', e);
      alert('Error reading medical file.');
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

  const yearlyRemaining = liveBalances.yearly;
  const sickRemaining = liveBalances.sick;
  const yearlyTotal = Math.max(30, yearlyRemaining + approvedYearlyDays);
  const sickTotal = Math.max(14, sickRemaining + approvedSickDays);

  const [isPipActive, setIsPipActive] = useState(false);

  const disabledMessage = null;



  const isOmani = profile?.nationality === 'OMAN' || profile?.nationality === 'Omani';
  const activeCompany = MOCK_COMPANIES.find(c => c.name === companyName) || MOCK_COMPANIES[0];

  let shiftStart = isOmani ? (activeCompany.omaniShiftStart || '08:30') : (activeCompany.expatShiftStart || '08:30');
  let shiftEnd = isOmani ? (activeCompany.omaniShiftEnd || '17:00') : (activeCompany.expatShiftEnd || '18:00');

  if (isAsas) {
    if (isThursday) {
      shiftStart = '08:00';
      shiftEnd = '15:00';
    } else if (selectedShift === 'evening') {
      shiftStart = '12:00';
      shiftEnd = '20:00';
    } else {
      shiftStart = '08:00';
      shiftEnd = '17:00';
    }
  }

  const renderJourneyBar = () => {
    if (!profile) return null;

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
        <div className="mb-6 px-6 py-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 shadow-lg shadow-emerald-500/5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col text-left rtl:text-right">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/80">{t('cumulativeWorkedToday')}</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight" translate="no">{formattedCumulativeWorked}</span>
          </div>
        </div>

        {/* ASAS / SANAD CENTER DYNAMIC SHIFT SELECTOR */}
        {isAsas && !isCheckedIn && !isWeekend && (
          isThursday ? (
            <div className="mb-6 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-300 font-bold max-w-md w-full justify-center shadow-xs animate-in fade-in duration-200">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Thursday Schedule: Single Morning Shift (08:00 AM – 03:00 PM)</span>
            </div>
          ) : (
            <div className="mb-6 max-w-md w-full flex flex-col items-center gap-2 animate-in fade-in duration-200">
              <div className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Select Today's Assigned Shift</span>
              </div>
              <div className="grid grid-cols-2 p-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl w-full gap-2 shadow-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedShift('morning');
                    localStorage.setItem(`osan_shift_${now.toISOString().split('T')[0]}`, 'morning');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${selectedShift === 'morning'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <span className="flex items-center gap-1">☀️ Morning Shift</span>
                  <span className="text-[10px] font-semibold opacity-75">08:00 AM – 05:00 PM</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedShift('evening');
                    localStorage.setItem(`osan_shift_${now.toISOString().split('T')[0]}`, 'evening');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${selectedShift === 'evening'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/30 ring-1 ring-indigo-500/20'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  <span className="flex items-center gap-1">🌙 Evening Shift</span>
                  <span className="text-[10px] font-semibold opacity-75">12:00 PM – 08:00 PM</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* If already checked in at ASAS, display which shift is active */}
        {isAsas && isCheckedIn && (
          <div className="mb-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>
              {isThursday
                ? 'Thursday Shift: 08:00 AM – 03:00 PM'
                : selectedShift === 'evening'
                  ? 'Active: Evening Shift (12:00 PM – 08:00 PM)'
                  : 'Active: Morning Shift (08:00 AM – 05:00 PM)'}
            </span>
          </div>
        )}

        <PunchRing
          isCheckedIn={isCheckedIn}
          onPunch={handlePunch}
          disabledMessage={disabledMessage}
          companySettings={settings}
          companyName={companyName || profile?.company}
          companyId={profile?.company_id || profile?.company}
        />

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
      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        {/* Interactive Profile Badge Trigger */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="group flex items-center gap-3.5 text-left p-1.5 pr-4 rounded-2xl hover:bg-white dark:hover:bg-white/5 border border-transparent hover:border-slate-200 dark:border-white/10 transition-all cursor-pointer shadow-2xs"
            title="Click to view your employment profile"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile?.name} className="w-full h-full object-cover" />
              ) : profile?.name ? (
                profile.name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
              ) : (
                'EM'
              )}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-primary transition-colors">
                {profile?.name || 'Employee'}
              </h1>
              <p className="text-primary text-xs font-extrabold tracking-wider uppercase mt-0.5">
                {companyName || profile?.company || 'OSAN GROUP'}
              </p>
            </div>
          </button>
        </div>

        {/* View Switcher Tabs & Controls */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Segmented Switcher Tab */}
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-white/10 rounded-2xl shadow-inner border border-slate-300/40 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('punch')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'punch'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>Live Punch</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timesheet')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${activeTab === 'timesheet'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>My Timesheet</span>
            </button>
          </div>

          <LanguageToggle />
          <ThemeToggle />

          {/* 1-Tap Hard Refresh & Cloud Sync */}
          <button
            type="button"
            onClick={handleHardRefresh}
            disabled={isSyncing}
            className="p-2 sm:px-3 sm:py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
            title="Live Sync: Refresh attendance and cloud profile data"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

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
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer"
            title={t('signOut')}
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* DOCUMENT EXPIRATION ALERT BANNER */}
      {expiringDocuments.length > 0 && (
        <div className="w-full max-w-5xl mb-6 space-y-2">
          {expiringDocuments.map((doc, idx) => {
            const isExpired = doc.daysRemaining < 0;
            return (
              <div
                key={doc.id || idx}
                className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${isExpired
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
        {activeTab === 'punch' ? (
          isPipActive ? (
            <div className="text-center p-12 border border-dashed border-slate-300 dark:border-gray-700 rounded-3xl bg-white dark:bg-slate-900/60 opacity-60">
              <h2 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Widget is Active</h2>
              <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Your check-in ring is hovering on your screen.</p>
            </div>
          ) : (
            renderPunchUI()
          )
        ) : (
          profile && (
            <EmployeeAttendanceTimesheet
              userId={profile.id}
              userName={profile.name}
              nationality={profile.nationality}
              joinDate={profile.join_date}
              scheduledShiftStart={shiftStart}
              scheduledShiftEnd={shiftEnd}
              avatarUrl={profile.avatar_url}
              companyName={companyName || profile.company}
              phone={profile.phone}
            />
          )
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10 animate-in fade-in zoom-in-95 duration-200">
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
                    <span>{t('total')}: <strong>{yearlyTotal}d</strong></span>
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
                    <span>{t('total')}: <strong>{sickTotal}d</strong></span>
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
                  <p className="text-xs text-slate-500 dark:text-gray-400">Submit a new leave application with your preferred dates and reason notes.</p>
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
                  <>
                    {/* 1. Mobile Cards Layout (< md screens) */}
                    <div className="block md:hidden space-y-3">
                      {myLeaves.map((l) => (
                        <div key={l.id} className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-3 shadow-xs">
                          {/* Top Row: Type & Status */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap ${
                                l.leaveType === 'Sick'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/10 text-[#1D70B8] dark:text-blue-400 border border-blue-500/20'
                              }`}>
                                {l.leaveType} Leave
                              </span>
                              <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                                {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : ''}
                              </span>
                            </div>

                            {/* Status in one line */}
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                              l.status === 'Approved'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : l.status === 'Rejected'
                                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                              {l.status === 'Approved' ? <CheckCircle2 className="w-3.5 h-3.5" /> : l.status === 'Rejected' ? <XCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                              <span className="whitespace-nowrap">{l.status === 'Approved' ? t('approved') : l.status === 'Rejected' ? t('rejected') : t('pending')}</span>
                            </span>
                          </div>

                          {/* Date Range & Duration */}
                          <div className="flex items-center justify-between text-xs bg-white dark:bg-white/5 p-2.5 rounded-xl border border-slate-200/60 dark:border-white/5 font-mono">
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-gray-200">
                              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                              <span className="whitespace-nowrap font-semibold">{l.startDate}</span>
                              <span className="text-slate-400">➔</span>
                              <span className="whitespace-nowrap font-semibold">{l.endDate}</span>
                            </div>
                            <span className="font-extrabold text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shrink-0">
                              {l.durationDays}d
                            </span>
                          </div>

                          {/* Reason note if provided */}
                          {l.notes && (
                            <div className="text-xs text-slate-600 dark:text-gray-300 italic bg-amber-500/5 dark:bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/10">
                              <span className="font-semibold text-slate-400 not-italic mr-1.5">Note:</span>
                              "{l.notes}"
                            </div>
                          )}

                          {/* Action Button: Medical Report */}
                          <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 dark:border-white/5">
                            <span className="text-[11px] font-semibold text-slate-400">Medical Document</span>
                            {l.documentUrl ? (
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={() => setPreviewDocUrl(l.documentUrl)}
                                  className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-white/10 text-[#1D70B8] dark:text-blue-400 font-bold text-xs border border-blue-200/60 dark:border-white/10 inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Report</span>
                                </button>
                                <label className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" title="Replace / Update">
                                  <UploadCloud className="w-4 h-4" />
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept="image/*,.pdf"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) handleUploadMedicalDoc(l.id, f);
                                    }}
                                  />
                                </label>
                              </div>
                            ) : ((l.leaveType || '').toLowerCase().includes('sick') || (l.leaveType || '').toLowerCase().includes('maternity')) ? (
                              <label className={`px-3 py-1.5 rounded-lg font-bold text-xs border inline-flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                                l.status === 'Approved'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              }`}>
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>+ Upload Medical Report</span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleUploadMedicalDoc(l.id, f);
                                  }}
                                />
                              </label>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Not required</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 2. Desktop Structured Table (>= md screens) */}
                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs">
                      <table className="w-full text-left rtl:text-right text-xs">
                        <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                          <tr>
                            <th className="py-3 px-4 whitespace-nowrap">{t('appliedOn')}</th>
                            <th className="py-3 px-4 whitespace-nowrap">{t('leaveType')}</th>
                            <th className="py-3 px-4 whitespace-nowrap">{t('dates')}</th>
                            <th className="py-3 px-4 whitespace-nowrap">{t('status')}</th>
                            <th className="py-3 px-4 text-right rtl:text-left whitespace-nowrap">Medical Report / Document</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                          {myLeaves.map((l) => (
                            <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                              {/* Applied On: 1 line */}
                              <td className="py-3.5 px-4 text-slate-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">
                                {l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : '-'}
                              </td>

                              {/* Leave Type + note */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="flex flex-col gap-0.5">
                                  <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold w-fit whitespace-nowrap ${
                                    l.leaveType === 'Sick'
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                      : 'bg-blue-500/10 text-[#1D70B8] dark:text-blue-400'
                                  }`}>
                                    {l.leaveType} Leave
                                  </span>
                                  {l.notes && (
                                    <p className="text-[11px] text-slate-500 dark:text-gray-400 italic truncate max-w-[200px]" title={l.notes}>
                                      "{l.notes}"
                                    </p>
                                  )}
                                </div>
                              </td>

                              {/* Dates: 1 line, never breaks! */}
                              <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-gray-300 whitespace-nowrap">
                                <span className="font-semibold">{l.startDate}</span>
                                <span className="text-slate-400 mx-1.5">➔</span>
                                <span className="font-semibold">{l.endDate}</span>
                                <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 font-bold text-slate-900 dark:text-white text-[11px]">
                                  {l.durationDays}d
                                </span>
                              </td>

                              {/* Status: 1 line, never breaks! */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                                  l.status === 'Approved'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : l.status === 'Rejected'
                                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}>
                                  {l.status === 'Approved' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : l.status === 'Rejected' ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3.5 h-3.5 shrink-0" />}
                                  <span className="whitespace-nowrap">{l.status === 'Approved' ? t('approved') : l.status === 'Rejected' ? t('rejected') : t('pending')}</span>
                                </span>
                              </td>

                              {/* Medical Report / Document: 1 line */}
                              <td className="py-3.5 px-4 text-right rtl:text-left whitespace-nowrap">
                                {l.documentUrl ? (
                                  <div className="inline-flex items-center gap-2 justify-end">
                                    <button
                                      onClick={() => setPreviewDocUrl(l.documentUrl)}
                                      className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-white/20 text-[#1D70B8] dark:text-blue-400 font-bold text-xs border border-blue-200/60 dark:border-white/10 inline-flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs whitespace-nowrap"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>View Report</span>
                                    </button>
                                    <label className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" title="Replace / Update medical report">
                                      <UploadCloud className="w-3.5 h-3.5" />
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*,.pdf"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (f) handleUploadMedicalDoc(l.id, f);
                                        }}
                                      />
                                    </label>
                                  </div>
                                ) : ((l.leaveType || '').toLowerCase().includes('sick') || (l.leaveType || '').toLowerCase().includes('maternity')) ? (
                                  <label className={`px-3 py-1 rounded-lg font-bold text-xs border inline-flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs whitespace-nowrap ${
                                    l.status === 'Approved'
                                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-2 ring-emerald-500/10'
                                      : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                  }`} title="Upload Doctor / Hospital Sick Leave Certificate">
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>+ Upload Medical Report</span>
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept="image/*,.pdf"
                                      onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleUploadMedicalDoc(l.id, f);
                                      }}
                                    />
                                  </label>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">None</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
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
        balances={liveBalances}
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

      {/* EMPLOYEE PROFILE MODAL */}
      <EmployeeProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={profile ? { ...profile, avatar_url: avatarUrl || profile.avatar_url } : null}
        companyName={companyName}
        shiftSchedule={{
          start: shiftStart,
          end: shiftEnd,
        }}
        onAvatarChange={(newUrl) => {
          setAvatarUrl(newUrl);
          updateCurrentUserProfile({ avatar_url: newUrl });
        }}
      />
    </div>
  );
}
