import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { getLeaveRequestsFromDb, updateLeaveRequestStatusInDb } from '../../lib/databaseService';

export function HrLeaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const pendingLeaves = leaves.filter(l => l.status === 'Pending' || !l.status);

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Leave Requests</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400">Review and approve annual, sick, and emergency leave applications.</p>
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-500 dark:text-gray-400 text-xs font-semibold">
          Loading leave requests from database...
        </div>
      ) : (
        pendingLeaves.map(leave => (
          <div 
            key={leave.id} 
            className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-6 hover:border-slate-300 dark:hover:border-white/10 transition-all"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">{leave.employee}</h3>
                <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-transparent rounded-full text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-gray-300">
                  {leave.type} Leave
                </span>
              </div>
              <div className="text-slate-600 dark:text-gray-400 text-sm mb-4">
                Requested for: <strong className="text-slate-900 dark:text-white font-bold">{leave.start}</strong> to <strong className="text-slate-900 dark:text-white font-bold">{leave.end}</strong>
              </div>

              {/* Embedded Balances Info crucial for HR decision */}
              <div className="flex gap-4 text-xs font-medium">
                <div className="bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-gray-300 font-semibold">
                  Remaining Yearly: <span className="text-primary font-extrabold">{leave.balances?.yearly ?? 30}</span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-gray-300 font-semibold">
                  Remaining Sick: <span className="text-amber-600 dark:text-amber-400 font-extrabold">{leave.balances?.sick ?? 14}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleAction(leave.id, 'Rejected')}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl transition-colors font-bold text-xs"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button 
                onClick={() => handleAction(leave.id, 'Approved')}
                className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-emerald-600 text-white rounded-xl transition-colors font-bold text-xs shadow-lg shadow-primary/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
            </div>
          </div>
        ))
      )}

      {!loading && pendingLeaves.length === 0 && (
        <div className="text-center py-12 text-slate-500 dark:text-gray-400 bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500 opacity-60" />
          <p className="font-bold text-slate-900 dark:text-white">No pending leave requests.</p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">All workforce leave applications have been processed.</p>
        </div>
      )}
    </div>
  );
}
