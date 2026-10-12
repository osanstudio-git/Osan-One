import { useState, useEffect } from 'react';
import { LayoutGrid, List, CheckCircle2, XCircle, Clock, Search, Calendar, Plus, Trash2, Globe, Check, X } from 'lucide-react';
import { getLeaveRequestsFromDb, updateLeaveRequestStatusInDb } from '../../lib/databaseService';
import { getPublicHolidays, addPublicHoliday, deletePublicHoliday, type PublicHoliday } from '../../lib/holidayService';
import { supabase } from '../../lib/supabase';

export function HrLeaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'requests' | 'holidays'>('requests');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'grid' : 'list';
    }
    return 'grid';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Holidays state
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [holidayViewMode, setHolidayViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'grid' : 'table';
    }
    return 'table';
  });
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    daysCount: 1,
    type: 'National' as 'National' | 'Religious' | 'Company',
    notes: ''
  });

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequestsFromDb();
      setLeaves(data);
    } catch (err) {
      console.error('Failed to fetch leave requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
    setHolidays(getPublicHolidays());

    // Subscribe to live leave requests via Supabase Realtime
    const channel = supabase
      .channel('hr-leaves-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) return;
    addPublicHoliday(holidayForm);
    setHolidays(getPublicHolidays());
    setIsHolidayModalOpen(false);
    setHolidayForm({
      name: '',
      date: new Date().toISOString().split('T')[0],
      daysCount: 1,
      type: 'National',
      notes: ''
    });
  };

  const handleDeleteHoliday = (id: string) => {
    const updated = deletePublicHoliday(id);
    setHolidays(updated);
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    await updateLeaveRequestStatusInDb(id, status);
    await loadLeaves();
  };

  const filteredLeaves = leaves.filter(l => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter || (statusFilter === 'Pending' && !l.status);
    const matchesSearch = l.employee.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          l.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = leaves.filter(l => l.status === 'Pending' || !l.status).length;
  const approvedCount = leaves.filter(l => l.status === 'Approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'Rejected').length;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSection('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSection === 'requests'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" /> Leave Applications
        </button>
        <button
          onClick={() => setActiveSection('holidays')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeSection === 'holidays'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
          }`}
        >
          <Globe className="w-4 h-4 shrink-0" /> Official Public & Company Holidays ({holidays.length})
        </button>
      </div>

      {activeSection === 'requests' && (
        <>
          {/* Header Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#1D70B8] shrink-0" />
                Workforce Leave Applications
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold mt-1">
                Review and approve annual, sick, and emergency leave applications across all company branches.
              </p>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 self-start md:self-auto shrink-0">
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
                <span className="hidden sm:inline">Grid View</span>
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
                <span className="hidden sm:inline">List View</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'Pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter('Approved')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'Approved'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Approved ({approvedCount})
          </button>

          <button
            onClick={() => setStatusFilter('Rejected')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'Rejected'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            Rejected ({rejectedCount})
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              statusFilter === 'all'
                ? 'bg-[#1D70B8] text-white shadow-md shadow-[#1D70B8]/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            All ({leaves.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee or type..."
            className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-[#1D70B8]"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-white/5 p-12 rounded-2xl border border-slate-200/80 dark:border-white/5 text-center text-slate-500 dark:text-gray-400 text-xs font-semibold">
          Loading live leave records from database...
        </div>
      ) : filteredLeaves.length === 0 ? (
        /* Clean 100% Real Empty State */
        <div className="bg-white dark:bg-white/5 p-12 rounded-2xl border border-slate-200/80 dark:border-white/5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 text-[#1D70B8] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">No Leave Applications Found</h3>
          <p className="text-slate-500 dark:text-gray-400 text-xs max-w-sm mx-auto font-medium">
            There are currently no leave requests matching the selected filter in your database.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeaves.map((leave) => (
            <div
              key={leave.id}
              className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-white/10 transition-all"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{leave.employee}</h3>
                    <span className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">ID: {leave.user_id?.slice(0, 8)}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                    leave.type === 'Sick'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                      : 'bg-blue-500/10 text-[#1D70B8] dark:text-blue-400 border border-blue-500/20'
                  }`}>
                    {leave.type} Leave
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-gray-300 mb-4 space-y-1">
                  <div>Requested Dates:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {leave.start} <span className="text-slate-400 font-normal">to</span> {leave.end}
                  </div>
                </div>

                {/* Balances */}
                <div className="flex items-center justify-between text-xs font-semibold bg-slate-50/50 dark:bg-white/5 p-2.5 rounded-xl border border-slate-100 dark:border-white/5">
                  <span className="text-slate-500 dark:text-gray-400">Yearly Balance: <strong className="text-[#1D70B8]">{leave.balances?.yearly ?? 30} days</strong></span>
                  <span className="text-slate-500 dark:text-gray-400">Sick Balance: <strong className="text-amber-600">{leave.balances?.sick ?? 14} days</strong></span>
                </div>
              </div>

              {/* Status or Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5">
                {leave.status === 'Approved' ? (
                  <span className="w-full py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4" /> Approved
                  </span>
                ) : leave.status === 'Rejected' ? (
                  <span className="w-full py-2 bg-red-500/10 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-red-500/20">
                    <XCircle className="w-4 h-4" /> Rejected
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAction(leave.id, 'Approved')}
                      className="flex-1 py-2.5 bg-[#1D70B8] hover:bg-[#155994] text-white rounded-xl font-bold text-xs shadow-md shadow-[#1D70B8]/20 transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(leave.id, 'Rejected')}
                      className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[700px]">
              <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-white/10 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-4 pl-6">Employee Name</th>
                  <th className="p-4">Leave Type</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4">Yearly / Sick Balance</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                {filteredLeaves.map((leave) => (
                  <tr key={leave.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6 font-extrabold text-slate-900 dark:text-white">
                      {leave.employee}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-block ${
                        leave.type === 'Sick'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-blue-500/10 text-[#1D70B8] dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {leave.type} Leave
                      </span>
                    </td>
                    <td className="p-4 text-slate-700 dark:text-gray-300 font-mono">
                      {leave.start} → {leave.end}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-gray-400">
                      Yearly: <strong className="text-[#1D70B8]">{leave.balances?.yearly ?? 30}d</strong> | Sick: <strong className="text-amber-600">{leave.balances?.sick ?? 14}d</strong>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold inline-block ${
                        leave.status === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : leave.status === 'Rejected'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}>
                        {leave.status || 'Pending'}
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6">
                      {leave.status === 'Approved' || leave.status === 'Rejected' ? (
                        <span className="text-slate-400 dark:text-gray-500 text-[11px] font-semibold italic">Processed</span>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleAction(leave.id, 'Approved')}
                            className="px-3 py-1.5 bg-[#1D70B8] hover:bg-[#155994] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(leave.id, 'Rejected')}
                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. OFFICIAL PUBLIC & COMPANY HOLIDAYS VIEW */}
      {activeSection === 'holidays' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Official Government & Company Holidays (2026)
              </h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold mt-1">
                Official paid public holidays in Oman (National Day, Eids, Accession Day) automatically flag employee calendars as Paid Holidays.
              </p>
            </div>

            <button
              onClick={() => setIsHolidayModalOpen(true)}
              className="px-4 py-2.5 bg-primary hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-primary/20 transition-all cursor-pointer self-start md:self-auto"
            >
              <Plus className="w-4 h-4" /> Add Public Holiday
            </button>
          </div>

          <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Registered Holiday Calendar</h3>
                <span className="text-xs font-semibold text-slate-500 dark:text-gray-400">{holidays.length} Holidays Configured</span>
              </div>

              {/* View Switcher for Holidays */}
              <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 self-start sm:self-auto">
                <button
                  onClick={() => setHolidayViewMode('table')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    holidayViewMode === 'table'
                      ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => setHolidayViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    holidayViewMode === 'grid'
                      ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>

            {holidayViewMode === 'table' ? (
              <div>
                <div className="sm:hidden px-3.5 py-1.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
                  <span>← Swipe table or switch to Cards view →</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4 pl-4 sm:pl-6">Holiday Title</th>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4">Date</th>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4">Duration</th>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4">Classification</th>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4">Notes</th>
                        <th className="py-3 px-3 sm:py-3.5 sm:px-4 pr-4 sm:pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-medium">
                      {holidays.map((h) => (
                        <tr key={h.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4 pl-4 sm:pl-6 font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            {h.name}
                          </td>
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-mono font-bold text-primary">
                            {h.date}
                          </td>
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-semibold text-slate-700 dark:text-gray-300">
                            {h.daysCount} Day{h.daysCount > 1 ? 's' : ''} (Paid)
                          </td>
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                            <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold border shadow-xs ${
                              h.type === 'National' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                              h.type === 'Religious' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                              'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            }`}>
                              {h.type} Holiday
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-slate-500 dark:text-gray-400 max-w-[240px] truncate">
                            {h.notes || '--'}
                          </td>
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-right pr-4 sm:pr-6">
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                              title="Remove Holiday"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Cards View for Mobile & Tablet */
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 bg-slate-50/50 dark:bg-transparent">
                {holidays.map((h) => (
                  <div
                    key={h.id}
                    className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-primary transition-colors">
                          {h.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <span className="font-mono font-bold text-primary flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {h.date}
                          </span>
                          <span className="text-slate-300 dark:text-gray-600">•</span>
                          <span className="font-semibold text-slate-600 dark:text-gray-300">
                            {h.daysCount} Day{h.daysCount > 1 ? 's' : ''} (Paid)
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteHoliday(h.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Remove Holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-xs gap-2">
                      <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        h.type === 'National' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                        h.type === 'Religious' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                        'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {h.type} Holiday
                      </span>

                      <span className="text-slate-500 dark:text-gray-400 text-[11px] truncate max-w-[160px]">
                        {h.notes || 'Official Public Holiday'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Public Holiday Modal */}
      {isHolidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Add Official Public Holiday</h2>
              </div>
              <button onClick={() => setIsHolidayModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddHoliday} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Holiday Title *</label>
                <input
                  type="text"
                  required
                  value={holidayForm.name}
                  onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder="e.g. Oman National Day or Eid Al Fitr"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={holidayForm.daysCount}
                    onChange={(e) => setHolidayForm({ ...holidayForm, daysCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Classification Type</label>
                <select
                  value={holidayForm.type}
                  onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary cursor-pointer"
                >
                  <option value="National" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">National Government Holiday</option>
                  <option value="Religious" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Religious Holiday (Eid / Hijri / Mawlid)</option>
                  <option value="Company" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Company Special Paid Day Off</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Notes / Royal Decree Ref</label>
                <input
                  type="text"
                  value={holidayForm.notes}
                  onChange={(e) => setHolidayForm({ ...holidayForm, notes: e.target.value })}
                  placeholder="e.g. Royal Decree Paid Holiday for Public & Private Sector"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsHolidayModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-primary text-white font-bold cursor-pointer shadow-md shadow-primary/20">
                  Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
