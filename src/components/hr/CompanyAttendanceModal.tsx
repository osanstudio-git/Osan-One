import { useState, useEffect, useMemo } from 'react';
import { 
  X, Users, CheckCircle2, Clock, Calendar, Search, 
  MessageSquare, ExternalLink, Activity, 
  AlertCircle, UserX, CalendarCheck, LayoutGrid, List
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { CompanyData } from '../../pages/hr/mockData';
import type { User } from '../../types';
import { getEmployees } from '../../lib/databaseService';
import { supabase } from '../../lib/supabase';

interface CompanyAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyData | null;
}

export type AttendanceCategory = 'all' | 'active' | 'absent' | 'on_leave' | 'clocked_out';

interface EmployeeStatusItem {
  employee: User;
  status: 'active' | 'absent' | 'on_leave' | 'clocked_out';
  isLate?: boolean;
  lateMinutes?: number;
  clockInTime: string | null;
  clockOutTime: string | null;
  workedMinutes: number;
  leaveType?: string | null;
  leaveEnd?: string | null;
  ipAddress?: string | null;
}

export function CompanyAttendanceModal({ isOpen, onClose, company }: CompanyAttendanceModalProps) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<AttendanceCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 'grid' : 'table';
    }
    return 'table';
  });

  // Update live clock every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadAttendanceData = async () => {
    if (!company) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // 1. Fetch all employees
      const allEmps = await getEmployees();
      
      // Filter employees belonging to this company (matching by company_id UUID or company name)
      const compId = (company.id || '').trim().toLowerCase();
      const compName = (company.name || '').trim().toLowerCase();
      
      const compEmps = allEmps.filter(e => {
        const empCompId = (e.company_id || '').trim().toLowerCase();
        const empCompName = (e.company || '').trim().toLowerCase();
        return (compId && empCompId === compId) || 
               empCompName === compName || 
               empCompId === compName;
      });

      setEmployees(compEmps);

      const empIds = compEmps.map(e => e.id);

      if (empIds.length > 0) {
        // 2. Query today's attendance logs from Supabase ordered by time
        const { data: logsData } = await supabase
          .from('attendance_logs')
          .select('*')
          .in('user_id', empIds)
          .eq('date', todayStr)
          .order('clock_in_time', { ascending: true });

        setAttendanceLogs(logsData || []);

        // 3. Query active approved leaves covering today
        const { data: leavesData } = await supabase
          .from('leave_requests')
          .select('*')
          .in('user_id', empIds)
          .eq('status', 'Approved')
          .lte('start_date', todayStr)
          .gte('end_date', todayStr);

        setLeaveRequests(leavesData || []);
      } else {
        setAttendanceLogs([]);
        setLeaveRequests([]);
      }
    } catch (err) {
      console.error('Failed to load company attendance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && company) {
      loadAttendanceData();

      // Subscribe to real-time changes
      const channel = supabase
        .channel(`company-attendance-${company.id || company.name}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
          loadAttendanceData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
          loadAttendanceData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, company]);

  // Compute live status items for every employee
  const employeeStatusList: EmployeeStatusItem[] = useMemo(() => {
    // Group all logs by employee id to accurately calculate cumulative worked minutes
    const logsByUser = new Map<string, any[]>();
    attendanceLogs.forEach(l => {
      if (l.user_id) {
        const arr = logsByUser.get(l.user_id) || [];
        arr.push(l);
        logsByUser.set(l.user_id, arr);
      }
    });

    const leavesMap = new Map<string, any>();
    leaveRequests.forEach(lr => {
      if (lr.user_id) leavesMap.set(lr.user_id, lr);
    });

    return employees.map(emp => {
      const userLogs = logsByUser.get(emp.id) || [];
      const leave = leavesMap.get(emp.id);

      if (userLogs.length > 0) {
        let cumulativeWorkedMs = 0;
        let isCurrentlyActive = false;
        let earliestClockIn: Date | null = null;
        let latestClockOut: Date | null = null;
        let lastIp: string | null = null;

        for (const log of userLogs) {
          const inTime = log.clock_in_time ? new Date(log.clock_in_time) : null;
          const outTime = log.clock_out_time ? new Date(log.clock_out_time) : null;

          if (inTime) {
            if (!earliestClockIn || inTime.getTime() < earliestClockIn.getTime()) {
              earliestClockIn = inTime;
            }
            if (log.ip_address) lastIp = log.ip_address;

            if (outTime) {
              if (!latestClockOut || outTime.getTime() > latestClockOut.getTime()) {
                latestClockOut = outTime;
              }
              cumulativeWorkedMs += Math.max(0, outTime.getTime() - inTime.getTime());
            } else {
              isCurrentlyActive = true;
              cumulativeWorkedMs += Math.max(0, Date.now() - inTime.getTime());
            }
          }
        }

        const workedMins = Math.max(0, Math.floor(cumulativeWorkedMs / 60000));
        const inFormatted = earliestClockIn ? (earliestClockIn as Date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;
        const outFormatted = latestClockOut ? (latestClockOut as Date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

        // Check if employee is late compared to scheduled shift start
        let isLate = false;
        let lateMinutes = 0;

        if (earliestClockIn) {
          const shiftStartStr = emp.nationality === 'Expat'
            ? (company?.expatShiftStart || '08:30')
            : (company?.omaniShiftStart || '08:30');
          const [sH, sM] = shiftStartStr.split(':').map(Number);
          const shiftStartMins = (sH || 8) * 60 + (sM || 30);

          const clockInH = (earliestClockIn as Date).getHours();
          const clockInM = (earliestClockIn as Date).getMinutes();
          const clockInMins = clockInH * 60 + clockInM;
          
          if (clockInMins > shiftStartMins) {
            isLate = true;
            lateMinutes = clockInMins - shiftStartMins;
          }
        }

        if (userLogs.some(l => l.status === 'Late')) {
          isLate = true;
        }

        if (isCurrentlyActive) {
          return {
            employee: emp,
            status: 'active',
            isLate,
            lateMinutes,
            clockInTime: inFormatted,
            clockOutTime: null,
            workedMinutes: workedMins,
            ipAddress: lastIp
          };
        } else if (latestClockOut) {
          return {
            employee: emp,
            status: 'clocked_out',
            isLate,
            lateMinutes,
            clockInTime: inFormatted,
            clockOutTime: outFormatted,
            workedMinutes: workedMins,
            ipAddress: lastIp
          };
        }
      }

      if (leave) {
        return {
          employee: emp,
          status: 'on_leave',
          isLate: false,
          clockInTime: null,
          clockOutTime: null,
          workedMinutes: 0,
          leaveType: leave.leave_type || 'Approved Leave',
          leaveEnd: leave.end_date
        };
      }

      return {
        employee: emp,
        status: 'absent',
        isLate: false,
        clockInTime: null,
        clockOutTime: null,
        workedMinutes: 0
      };
    });
  }, [employees, attendanceLogs, leaveRequests, currentTime, company]);

  // Status counts
  const counts = useMemo(() => {
    const active = employeeStatusList.filter(i => i.status === 'active').length;
    const clockedOut = employeeStatusList.filter(i => i.status === 'clocked_out').length;
    const onLeave = employeeStatusList.filter(i => i.status === 'on_leave').length;
    const absent = employeeStatusList.filter(i => i.status === 'absent').length;
    return {
      total: employeeStatusList.length,
      active,
      clockedOut,
      onLeave,
      absent
    };
  }, [employeeStatusList]);

  // Filtered employees
  const filteredList = useMemo(() => {
    return employeeStatusList.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.employee.name.toLowerCase().includes(q) ||
        (item.employee.job_title || '').toLowerCase().includes(q) ||
        (item.employee.department || '').toLowerCase().includes(q) ||
        (item.employee.email || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === 'all') return true;
      return item.status === selectedFilter;
    });
  }, [employeeStatusList, selectedFilter, searchQuery]);

  if (!isOpen || !company) return null;

  const formatDuration = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours === 0) return `${m}m`;
    return `${hours}h ${m}m`;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const hasValidCustomLogo = (url?: string) => {
    return Boolean(url && url.trim().length > 0 && !url.startsWith('blob:') && !url.includes('placeholder'));
  };

  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  const getJobTitle = (emp: User) => {
    if (emp.job_title && emp.job_title !== 'Officer') return emp.job_title;
    if (emp.role && emp.role !== 'Employee') return emp.role;
    return emp.job_title || 'Staff Member';
  };

  const handleNavigateToProfile = (empId: string) => {
    onClose();
    navigate(`/hr/employee/${empId}`);
  };

  // WhatsApp Message Helper with Contextual Warning Text & Color
  const getWhatsAppDetails = (item: EmployeeStatusItem) => {
    const emp = item.employee;
    if (!emp.phone) {
      return { 
        url: null, 
        colorClass: 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-gray-600 border border-slate-200/60 dark:border-white/5 cursor-not-allowed opacity-50', 
        title: `No phone number on record for ${emp.name}`,
        buttonLabel: 'No Phone'
      };
    }

    const clean = emp.phone.replace(/[^0-9]/g, '');
    const phone = clean.length === 8 ? `968${clean}` : clean;

    const shiftStart = emp.nationality === 'Expat'
      ? (company?.expatShiftStart || '08:30 AM')
      : (company?.omaniShiftStart || '08:30 AM');

    let text = '';
    let colorClass = 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    let title = `Message ${emp.name} on WhatsApp`;
    let buttonLabel = 'WhatsApp';

    if (item.status === 'absent') {
      // Red styling for Absent
      colorClass = 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      title = `Send Absence Notice / Warning to ${emp.name}`;
      buttonLabel = 'Send Absence Notice';
      text = `*Official HR Notice — Absence Inquiry*\n\nDear *${emp.name}*,\n\nYou have been marked as *ABSENT* today (*${todayFormatted}*) as no check-in was recorded on the Osan HR Attendance system.\n\nPlease reply immediately with your justification or submit an official leave request to avoid unauthorized absence deduction.\n\n— *${company?.name || 'HR Management'}*`;
    } else if (item.isLate) {
      // Yellow/Amber styling for Late
      colorClass = 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      title = `Send Delay Warning to ${emp.name} (${item.lateMinutes} mins late)`;
      buttonLabel = `${item.lateMinutes}m Late Notice`;
      text = `*Official HR Notice — Attendance Delay Warning*\n\nDear *${emp.name}*,\n\nPlease note that you arrived *${item.lateMinutes} minutes late* today (*${todayFormatted}*).\n• Recorded Check-in: *${item.clockInTime}*\n• Scheduled Shift Start: *${shiftStart}*\n\nThis delay has been documented in the attendance system. Please ensure punctuality in accordance with company policy.\n\n— *${company?.name || 'HR Management'}*`;
    } else if (item.status === 'on_leave') {
      colorClass = 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      title = `Send Leave Confirmation to ${emp.name}`;
      buttonLabel = 'Leave Notice';
      text = `*Official HR Notice — Leave Status*\n\nDear *${emp.name}*,\nThis is a confirmation that your *${item.leaveType}* is active until *${item.leaveEnd}*.\n\n— *${company?.name || 'HR Management'}*`;
    } else {
      text = `Hello *${emp.name}*,\nOfficial message from *${company?.name || 'HR Management'}*.`;
    }

    return {
      url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      colorClass,
      title,
      buttonLabel
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Bar with Real Company Logo */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 dark:bg-white/5">
          <div className="flex items-center gap-3.5">
            {/* Real Company Logo or Initials Container */}
            <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-md p-1.5">
              {hasValidCustomLogo(company.logoUrl) ? (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span class="text-primary font-black text-base">${getInitials(company.name)}</span>`;
                  }}
                />
              ) : (
                <span className="text-primary font-black text-base">{getInitials(company.name)}</span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {company.name}
                </h3>
                <span className="text-[11px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-bold border border-primary/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Today
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 flex items-center gap-2">
                <span>📍 {company.location || 'Headquarters'}</span>
                <span>•</span>
                <span>📅 {todayFormatted}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stat Summary Cards */}
        <div className="p-4 sm:p-6 pb-2 border-b border-slate-100 dark:border-white/5 grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Total Staff</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{counts.total}</div>
          </button>

          <button
            onClick={() => setSelectedFilter('active')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedFilter === 'active'
                ? 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs ring-1 ring-emerald-500'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-emerald-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Now</span>
              <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{counts.active}</div>
          </button>

          <button
            onClick={() => setSelectedFilter('absent')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedFilter === 'absent'
                ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs ring-1 ring-rose-500'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-rose-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Absent</span>
              <UserX className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-black text-rose-600 dark:text-rose-400">{counts.absent}</div>
          </button>

          <button
            onClick={() => setSelectedFilter('on_leave')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              selectedFilter === 'on_leave'
                ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-amber-500/30'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">On Leave</span>
              <CalendarCheck className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{counts.onLeave}</div>
          </button>

          <button
            onClick={() => setSelectedFilter('clocked_out')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              selectedFilter === 'clocked_out'
                ? 'bg-slate-200/80 dark:bg-white/20 border-slate-400 text-slate-800 dark:text-white shadow-xs'
                : 'bg-slate-50 dark:bg-white/5 border-slate-200/80 dark:border-white/5 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">Clocked Out</span>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-xl font-black text-slate-700 dark:text-gray-300">{counts.clockedOut}</div>
          </button>
        </div>

        {/* Toolbar: Search & View Mode Switcher (List vs Grid) */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee name or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* View Mode Toggle: Table (List) vs Cards (Grid) */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Table List View"
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Cards Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
            </div>

            <span className="text-xs font-bold text-slate-600 dark:text-gray-400 bg-slate-100 dark:bg-white/5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
              {filteredList.length} of {employees.length} Staff
            </span>
          </div>
        </div>

        {/* Employee Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold">Loading live attendance...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-bold text-slate-600 dark:text-gray-300">No employees found</p>
              <p className="text-xs text-slate-400">
                {searchQuery ? `No matches for "${searchQuery}"` : `No employees match the "${selectedFilter}" filter today.`}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            /* TABLE / LIST VIEW */
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4 pl-5">Employee</th>
                      <th className="py-3 px-4">Role & Dept</th>
                      <th className="py-3 px-4">Today's Status</th>
                      <th className="py-3 px-4">Punch In / Out</th>
                      <th className="py-3 px-4">Worked Time</th>
                      <th className="py-3 px-4 pr-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                    {filteredList.map(item => {
                      const emp = item.employee;
                      const jobTitle = getJobTitle(emp);
                      const whatsappInfo = getWhatsAppDetails(item);

                      return (
                        <tr 
                          key={emp.id} 
                          className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group"
                        >
                          {/* Employee Info */}
                          <td className="py-3 px-4 pl-5">
                            <div className="flex items-center gap-3">
                              <div 
                                onClick={() => handleNavigateToProfile(emp.id)}
                                className="relative shrink-0 cursor-pointer"
                                title={`View ${emp.name}'s Profile`}
                              >
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 text-slate-800 dark:text-white flex items-center justify-center font-black text-xs border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs group-hover:border-primary transition-colors">
                                  {(emp as any).avatar_url ? (
                                    <img src={(emp as any).avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{getInitials(emp.name)}</span>
                                  )}
                                </div>
                                {item.status === 'active' && (
                                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-slate-900 shadow-2xs animate-pulse" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div 
                                  onClick={() => handleNavigateToProfile(emp.id)}
                                  className="font-extrabold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer hover:underline"
                                  title={`View ${emp.name}'s Profile`}
                                >
                                  {emp.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                                  {emp.email || emp.phone || 'No contact'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role & Dept */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 dark:text-gray-200 text-xs">
                              {jobTitle}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-gray-400">
                              {emp.department || 'Operations'}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3 px-4">
                            {item.status === 'active' && (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                                  Active Now
                                </span>
                                {item.isLate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    ⚠️ {item.lateMinutes}m Late
                                  </span>
                                )}
                              </div>
                            )}
                            {item.status === 'clocked_out' && (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-white/10">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  Clocked Out
                                </span>
                                {item.isLate && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                    ⚠️ {item.lateMinutes}m Late
                                  </span>
                                )}
                              </div>
                            )}
                            {item.status === 'on_leave' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                On Leave
                              </span>
                            )}
                            {item.status === 'absent' && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                Absent
                              </span>
                            )}
                          </td>

                          {/* Punch In / Out */}
                          <td className="py-3 px-4 font-mono text-xs">
                            {item.status === 'active' && (
                              <div className="space-y-0.5">
                                <div className="text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                                  <span>In: {item.clockInTime}</span>
                                </div>
                                {item.isLate && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                                    ({item.lateMinutes}m late arrival)
                                  </div>
                                )}
                              </div>
                            )}
                            {item.status === 'clocked_out' && (
                              <div className="text-slate-600 dark:text-gray-400 text-[11px]">
                                <span>{item.clockInTime} – {item.clockOutTime}</span>
                              </div>
                            )}
                            {item.status === 'on_leave' && (
                              <div className="text-amber-700 dark:text-amber-300 text-[11px] font-bold">
                                <span>{item.leaveType} (to {item.leaveEnd})</span>
                              </div>
                            )}
                            {item.status === 'absent' && (
                              <span className="text-slate-400 text-[11px]">No punch today</span>
                            )}
                          </td>

                          {/* Worked Time */}
                          <td className="py-3 px-4">
                            {item.status === 'active' ? (
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                ⏱ {formatDuration(item.workedMinutes)}
                              </span>
                            ) : item.status === 'clocked_out' ? (
                              <span className="font-mono font-bold text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md">
                                {formatDuration(item.workedMinutes)}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* WhatsApp Button with context color & warning notice */}
                              {whatsappInfo.url ? (
                                <a
                                  href={whatsappInfo.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`p-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center justify-center cursor-pointer ${whatsappInfo.colorClass}`}
                                  title={whatsappInfo.title}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  disabled
                                  className="p-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-gray-600 border border-slate-200/50 dark:border-white/5 cursor-not-allowed opacity-50"
                                  title={whatsappInfo.title}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Profile Redirect Button */}
                              <button
                                onClick={() => handleNavigateToProfile(emp.id)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Open ${emp.name}'s Profile`}
                              >
                                <span>Profile</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARDS (GRID) VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredList.map(item => {
                const emp = item.employee;
                const jobTitle = getJobTitle(emp);
                const whatsappInfo = getWhatsAppDetails(item);

                return (
                  <div
                    key={emp.id}
                    className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 transition-all shadow-xs flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar with live pulse ring */}
                        <div 
                          onClick={() => handleNavigateToProfile(emp.id)}
                          className="relative shrink-0 cursor-pointer"
                          title={`View ${emp.name}'s Profile`}
                        >
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 text-slate-800 dark:text-white flex items-center justify-center font-black text-sm border border-slate-200/80 dark:border-white/10 overflow-hidden shadow-2xs group-hover:border-primary transition-colors">
                            {(emp as any).avatar_url ? (
                              <img src={(emp as any).avatar_url} alt={emp.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{getInitials(emp.name)}</span>
                            )}
                          </div>

                          {/* Live indicator dot */}
                          {item.status === 'active' && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 shadow-xs animate-pulse" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <h4 
                            onClick={() => handleNavigateToProfile(emp.id)}
                            className="font-extrabold text-sm text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors cursor-pointer hover:underline"
                            title={`View ${emp.name}'s Profile`}
                          >
                            {emp.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                            {jobTitle} {emp.department ? `• ${emp.department}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {item.status === 'active' && (
                          <>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              Active Now
                            </span>
                            {item.isLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                ⚠️ {item.lateMinutes}m Late
                              </span>
                            )}
                          </>
                        )}

                        {item.status === 'clocked_out' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-gray-300 border border-slate-200 dark:border-white/10">
                            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                            Clocked Out
                          </span>
                        )}

                        {item.status === 'on_leave' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            On Leave
                          </span>
                        )}

                        {item.status === 'absent' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                            Absent
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attendance Details Strip */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-xs flex items-center justify-between">
                      {item.status === 'active' && (
                        <>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300">
                            <Clock className="w-3.5 h-3.5 text-emerald-500" />
                            <span>In: <strong>{item.clockInTime}</strong></span>
                            {item.isLate && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold ml-1">
                                ({item.lateMinutes}m late)
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                            ⏱ Working: {formatDuration(item.workedMinutes)}
                          </span>
                        </>
                      )}

                      {item.status === 'clocked_out' && (
                        <>
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-gray-300 text-[11px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.clockInTime} – {item.clockOutTime}</span>
                          </div>
                          <span className="font-bold text-slate-700 dark:text-gray-300 text-[11px]">
                            Total: {formatDuration(item.workedMinutes)}
                          </span>
                        </>
                      )}

                      {item.status === 'on_leave' && (
                        <>
                          <span className="text-amber-700 dark:text-amber-400 font-bold text-[11px]">
                            🌴 {item.leaveType}
                          </span>
                          <span className="text-slate-500 dark:text-gray-400 text-[11px]">
                            Until {item.leaveEnd}
                          </span>
                        </>
                      )}

                      {item.status === 'absent' && (
                        <div className="w-full flex items-center justify-between text-rose-600 dark:text-rose-400 text-[11px]">
                          <span>⚠️ No check-in recorded for today</span>
                          <span className="font-semibold text-slate-400">Not present</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Action Links */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                      {/* WhatsApp Notice Button */}
                      {whatsappInfo.url && (
                        <a
                          href={whatsappInfo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${whatsappInfo.colorClass}`}
                          title={whatsappInfo.title}
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>{whatsappInfo.buttonLabel}</span>
                        </a>
                      )}

                      {/* Profile Redirect Button */}
                      <button
                        onClick={() => handleNavigateToProfile(emp.id)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-gray-300 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        title={`Open ${emp.name}'s Profile`}
                      >
                        <span>Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Area */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 dark:text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Attendance data updates automatically via real-time database sync</span>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-bold transition-colors cursor-pointer"
          >
            Close Roster
          </button>
        </div>
      </div>
    </div>
  );
}
