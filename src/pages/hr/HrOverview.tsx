import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts';
import { Users, Building2, CalendarX, AlertCircle, Activity, CheckCircle2 } from 'lucide-react';
import { DocumentComplianceWidget } from '../../components/hr/DocumentComplianceWidget';
import { 
  getEmployees, 
  getCompanies, 
  getLeaveRequestsFromDb, 
  getAttendanceExceptionsFromDb,
  getRecentAttendanceTrendFromDb,
  invalidateEmployeeCache,
  invalidateCompanyCache
} from '../../lib/databaseService';
import { supabase } from '../../lib/supabase';
import type { User, Company } from '../../types';

const defaultAttendanceData = [
  { day: 'Sun', onTime: 0, late: 0, absent: 0 },
  { day: 'Mon', onTime: 0, late: 0, absent: 0 },
  { day: 'Tue', onTime: 0, late: 0, absent: 0 },
  { day: 'Wed', onTime: 0, late: 0, absent: 0 },
  { day: 'Thu', onTime: 0, late: 0, absent: 0 },
  { day: 'Fri', onTime: 0, late: 0, absent: 0 },
  { day: 'Sat', onTime: 0, late: 0, absent: 0 },
];

const companyColors = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-3 rounded-lg shadow-xl text-xs">
        <p className="font-bold text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-600 dark:text-gray-300 capitalize">{entry.name}:</span>
            <span className="text-slate-900 dark:text-white font-bold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function HrOverview() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState(defaultAttendanceData);

  const loadData = (force = false) => {
    Promise.all([
      getEmployees(force),
      getCompanies(force),
      getLeaveRequestsFromDb(),
      getAttendanceExceptionsFromDb(),
      getRecentAttendanceTrendFromDb(7)
    ]).then(([empData, compData, leaveData, excData, trendData]) => {
      setEmployees(empData);
      setCompanies(compData);
      setLeaveRequests(leaveData);
      setExceptions(excData);
      if (trendData && trendData.length > 0) {
        setAttendanceData(trendData);
      }
    }).catch(err => console.error('Failed to load HR overview data:', err));
  };

  useEffect(() => {
    loadData();

    // Subscribe to live database changes via Supabase Realtime
    const channel = supabase
      .channel('hr-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        invalidateEmployeeCache();
        loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        invalidateCompanyCache();
        loadData(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute live demographics from real employees array
  const demographicsData = [
    { name: 'Omani Male', count: employees.filter(e => e.nationality === 'Omani' && e.gender === 'Male').length },
    { name: 'Omani Female', count: employees.filter(e => e.nationality === 'Omani' && e.gender === 'Female').length },
    { name: 'Expat Male', count: employees.filter(e => e.nationality === 'Expat' && e.gender === 'Male').length },
    { name: 'Expat Female', count: employees.filter(e => e.nationality === 'Expat' && e.gender === 'Female').length },
  ];

  // Compute workforce distribution per company from real employees
  const companyDistribution = companies.map(comp => {
    const count = employees.filter(e => e.company_id === comp.id || e.company === comp.name).length;
    return { name: comp.name, count: count > 0 ? count : 1 };
  });

  const pendingLeavesCount = leaveRequests.filter(l => l.status === 'Pending' || !l.status).length;
  const criticalExceptionsCount = exceptions.filter(e => e.severity === 'high').length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-1">Organization Overview</h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">Real-time metrics and analytics for the entire workforce.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold">Total Personnel</h3>
            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{employees.length}</div>
          <div className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span>Live Database Records</span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold">Active Companies</h3>
            <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{companies.length || 1}</div>
          <div className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <span>Multi-Tenant Active</span>
          </div>
        </div>

        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold">Pending Leaves</h3>
            <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
              <CalendarX className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1">{pendingLeavesCount}</div>
          <div className="text-[11px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
            <span>Requires review</span>
          </div>
        </div>

        <div className="bg-red-500/5 dark:bg-red-500/10 p-4 sm:p-5 rounded-2xl border border-red-500/20 hover:border-red-500/30 transition-colors shadow-xs">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-red-700 dark:text-red-400/80 text-xs sm:text-sm font-semibold">Exceptions</h3>
            <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-red-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-500 mb-1">
            {criticalExceptionsCount}
          </div>
          <div className="text-[11px] sm:text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
            <span>Critical actions pending</span>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Weekly Attendance Trend */}
        <div className="lg:col-span-2 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs flex flex-col">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary shrink-0" />
            <span>7-Day Attendance Trend</span>
          </h3>
          <div className="flex-1 w-full min-h-[260px] sm:min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" vertical={false} />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="onTime" name="On Time" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOnTime)" />
                <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorLate)" />
                <Area type="monotone" dataKey="absent" name="Absent" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorAbsent)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workforce Distribution */}
        <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs flex flex-col">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Workforce Distribution</h3>
          <div className="flex-1 w-full min-h-[260px] sm:min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={companyDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="count"
                  stroke="none"
                >
                  {companyDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={companyColors[index % companyColors.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">{employees.length}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 font-semibold">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Demographics Bar Chart */}
        <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs min-h-[320px] sm:h-[350px] flex flex-col">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Demographics</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demographicsData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b820" horizontal={false} />
                <XAxis type="number" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Employees" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {demographicsData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={companyColors[index % companyColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-xs min-h-[320px] sm:h-[350px] flex flex-col">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">Recent System Activity</h3>
          <div className="flex-1 overflow-y-auto pr-1 sm:pr-2 space-y-3 sm:space-y-4">
            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">Live Database Synchronization Active</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">System &bull; Real-Time</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"><span className="font-bold">{employees.length} Employees</span> connected across companies</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">Supabase Engine</p>
              </div>
            </div>

            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white"><span className="font-bold">{companies.length || 1} Active Companies</span> registered in database</p>
                <p className="text-[11px] text-slate-500 dark:text-gray-400">Multi-Tenant Setup</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document & Visa Compliance Alert Center */}
      <DocumentComplianceWidget employees={employees} onEmployeeUpdate={setEmployees} />
    </div>
  );
}
