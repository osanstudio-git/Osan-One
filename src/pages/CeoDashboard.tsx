import { useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, MapPin, TrendingUp, Clock, Users, Building2 } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';

// Enhanced Mock Data for CEO View
const MOCK_COMPANIES = [
  { name: 'Nameer', total: 12, active: 10, lateMinutes: 45 },
  { name: 'Masar', total: 8, active: 8, lateMinutes: 15 },
  { name: 'Osan Studio', total: 15, active: 11, lateMinutes: 120 },
  { name: 'Amer', total: 5, active: 5, lateMinutes: 5 },
  { name: 'Asas', total: 9, active: 7, lateMinutes: 60 },
  { name: 'Musk', total: 4, active: 2, lateMinutes: 10 },
  { name: 'Osbic', total: 6, active: 5, lateMinutes: 30 },
  { name: 'Maisarah', total: 3, active: 0, lateMinutes: 0 },
];

const MOCK_EMPLOYEES_BY_COMPANY: Record<string, { name: string; status: 'Active' | 'Out of Office' | 'On Break' }[]> = {
  'Nameer': [
    { name: 'Ali Ahmed', status: 'Active' },
    { name: 'Sara Khan', status: 'Out of Office' },
    { name: 'Omar Said', status: 'Active' },
  ],
};

const productivityTrend = [
  { day: 'Day 1', rate: 92 },
  { day: 'Day 2', rate: 88 },
  { day: 'Day 3', rate: 95 },
  { day: 'Day 4', rate: 85 },
  { day: 'Day 5', rate: 89 },
  { day: 'Day 6', rate: 94 },
  { day: 'Day 7', rate: 96 },
  { day: 'Day 8', rate: 91 },
  { day: 'Day 9', rate: 87 },
  { day: 'Day 10', rate: 93 },
];

