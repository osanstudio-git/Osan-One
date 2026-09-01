import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PunchRing } from '../components/employee/PunchRing';
import { LeaveModal } from '../components/employee/LeaveModal';
import { PipWindow } from '../components/pwa/PipWindow';
import { CompactWidget } from '../components/employee/CompactWidget';
import { ThemeToggle } from '../components/common/ThemeToggle';
import { Calendar, Clock, LogOut, CheckCircle2, History } from 'lucide-react';
import { getCompanySettings, calculateDistance, type CompanySettings } from '../lib/settings';
import { supabase } from '../lib/supabase';
import { MOCK_COMPANIES } from './hr/mockData';
import { saveOfflinePunch } from '../lib/offlineQueue';

interface WorkSession {
  id: string;
  checkIn: Date;
  checkOut?: Date;
  durationMs: number;
}

export function EmployeeDashboard() {
  const { profile, signOut } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  const balances = profile?.leave_balances || { yearly: 30, sick: 14, pregnancy: 0 };

  // Multi-session punch tracking
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [firstCheckInTime, setFirstCheckInTime] = useState<Date | null>(null);
  const [currentSessionStart, setCurrentSessionStart] = useState<Date | null>(null);

  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [now, setNow] = useState(new Date());
  const [settings, setSettings] = useState<CompanySettings | null>(null);

  const [companyName, setCompanyName] = useState<string>('');

  useEffect(() => {
    if (profile?.company_id) {
      getCompanySettings(profile.company_id).then(setSettings);

      supabase.from('companies').select('name').eq('id', profile.company_id).single()
        .then(({ data }) => {
          if (data) setCompanyName(data.name);
        });
    }
  }, [profile?.company_id]);

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
    
    let result = '';
    if (hrs > 0) result += `${hrs}h `;
    result += `${mins}m ${secs.toString().padStart(2, '0')}s`;
    return result;
  }, [cumulativeWorkedMs]);



  const handlePunch = async () => {
    if (!isCheckedIn && settings) {
      try {
        let isAuthorized = false;

        if (settings.office_ip) {
          try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            if (ipData.ip === settings.office_ip) {
              isAuthorized = true;
            }
          } catch (e) {
            console.warn("IP Check failed, falling back to GPS", e);
          }
        }

        if (!isAuthorized && settings.office_latitude && settings.office_longitude) {
          if ('geolocation' in navigator) {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true });
            });

            const distance = calculateDistance(
              position.coords.latitude,
              position.coords.longitude,
              settings.office_latitude,
              settings.office_longitude
            );

            if (distance <= 50) {
              isAuthorized = true;
            } else {
              alert(`Punch Denied: You are ${Math.round(distance)}m away from the office. You must be within 50m to check in.`);
              return;
            }
          } else {
            alert("Geolocation is not supported by your browser. Please use the Office Wi-Fi.");
            return;
          }
        }

        if (!isAuthorized && (!settings.office_latitude || !settings.office_longitude)) {
          alert("Warning: Office location is not fully configured by HR. Proceeding anyway.");
        }

      } catch (error) {
        console.error("Geofencing Error:", error);
        alert("Failed to verify location. Please allow location access.");
        return;
      }
    }

    await new Promise(r => setTimeout(r, 1000));

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
    }
  };

  const handleLeaveSubmit = async (data: any) => {
    console.log("Submitting leave request:", data);
    await new Promise(r => setTimeout(r, 1000));
  };

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
          <span>{shiftStart} (Start)</span>
          <span>{shiftEnd} (End)</span>
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
    const formattedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formattedDate = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        {/* Main Panel Clock */}
        <div className="text-center mb-8">
          <div className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow-xs mb-3">
            {formattedTime}
          </div>
          <div className="text-slate-500 dark:text-gray-400 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            {formattedDate}
          </div>
        </div>

        {/* CUMULATIVE WORKED HOURS TODAY KPI BADGE */}
        <div className="mb-8 px-6 py-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 shadow-lg shadow-emerald-500/5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400/80">Cumulative Worked Hours Today</span>
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">{formattedCumulativeWorked}</span>
          </div>
        </div>

        <PunchRing
          isCheckedIn={isCheckedIn}
          onPunch={handlePunch}
          disabledMessage={disabledMessage}
        />

        {/* Small text check-in time display */}
        {isCheckedIn && currentSessionStart && (
          <div className="mt-6 flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-6 py-2.5 rounded-full font-bold shadow-lg shadow-emerald-500/5 text-sm">
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
      <div className="w-full max-w-4xl flex justify-between items-center mb-12">
        <div>
          <h1 className="text-3xl font-extrabold mb-1 text-slate-900 dark:text-white">Hello, {profile?.name || 'Employee'}</h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm font-semibold">
            {profile?.role || 'Staff'}
            {companyName && <span className="ml-2 text-primary font-bold">@ {companyName}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {('documentPictureInPicture' in window) && (
            <button
              onClick={() => setIsPipActive(true)}
              disabled={isPipActive}
              className="px-4 py-2 bg-blue-500/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30 hover:bg-blue-500/20 rounded-xl transition-all font-bold text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="12" y="12" width="7" height="5"></rect><line x1="12" y1="12" x2="19" y2="17"></line></svg>
              Pop-out Widget
            </button>
          )}

          <button
            onClick={signOut}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-xs cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

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

      <button
        onClick={() => setIsLeaveModalOpen(true)}
        className="fixed bottom-24 md:bottom-8 right-4 md:right-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white p-4 rounded-2xl shadow-xl transition-all flex items-center gap-3 group cursor-pointer"
      >
        <Calendar className="w-6 h-6 text-amber-500 group-hover:scale-110 transition-transform" />
        <span className="font-bold text-xs pr-2">Request Leave</span>
      </button>

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
