import { PayrollLedger } from '../../components/hr/PayrollLedger';

export function HrReports() {
  return (
    <div className="space-y-6">
      <div className="mb-2">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Company Reports</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400">View and export monthly attendance reports per company.</p>
      </div>

      <PayrollLedger />
    </div>
  );
}
