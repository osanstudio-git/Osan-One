import { useState, useEffect } from 'react';
import { LayoutGrid, List, CheckCircle2, ShieldAlert, Check, X, Filter } from 'lucide-react';
import { getAttendanceExceptionsFromDb, resolveAttendanceExceptionInDb } from '../../lib/databaseService';
import { supabase } from '../../lib/supabase';

export function HrExceptions() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium'>('all');

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await getAttendanceExceptionsFromDb();
      setExceptions(data);
    } catch (err) {
      console.error('Failed to fetch attendance exceptions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();

    // Subscribe to live attendance logs and exceptions changes via Supabase Realtime
    const channel = supabase
      .channel('hr-exceptions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        loadExceptions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleResolve = async (id: string, action: 'Deduct' | 'Forgive') => {
    await resolveAttendanceExceptionInDb(id, action);
    await loadExceptions();
  };

  const filteredExceptions = exceptions.filter(e => {
    if (severityFilter === 'high') return e.severity === 'high';
    if (severityFilter === 'medium') return e.severity === 'medium';
    return true;
  });

  const highSeverity = filteredExceptions.filter(e => e.severity === 'high');
  const mediumSeverity = filteredExceptions.filter(e => e.severity === 'medium');

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Header & Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
            Attendance Exceptions & Deductions
          </h2>
          <p className="text-slate-500 dark:text-gray-400 text-xs font-semibold mt-1">
            Review live employee attendance anomalies, late arrivals, and salary deduction approvals.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Severity Filter Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={severityFilter}
              onChange={(e: any) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-white font-bold outline-none cursor-pointer"
            >
              <option value="all" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Severities</option>
              <option value="high" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Action Required (High)</option>
              <option value="medium" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Warnings Only</option>
            </select>
          </div>

          {/* View Mode Toggle Switch */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-white/5 p-12 rounded-2xl border border-slate-200/80 dark:border-white/5 text-center text-slate-500 dark:text-gray-400 text-xs font-semibold">
          Loading live attendance records from database...
        </div>
      ) : exceptions.length === 0 ? (
        /* Clean 100% Real Empty State */
        <div className="bg-white dark:bg-white/5 p-12 rounded-2xl border border-slate-200/80 dark:border-white/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">All Clear! No Active Exceptions</h3>
          <p className="text-slate-500 dark:text-gray-400 text-xs max-w-sm mx-auto font-medium">
            There are no pending late arrivals, absenteeism, or over-break deductions requiring HR review at this time.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="space-y-8">
          {/* Action Required (High Severity) */}
          {highSeverity.length > 0 && (
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Action Required (Pending Deductions) - {highSeverity.length}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {highSeverity.map(exc => (
                  <div
                    key={exc.id}
                    className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-red-200 dark:border-red-500/20 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{exc.employee}</h4>
                        <span className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">{exc.date}</span>
                      </div>
                      <span className="px-2.5 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg text-xs font-extrabold inline-block mb-2">
                        {exc.type}
                      </span>
                      <p className="text-slate-600 dark:text-gray-300 text-xs font-medium">{exc.details}</p>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
                      <button
                        onClick={() => handleResolve(exc.id, 'Deduct')}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve Deduction
                      </button>
                      <button
                        onClick={() => handleResolve(exc.id, 'Forgive')}
                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Forgive
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medium Severity / Warnings */}
          {mediumSeverity.length > 0 && (
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                Warnings Logged - {mediumSeverity.length}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mediumSeverity.map(exc => (
                  <div key={exc.id} className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-amber-200 dark:border-amber-500/20 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{exc.employee}</h4>
                      <span className="text-[11px] text-slate-500 dark:text-gray-400 font-semibold">{exc.date}</span>
                    </div>
                    <span className="px-2.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-extrabold inline-block mb-2">
                      {exc.type}
                    </span>
                    <p className="text-slate-600 dark:text-gray-300 text-xs font-medium">{exc.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* LIST VIEW (Table Representation) */
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Employee Name</th>
                  <th className="p-4">Exception Type</th>
                  <th className="p-4">Details & Timestamp</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Severity</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {filteredExceptions.map((exc) => (
                  <tr key={exc.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6 font-extrabold text-slate-900 dark:text-white">
                      {exc.employee}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-block ${
                        exc.severity === 'high' 
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      }`}>
                        {exc.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-gray-300">
                      {exc.details}
                    </td>
                    <td className="p-4 text-slate-500 dark:text-gray-400 font-mono">
                      {exc.date}
                    </td>
                    <td className="p-4">
                      <span className={`capitalize font-bold text-[11px] ${
                        exc.severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {exc.severity} Priority
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6">
                      {exc.severity === 'high' ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleResolve(exc.id, 'Deduct')}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleResolve(exc.id, 'Forgive')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Forgive
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 text-[11px] font-semibold italic">
                          Warning Logged
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
