import { useState, useEffect } from 'react';
import { getAttendanceExceptionsFromDb, resolveAttendanceExceptionInDb } from '../../lib/databaseService';

export function HrExceptions() {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const handleResolve = async (id: string, action: 'Deduct' | 'Forgive') => {
    await resolveAttendanceExceptionInDb(id, action);
    await loadExceptions();
  };

  const highSeverity = exceptions.filter(e => e.severity === 'high');
  const mediumSeverity = exceptions.filter(e => e.severity === 'medium');

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
      <div>
        <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Action Required (Pending Deductions)
        </h2>

        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-gray-400 text-xs font-semibold">
            Loading attendance exceptions from database...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highSeverity.map(exc => (
              <div 
                key={exc.id} 
                className="bg-white dark:bg-white/5 p-5 rounded-xl border border-red-500/30 dark:border-red-500/20 bg-red-500/5 dark:bg-red-500/10 shadow-sm dark:shadow-none flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{exc.employee}</h3>
                    <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">{exc.date}</span>
                  </div>
                  <p className="text-red-600 dark:text-red-400 font-bold text-sm mb-1">{exc.type}</p>
                  <p className="text-slate-600 dark:text-gray-300 text-sm mb-4">{exc.details}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button 
                    onClick={() => handleResolve(exc.id, 'Deduct')}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-md shadow-red-500/20"
                  >
                    Approve Deduction
                  </button>
                  <button 
                    onClick={() => handleResolve(exc.id, 'Forgive')}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white rounded-lg text-sm font-medium transition-colors border border-slate-200 dark:border-white/10"
                  >
                    Forgive
                  </button>
                </div>
              </div>
            ))}

            {highSeverity.length === 0 && (
              <div className="col-span-2 p-8 text-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-slate-500 dark:text-gray-400 text-xs font-semibold">
                No high severity deductions pending review.
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          Warnings Logged
        </h2>
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 border-b border-slate-200 dark:border-white/10 font-semibold uppercase text-xs">
              <tr>
                <th className="p-4 pl-6 font-bold">Employee</th>
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Details</th>
                <th className="p-4 font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              {mediumSeverity.map(exc => (
                <tr key={exc.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">{exc.employee}</td>
                  <td className="p-4 text-amber-600 dark:text-amber-400 font-bold">{exc.type}</td>
                  <td className="p-4 text-slate-600 dark:text-gray-300 font-medium">{exc.details}</td>
                  <td className="p-4 text-slate-500 dark:text-gray-400 font-medium">{exc.date}</td>
                </tr>
              ))}
              {mediumSeverity.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 dark:text-gray-400 font-semibold">
                    No warnings logged.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
