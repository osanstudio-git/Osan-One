import { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Calendar, Clock, 
  CheckCircle2, AlertTriangle, AlertCircle, 
  Palmtree, Sparkles, FilterX, Download
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { isDatePublicHoliday } from '../../lib/holidayService';
import { generateMonthlyAttendanceReport } from '../../lib/attendanceReportService';

interface EmployeeAttendanceTimesheetProps {
  userId: string;
  userName?: string;
  nationality?: string;
  joinDate?: string;
  scheduledShiftStart?: string;
  scheduledShiftEnd?: string;
  avatarUrl?: string;
  companyName?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function EmployeeAttendanceTimesheet({
  userId,
  userName,
  nationality = 'Omani',
  joinDate = '2024-01-01',
  scheduledShiftStart = '08:30 AM',
  scheduledShiftEnd = '05:00 PM',
  avatarUrl,
  companyName = 'OSAN GROUP'
}: EmployeeAttendanceTimesheetProps) {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [dbLeaves, setDbLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Month navigation
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
    setSelectedCalendarDate(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
    setSelectedCalendarDate(null);
  };

  const handleCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setSelectedCalendarDate(null);
  };

  // Fetch employee's own logs and leaves for the selected month
  useEffect(() => {
    if (!userId) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        const startStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const endStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch user's own attendance logs
        const { data: logsData, error: logsErr } = await supabase
          .from('attendance_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('date', startStr)
          .lte('date', endStr)
          .order('date', { ascending: true });

        if (logsErr) console.error('Error fetching logs:', logsErr.message);

        // 2. Fetch user's approved leave requests
        const { data: leavesData, error: leavesErr } = await supabase
          .from('leave_requests')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'Approved');

        if (leavesErr) console.error('Error fetching leaves:', leavesErr.message);

        if (isMounted) {
          setDbLogs(logsData || []);
          setDbLeaves(leavesData || []);
        }
      } catch (err) {
        console.error('Failed to load monthly attendance data:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [userId, selectedYear, selectedMonth]);

  // Days in month calculation
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Build daily items for the calendar & feed table
  const monthlyHeatmapData = useMemo(() => {
    return Array.from({ length: daysInSelectedMonth }).map((_, i) => {
      const dayNum = i + 1;
      const dateObj = new Date(selectedYear, selectedMonth, dayNum);
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dStr = String(dayNum).padStart(2, '0');
      const dateStr = `${selectedYear}-${mStr}-${dStr}`;

      const isOmani = nationality === 'Omani';
      const dayOfWeek = dateObj.getDay();
      // Omani weekend is Friday & Saturday; Expat weekend is Friday
      const isWeekend = isOmani ? (dayOfWeek === 5 || dayOfWeek === 6) : (dayOfWeek === 5);

      const publicHoliday = isDatePublicHoliday(dateStr);
      const isFuture = dateStr > todayStr;

      // Real attendance log
      const realLog = dbLogs.find(l => {
        if (l.date === dateStr) return true;
        if (l.clock_in_time && l.clock_in_time.startsWith(dateStr)) return true;
        return false;
      });

      // Approved leave covering this date
      const realLeave = dbLeaves.find(l => {
        const s = l.start_date || l.startDate;
        const e = l.end_date || l.endDate;
        if (s && e) {
          return dateStr >= s && dateStr <= e;
        }
        return false;
      });

      let status: 'present' | 'late' | 'absent' | 'weekend' | 'leave' | 'holiday' = 'weekend';
      let clockInText = '--:--';
      let clockOutText = '--:--';
      let shiftDurationText = '0m';
      let totalMinutesWorked = 0;
      let lateMinutes = 0;

      if (publicHoliday) {
        status = 'holiday';
        clockInText = 'OFF (Paid)';
        clockOutText = 'OFF (Paid)';
        shiftDurationText = 'Paid Holiday';
      } else if (realLeave) {
        status = 'leave';
        const leaveLabel = realLeave.leave_type || realLeave.type || 'Approved Leave';
        clockInText = `Leave (${leaveLabel})`;
        clockOutText = `Leave (${leaveLabel})`;
        shiftDurationText = 'Approved Leave';
      } else if (realLog) {
        const rawStatus = (realLog.status || '').toLowerCase();
        const isInLate = rawStatus.includes('late');

        if (isInLate) {
          status = 'late';
        } else {
          status = 'present';
        }

        if (realLog.clock_in_time) {
          const inDate = new Date(realLog.clock_in_time);
          clockInText = inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          // Calculate approximate late arrival if marked late
          if (isInLate) {
            const [shiftH, shiftM] = scheduledShiftStart.replace(/[^0-9:]/g, '').split(':').map(Number);
            const isPM = scheduledShiftStart.toUpperCase().includes('PM') && shiftH < 12;
            const targetH = isPM ? shiftH + 12 : shiftH;
            const scheduledStartToday = new Date(inDate);
            scheduledStartToday.setHours(targetH || 8, shiftM || 30, 0, 0);

            const diffMins = Math.floor((inDate.getTime() - scheduledStartToday.getTime()) / (1000 * 60));
            lateMinutes = Math.max(1, diffMins);
          }
        } else {
          clockInText = '08:00 AM';
        }

        if (realLog.clock_out_time) {
          const outDate = new Date(realLog.clock_out_time);
          clockOutText = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (realLog.clock_in_time) {
            const diffMs = new Date(realLog.clock_out_time).getTime() - new Date(realLog.clock_in_time).getTime();
            totalMinutesWorked = Math.max(0, Math.floor(diffMs / (1000 * 60)));
            const hrs = Math.floor(totalMinutesWorked / 60);
            const mins = totalMinutesWorked % 60;
            if (hrs > 0 && mins > 0) {
              shiftDurationText = `${hrs}h ${mins}m`;
            } else if (hrs > 0) {
              shiftDurationText = `${hrs}h`;
            } else {
              shiftDurationText = `${mins}m`;
            }
          } else {
            shiftDurationText = '8h 0m';
            totalMinutesWorked = 480;
          }
        } else {
          clockOutText = 'Active Shift';
          shiftDurationText = 'In Progress';
        }
      } else if (isWeekend) {
        status = 'weekend';
        clockInText = 'Weekend Off';
        clockOutText = 'Weekend Off';
        shiftDurationText = 'Off';
      } else if (!isFuture) {
        const join = joinDate || '2024-01-01';
        if (dateStr < todayStr && dateStr >= join) {
          status = 'absent';
          clockInText = 'No Punch Record';
          clockOutText = 'No Punch Record';
          shiftDurationText = '0m';
        } else if (dateStr === todayStr) {
          status = 'weekend';
          clockInText = 'Not Checked In Yet';
          clockOutText = '--:--';
          shiftDurationText = '--:--';
        } else {
          status = 'weekend';
          clockInText = '--:--';
          clockOutText = '--:--';
          shiftDurationText = '--:--';
        }
      } else {
        status = 'weekend';
        clockInText = '--:--';
        clockOutText = '--:--';
        shiftDurationText = '--:--';
      }

      return {
        dayNum,
        date: dateObj,
        dateStr,
        status,
        clockInText,
        clockOutText,
        shiftDurationText,
        totalMinutesWorked,
        lateMinutes,
        holidayName: publicHoliday?.name
      };
    });
  }, [selectedYear, selectedMonth, daysInSelectedMonth, nationality, todayStr, dbLogs, dbLeaves, joinDate, scheduledShiftStart]);

  // Aggregate monthly KPIs
  const monthlyStats = useMemo(() => {
    const presentDays = monthlyHeatmapData.filter(d => d.status === 'present').length;
    const lateDays = monthlyHeatmapData.filter(d => d.status === 'late').length;
    const absentDays = monthlyHeatmapData.filter(d => d.status === 'absent').length;
    const leaveDays = monthlyHeatmapData.filter(d => d.status === 'leave').length;

    const totalMinutes = monthlyHeatmapData.reduce((sum, d) => sum + d.totalMinutesWorked, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;

    return {
      presentDays,
      lateDays,
      absentDays,
      leaveDays,
      totalHours,
      remMinutes,
      totalWorkingDaysCount: presentDays + lateDays
    };
  }, [monthlyHeatmapData]);

  const getHeatmapColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-xs';
      case 'late': return 'bg-amber-500 hover:bg-amber-400 text-white shadow-xs';
      case 'absent': return 'bg-rose-500 hover:bg-rose-400 text-white shadow-xs';
      case 'holiday': return 'bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-xs';
      case 'leave': return 'bg-blue-500 hover:bg-blue-400 text-white shadow-xs';
      case 'weekend': return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border border-slate-200/60 dark:border-white/5';
      default: return 'bg-slate-100 dark:bg-white/5';
    }
  };

  // Filter table logs: show all days or specific filtered calendar day
  const filteredFeedData = useMemo(() => {
    return monthlyHeatmapData.filter(d => {
      if (selectedCalendarDate) {
        return d.dateStr === selectedCalendarDate;
      }
      // Hide empty weekends by default to keep table compact & relevant
      return d.status !== 'weekend' || d.totalMinutesWorked > 0;
    });
  }, [monthlyHeatmapData, selectedCalendarDate]);

  return (
    <div className="w-full max-w-5xl space-y-6 animate-in fade-in duration-300">
      
      {/* Month Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {MONTH_NAMES[selectedMonth]} {selectedYear}
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">
              {userName ? `${userName} • ` : ''}Scheduled: {scheduledShiftStart} – {scheduledShiftEnd}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleCurrentMonth}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-gray-300 transition-all cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-bold text-slate-700 dark:text-gray-300">
              {MONTH_NAMES[selectedMonth].substring(0, 3)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-gray-300 transition-all cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              generateMonthlyAttendanceReport({
                employee: {
                  id: userId,
                  name: userName || 'Employee',
                  nationality,
                  join_date: joinDate,
                  avatar_url: avatarUrl,
                },
                companyName: companyName || 'OSAN GROUP',
                monthIndex: selectedMonth,
                year: selectedYear,
                shiftStart: scheduledShiftStart,
                shiftEnd: scheduledShiftEnd,
                dailyLogs: monthlyHeatmapData,
              });
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            title={`Download / Print ${MONTH_NAMES[selectedMonth]} ${selectedYear} Attendance Sheet`}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download Sheet</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Hours Worked */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Worked Hours</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {monthlyStats.totalHours}h {monthlyStats.remMinutes > 0 ? `${monthlyStats.remMinutes}m` : ''}
            </span>
          </div>
        </div>

        {/* Days Present */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Days Present</span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {monthlyStats.presentDays} <span className="text-xs font-normal text-slate-400">days</span>
            </span>
          </div>
        </div>

        {/* Late Arrivals */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late Arrivals</span>
            <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              {monthlyStats.lateDays} <span className="text-xs font-normal text-slate-400">times</span>
            </span>
          </div>
        </div>

        {/* Absences */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Absences</span>
            <span className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {monthlyStats.absentDays} <span className="text-xs font-normal text-slate-400">days</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Two Column Layout (Heatmap Grid + Attendance Feed Table) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Left Column: Monthly Heatmap Grid (Matching Screenshot 2) */}
        <div className="xl:col-span-1 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {MONTH_NAMES[selectedMonth]} {selectedYear} Heatmap Grid
              </h3>
              {selectedCalendarDate && (
                <button
                  onClick={() => setSelectedCalendarDate(null)}
                  className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <FilterX className="w-3 h-3" /> Clear
                </button>
              )}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={`${day}-${idx}`} className="text-center text-[11px] font-black text-slate-400 dark:text-gray-500 mb-1">
                  {day}
                </div>
              ))}

              {/* Offset for 1st day of month */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`offset-${i}`} className="aspect-square rounded-xl bg-transparent" />
              ))}

              {/* Days */}
              {monthlyHeatmapData.map((data, i) => {
                const isSelected = selectedCalendarDate === data.dateStr;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedCalendarDate(isSelected ? null : data.dateStr)}
                    title={`${data.dateStr}: ${data.status.toUpperCase()} (Click to inspect day)`}
                    className={`aspect-square rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${getHeatmapColor(data.status)} ${
                      isSelected ? 'ring-3 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-105 z-10' : ''
                    }`}
                  >
                    <span>{data.dayNum}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Heatmap Legend */}
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-600 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Present</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> Late</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" /> Absent</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" /> Holiday</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" /> Leave</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700 shrink-0" /> Off</span>
          </div>
        </div>

        {/* Right Column: Attendance Log Feed Table (Matching Screenshot 2) */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Attendance Log Feed — {MONTH_NAMES[selectedMonth]} {selectedYear}
              </h3>
              {selectedCalendarDate ? (
                <p className="text-xs font-bold text-primary mt-0.5">
                  Filtered for selected date: {new Date(selectedCalendarDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  Showing recorded shifts and attendance statuses for this month
                </p>
              )}
            </div>

            {selectedCalendarDate && (
              <button
                onClick={() => setSelectedCalendarDate(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[550px]">
              <thead className="bg-slate-50/80 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 pl-6">Date</th>
                  <th className="py-3.5 px-4">Punch In</th>
                  <th className="py-3.5 px-4">Punch Out</th>
                  <th className="py-3.5 px-4">Shift Hours</th>
                  <th className="py-3.5 px-4 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        <span>Loading your monthly attendance logs...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredFeedData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                      No attendance activity recorded for this period.
                    </td>
                  </tr>
                ) : (
                  filteredFeedData.map((log) => {
                    const formattedDate = log.date.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: 'short', 
                      year: 'numeric' 
                    });
                    const isSelectedRow = selectedCalendarDate === log.dateStr;

                    return (
                      <tr 
                        key={log.dateStr} 
                        className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${
                          isSelectedRow ? 'bg-primary/5 dark:bg-primary/10' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 pl-6 font-bold text-slate-900 dark:text-white">
                          <div>{formattedDate}</div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {log.date.toLocaleDateString('en-GB', { weekday: 'short' })}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-gray-300">
                          {log.clockInText}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700 dark:text-gray-300">
                          {log.clockOutText}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-gray-200">
                          {log.shiftDurationText}
                        </td>
                        <td className="py-3.5 px-4 pr-6 text-right">
                          {log.status === 'present' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              On Time
                            </span>
                          )}
                          {log.status === 'late' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Late Warning {log.lateMinutes > 0 ? `(${log.lateMinutes}m)` : ''}
                            </span>
                          )}
                          {log.status === 'absent' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Absent
                            </span>
                          )}
                          {log.status === 'holiday' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                              <Sparkles className="w-3 h-3 text-purple-500" />
                              Holiday
                            </span>
                          )}
                          {log.status === 'leave' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                              <Palmtree className="w-3 h-3 text-blue-500" />
                              Approved Leave
                            </span>
                          )}
                          {log.status === 'weekend' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-gray-400">
                              Weekend
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