const companyColors = ['#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-white/10 p-3 rounded-lg shadow-xl shadow-black/50">
        <p className="font-bold text-white mb-2">{label}</p>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: payload[0].color || payload[0].fill }} />
          <span className="text-gray-300 capitalize">{payload[0].name}:</span>
          <span className="text-white font-bold">{payload[0].value}{payload[0].name.includes('Rate') ? '%' : ''}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function CeoDashboard() {
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  const totalEmployees = MOCK_COMPANIES.reduce((acc, c) => acc + c.total, 0);
  const activeEmployees = MOCK_COMPANIES.reduce((acc, c) => acc + c.active, 0);
  const totalLateMinutes = MOCK_COMPANIES.reduce((acc, c) => acc + c.lateMinutes, 0);
  const estimatedLostHours = (totalLateMinutes / 60).toFixed(1);



  return (
    <DashboardLayout title="Executive Board">
      {/* High Impact KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4 mb-6 sm:mb-8">
        <div className="glass p-4 sm:p-5 lg:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 relative overflow-hidden bg-white/70 dark:bg-white/5 shadow-xs">
          <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-10">
            <MapPin className="w-12 h-12 sm:w-16 sm:h-16 text-slate-900 dark:text-white" />
          </div>
          <h2 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold mb-1 sm:mb-2 uppercase tracking-wider">Office Density</h2>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">{activeEmployees}</span>
            <span className="text-slate-400 dark:text-gray-500 text-base sm:text-lg mb-0.5 sm:mb-1 font-bold">/ {totalEmployees}</span>
          </div>
          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs mt-2 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
            Personnel On-Duty Now
          </p>
        </div>

        <div className="glass p-4 sm:p-5 lg:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 relative overflow-hidden bg-white/70 dark:bg-white/5 shadow-xs">
          <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-10">
            <TrendingUp className="w-12 h-12 sm:w-16 sm:h-16 text-slate-900 dark:text-white" />
          </div>
          <h2 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold mb-1 sm:mb-2 uppercase tracking-wider">Productivity Rate</h2>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">91.4%</div>
          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs mt-2 font-semibold">
            ↑ 2.1% from last week
          </p>
        </div>

        <div className="glass p-4 sm:p-5 lg:p-6 rounded-2xl border border-red-500/20 bg-red-500/5 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-10">
            <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-red-500" />
          </div>
          <h2 className="text-red-500/90 dark:text-red-400/80 text-xs sm:text-sm font-semibold mb-1 sm:mb-2 uppercase tracking-wider">Est. Lost Hours</h2>
          <div className="text-3xl sm:text-4xl font-black text-red-600 dark:text-red-500">{estimatedLostHours}h</div>
          <p className="text-red-500 dark:text-red-400 text-[11px] sm:text-xs mt-2 font-semibold">
            Due to late arrivals this week
          </p>
        </div>

        <div className="glass p-4 sm:p-5 lg:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 relative overflow-hidden bg-white/70 dark:bg-white/5 shadow-xs">
          <div className="absolute top-0 right-0 p-3 sm:p-4 opacity-10">
            <Users className="w-12 h-12 sm:w-16 sm:h-16 text-slate-900 dark:text-white" />
          </div>
          <h2 className="text-slate-500 dark:text-gray-400 text-xs sm:text-sm font-semibold mb-1 sm:mb-2 uppercase tracking-wider">Headcount Growth</h2>
          <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">+8</div>
          <p className="text-emerald-600 dark:text-emerald-400 text-[11px] sm:text-xs mt-2 font-semibold">
            Month over Month
          </p>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Productivity Trend */}
        <div className="glass p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-white/5 shadow-xs flex flex-col h-[300px] sm:h-[340px] lg:h-[360px]">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary shrink-0" />
            <span>30-Day On-Time Rate</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productivityTrend} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                <XAxis dataKey="day" stroke="#88888860" tick={{ fill: '#88888880', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[70, 100]} stroke="#88888860" tick={{ fill: '#88888880', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rate" name="On-Time Rate" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Company Performance Bar Chart */}
        <div className="glass p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-white/5 shadow-xs flex flex-col h-[300px] sm:h-[340px] lg:h-[360px]">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-4 sm:mb-6 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500 shrink-0" />
            <span>Average Late Minutes by Company</span>
          </h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MOCK_COMPANIES} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#88888820" vertical={false} />
                <XAxis dataKey="name" stroke="#88888860" tick={{ fill: '#88888880', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={35} />
                <YAxis stroke="#88888860" tick={{ fill: '#88888880', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#88888810' }} content={<CustomTooltip />} />
                <Bar dataKey="lateMinutes" name="Late Minutes" radius={[4, 4, 0, 0]}>
                  {MOCK_COMPANIES.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={companyColors[index % companyColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-slate-900 dark:text-white flex items-center gap-2">
        <Users className="w-5 h-5 text-slate-400 dark:text-gray-400 shrink-0" />
        <span>Real-Time Operations Matrices</span>
      </h3>

      {/* Drill-down Operations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
        {MOCK_COMPANIES.map((company) => {
          const isExpanded = expandedCompany === company.name;
          const employees = MOCK_EMPLOYEES_BY_COMPANY[company.name] || [
            { name: 'Mock Emp 1', status: 'Active' },
            { name: 'Mock Emp 2', status: 'On Break' }
          ];

          return (
            <div key={company.name} className="glass rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/70 dark:bg-white/5 overflow-hidden transition-all hover:border-slate-300 dark:hover:border-white/10 shadow-xs">
              <button
                onClick={() => setExpandedCompany(isExpanded ? null : company.name)}
                className="w-full p-4 sm:p-5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="min-w-0 pr-2">
                  <h4 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white mb-1 truncate">{company.name}</h4>
                  <div className="text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                    <span>{company.active} / {company.total} Active</span>
                  </div>
                </div>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 shadow-inner shrink-0">
                  {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 dark:text-gray-400" />}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-black/20"
                  >
                    <div className="p-3 sm:p-4 space-y-2">
                      {employees.map((emp, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 gap-2">
                          <span className="font-medium text-xs sm:text-sm text-slate-800 dark:text-gray-200 truncate">{emp.name}</span>
                          <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold shrink-0 ${
                            emp.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                            emp.status === 'On Break' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' : 
                            'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-white/10'
                          }`}>
                            {emp.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
