import { useState, useEffect } from 'react';
import { LayoutGrid, List, CheckCircle2, XCircle, Clock, Search, Calendar, Check, X } from 'lucide-react';
import { getLeaveRequestsFromDb, updateLeaveRequestStatusInDb } from '../../lib/databaseService';

export function HrLeaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');

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
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1D70B8]" />
            Workforce Leave Applications
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 font-semibold mt-1">
            Review and approve annual, sick, and emergency leave applications across all company branches.
          </p>
        </div>

        {/* View Mode Toggle Switch */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 self-start md:self-auto">
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
            <span className="hidden md:inline">Grid View</span>
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
            <span className="hidden md:inline">List View</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'Pending'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({pendingCount})
          </button>

          <button
            onClick={() => setStatusFilter('Approved')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'Approved'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved ({approvedCount})
          </button>

          <button
            onClick={() => setStatusFilter('Rejected')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'Rejected'
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            Rejected ({rejectedCount})
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#1D70B8] text-white shadow-md shadow-[#1D70B8]/20'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-400 hover:bg-slate-100 border border-slate-200 dark:border-white/10'
            }`}
          >
            All ({leaves.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
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
            <table className="w-full text-left text-xs border-collapse">
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
    </div>
  );
}
