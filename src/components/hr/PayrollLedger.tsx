import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, FileSpreadsheet, Users, Lock, CheckCircle2, Wallet, Printer, Plus, History, X, Building2 } from 'lucide-react';
import { MOCK_EXCEPTIONS } from '../../pages/hr/mockData';
import { getEmployees } from '../../lib/databaseService';
import type { User } from '../../types';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type PaymentMethod = 'Bank Transfer' | 'Cash' | 'Cheque';

interface PaymentTransaction {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
}

export function PayrollLedger() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('July');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [selectedNationality, setSelectedNationality] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    getEmployees().then(setEmployees).catch(err => console.error(err));
  }, []);

  const companiesList = useMemo(() => {
    return ['All', ...new Set(employees.map(e => e.company || e.company_id || 'Company'))];
  }, [employees]);

  // State to track payment transactions per employee ID
  const [transactions, setTransactions] = useState<Record<string, PaymentTransaction[]>>({});

  // Log Payment Modal state
  const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Bank Transfer');

  // Payslip Modal state
  const [activePayslipId, setActivePayslipId] = useState<string | null>(null);

  // Generate dynamic ledger data based on real employees
  const ledgerData = useMemo(() => {
    return employees.map(emp => {
      const isPartTime = emp.role === 'Employee' && emp.id.endsWith('2');
      const daysWorked = isPartTime ? 15 : 22;

      const lateExceptions = MOCK_EXCEPTIONS.filter(exc => exc.employee === emp.name && (exc.type.includes('Late') || exc.type.includes('Departure')));
      const lateCount = lateExceptions.length;
      const unpaidLeave = emp.id.endsWith('4') ? 2 : (emp.id.endsWith('7') ? 1 : 0);

      const deductionValue = (lateCount * 50) + (unpaidLeave * 100);

      let baseSalary = 1500;
      if (emp.role === 'CEO') baseSalary = 8000;
      if (emp.role === 'HR') baseSalary = 4000;
      if (emp.role === 'Accountant') baseSalary = 3000;

      const netPay = baseSalary - deductionValue;

      const empTxs = transactions[emp.id] || [];
      const totalPaid = empTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const balance = Math.max(0, netPay - totalPaid);

      let status: 'Pending' | 'Partially Paid' | 'Fully Paid' = 'Pending';
      if (totalPaid > 0 && balance > 0) status = 'Partially Paid';
      if (totalPaid > 0 && balance === 0) status = 'Fully Paid';

      return {
        ...emp,
        daysWorked,
        lateCount,
        unpaidLeave,
        deductionValue,
        baseSalary,
        netPay,
        totalPaid,
        balance,
        status,
        empTxs,
        exceptions: lateExceptions
      };
    });
  }, [transactions]);

  const filteredData = useMemo(() => {
    return ledgerData.filter(d => {
      const matchCompany = selectedCompany === 'All' || d.company === selectedCompany;
      const matchNationality = selectedNationality === 'All' || d.nationality === selectedNationality;
      const matchGender = selectedGender === 'All' || d.gender === selectedGender;
      return matchCompany && matchNationality && matchGender;
    });
  }, [ledgerData, selectedCompany, selectedNationality, selectedGender]);

  // KPI calculations
  const totalEmployees = filteredData.length;
  const totalNetPay = filteredData.reduce((sum, d) => sum + d.netPay, 0);
  const totalPaidOut = filteredData.reduce((sum, d) => sum + d.totalPaid, 0);
  const paidCount = filteredData.filter(d => d.status === 'Fully Paid').length;

  const handleMarkAllPaid = () => {
    const newTxs = { ...transactions };
    const today = new Date().toISOString().split('T')[0];

    filteredData.forEach(d => {
      if (d.balance > 0) {
        const empList = newTxs[d.id] ? [...newTxs[d.id]] : [];
        empList.push({
          id: Math.random().toString(36).substr(2, 9),
          date: today,
          amount: d.balance,
          method: 'Bank Transfer'
        });
        newTxs[d.id] = empList;
      }
    });
    setTransactions(newTxs);
  };

  const handleLogPayment = () => {
    if (!activeEmployeeId || !payAmount) return;

    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newTx: PaymentTransaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: payDate,
      amount,
      method: payMethod
    };

    setTransactions(prev => {
      const empTxs = prev[activeEmployeeId] ? [...prev[activeEmployeeId]] : [];
      return { ...prev, [activeEmployeeId]: [...empTxs, newTx] };
    });

    setPayAmount('');
  };

  const handleExportCSV = () => {
    let csvContent = "Name,Company,Role,Nationality,Gender,Days Worked,Base Salary,Late Count,Unpaid Leave Deductions,Estimated Deduction,Net Pay,Total Paid,Balance,Status\n";
    filteredData.forEach(row => {
      csvContent += `${row.name},${row.company},${row.role},${row.nationality},${row.gender},${row.daysWorked},${row.baseSalary},${row.lateCount},${row.unpaidLeave},${row.deductionValue},${row.netPay},${row.totalPaid},${row.balance},${row.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Payroll_${selectedCompany}_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeEmpDetails = activeEmployeeId ? ledgerData.find(e => e.id === activeEmployeeId) : null;
  const activePayslipDetails = activePayslipId ? ledgerData.find(e => e.id === activePayslipId) : null;

  return (
    <div className="space-y-6 relative">
      {/* Print styles for the Payslip */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body { background-color: white !important; }
          body * { visibility: hidden; }
          #printable-payslip, #printable-payslip * { visibility: visible !important; }
          #printable-payslip { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            max-height: none !important;
            height: auto !important;
            overflow: visible !important;
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-payslip .overflow-y-auto {
            overflow: visible !important;
          }
          .no-print, .no-print * { display: none !important; }
        }
      `}} />

      {/* Action Bar & Filters */}
      <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between animate-in fade-in zoom-in-95 duration-300 no-print">
        <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 w-full xl:w-auto">
          <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
            <Filter className="w-5 h-5" />
            <span className="font-bold text-xs uppercase tracking-wider">Filters:</span>
          </div>

          <div className="flex gap-2">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              {MONTHS.map(m => <option key={m} value={m} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">2026</option>
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">2025</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary min-w-[140px]">
              {companiesList.map(c => <option key={c} value={c} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{c === 'All' ? 'All Companies' : c}</option>)}
            </select>
            <select value={selectedNationality} onChange={(e) => setSelectedNationality(e.target.value)} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Nationalities</option>
              <option value="Omani" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Omani</option>
              <option value="Expat" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Expat</option>
            </select>
            <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Genders</option>
              <option value="Male" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Male</option>
              <option value="Female" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Female</option>
            </select>
          </div>
        </div>

        <div className="flex w-full xl:w-auto items-center gap-3">
          <button onClick={() => setIsLocked(!isLocked)} className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-colors font-bold text-xs border ${isLocked ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 hover:bg-amber-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
            <Lock className="w-4 h-4" />
            {isLocked ? 'Payroll Locked' : 'Lock Payroll'}
          </button>
          <button onClick={handleExportCSV} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl transition-colors font-bold text-xs shadow-lg shadow-primary/20">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 no-print">
        <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Filtered Employees</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Fully Paid Employees</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{paidCount} <span className="text-sm text-slate-400 dark:text-gray-500 font-normal">/ {totalEmployees}</span></p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-amber-500/20 flex items-center gap-4 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm dark:shadow-none">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 font-bold uppercase tracking-wider">Total Paid Out</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">OMR {totalPaidOut}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-primary/20 flex items-center gap-4 bg-primary/5 dark:bg-primary/10 shadow-sm dark:shadow-none">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-emerald-700 dark:text-primary/80 font-bold uppercase tracking-wider">Total Net Pay</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">OMR {totalNetPay}</p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 no-print">
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Payroll Details</h2>
            {isLocked && (
              <div className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500 text-xs font-bold flex items-center gap-1.5 border border-amber-500/20">
                <Lock className="w-3.5 h-3.5" />
                READ-ONLY
              </div>
            )}
          </div>

          <button onClick={handleMarkAllPaid} disabled={isLocked || filteredData.length === 0} className="flex items-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2 rounded-xl transition-colors font-bold border border-slate-200 dark:border-white/10 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Mark All as Paid
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1400px] text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                <th className="p-4 font-bold pl-6">Employee</th>
                <th className="p-4 font-bold">Demographics</th>
                <th className="p-4 font-bold">Days Worked</th>
                <th className="p-4 font-bold">Base & Deduct</th>
                <th className="p-4 font-bold text-emerald-600 dark:text-emerald-400">Net Pay</th>
                <th className="p-4 font-bold">Balance</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredData.length > 0 ? (
                filteredData.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-slate-900 dark:text-white">{row.name}</div>
                      <div className="text-xs text-slate-500 dark:text-gray-400">{row.company} • {row.role}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.nationality === 'Omani' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'}`}>
                          {row.nationality}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">{row.gender}</span>
                      </div>
                    </td>
                    <td className="p-4 font-extrabold text-slate-900 dark:text-white">{row.daysWorked} <span className="text-xs font-normal text-slate-500 dark:text-gray-500">days</span></td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">OMR {row.baseSalary} <span className="text-xs text-slate-400 dark:text-gray-500 font-normal">Base</span></span>
                        {row.deductionValue > 0 && (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">-OMR {row.deductionValue} <span className="text-slate-400 dark:text-gray-500 font-normal">Deduct</span></span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">OMR {row.netPay}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className={`font-bold ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-500'}`}>OMR {row.balance}</span>
                        {row.totalPaid > 0 && <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Paid: OMR {row.totalPaid}</span>}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${row.status === 'Fully Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                          row.status === 'Partially Paid' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                        }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setActiveEmployeeId(row.id); setPayAmount(row.balance.toString()); }} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-500 rounded-lg transition-colors border border-emerald-500/20" title="Log Payment">
                          <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => setActivePayslipId(row.id)} className="p-2 text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors border border-blue-500/20" title="Preview Payslip">
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-500 dark:text-gray-500 font-bold">
                    No ledger records found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Payment Modal */}
      {activeEmpDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 text-xs">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Log Payment for {activeEmpDetails.name}
              </h2>
              <button onClick={() => setActiveEmployeeId(null)} className="p-2 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-1 font-bold">Net Pay</p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">OMR {activeEmpDetails.netPay}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-1 font-bold">Remaining Balance</p>
                  <p className={`text-lg font-extrabold ${activeEmpDetails.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-400'}`}>OMR {activeEmpDetails.balance}</p>
                </div>
              </div>

              {activeEmpDetails.empTxs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400 dark:text-gray-400" />
                    Payment History
                  </h3>
                  <div className="bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-200 dark:border-white/5 max-h-40 overflow-y-auto">
                    {activeEmpDetails.empTxs.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-white/5 last:border-0 text-xs">
                        <div className="flex flex-col">
                          <span className="text-slate-900 dark:text-white font-bold">OMR {tx.amount}</span>
                          <span className="text-xs text-slate-500 dark:text-gray-400">{tx.method}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-gray-500">{tx.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeEmpDetails.balance > 0 ? (
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">New Installment</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-gray-400">Amount (OMR)</label>
                      <input
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        max={activeEmpDetails.balance}
                        className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Amount in OMR..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-gray-400">Date</label>
                      <input
                        type="date"
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-gray-400">Payment Method</label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="Bank Transfer" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Bank Transfer</option>
                      <option value="Cash" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Cash</option>
                      <option value="Cheque" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Cheque</option>
                    </select>
                  </div>
                  <button onClick={handleLogPayment} className="w-full py-3 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-primary/20">
                    Log Payment
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">Fully Paid</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">This employee has no remaining balance.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Payslip Modal */}
      {activePayslipDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div id="printable-payslip" className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">

            {/* Modal Actions Header (Not Printed) */}
            <div className="bg-gray-100 border-b border-gray-200 p-4 flex justify-between items-center no-print shrink-0">
              <h2 className="text-gray-800 font-bold flex items-center gap-2">
                <Printer className="w-5 h-5 text-gray-500" />
                Payslip Preview
              </h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm text-sm flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button onClick={() => setActivePayslipId(null)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actual Printable Payslip Content */}
            <div className="p-8 bg-white text-gray-800 overflow-y-auto relative">

              {/* Premium Status Watermark */}
              {activePayslipDetails.status === 'Fully Paid' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-25deg] text-green-500/10 font-black text-7xl tracking-widest pointer-events-none z-0 whitespace-nowrap border-4 border-green-500/10 rounded-3xl p-6">
                  FULLY SETTLED
                </div>
              )}
              {activePayslipDetails.status !== 'Fully Paid' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-25deg] text-red-500/10 font-black text-6xl tracking-widest pointer-events-none z-0 whitespace-nowrap border-4 border-red-500/10 rounded-3xl p-6">
                  BALANCE DUE
                </div>
              )}

              <div className="relative z-10 space-y-8">
                {/* Header Row */}
                <div className="flex justify-between items-start border-b-2 border-gray-100 pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-black text-gray-900 tracking-tight">{activePayslipDetails.company}</h1>
                      <p className="text-sm text-gray-500 font-medium tracking-wide uppercase">Official Payslip</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-800">{selectedMonth} {selectedYear}</p>
                    <p className="text-sm text-gray-500">Issued: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Employee Info Grid */}
                <div className="grid grid-cols-2 gap-6 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Employee Name</p>
                    <p className="text-lg font-bold text-gray-900">{activePayslipDetails.name}</p>
                    <p className="text-sm text-blue-600 font-medium">{activePayslipDetails.role}</p>
                  </div>
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Employee ID</p>
                        <p className="text-sm font-semibold text-gray-800">{activePayslipDetails.id}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Nationality</p>
                        <p className="text-sm font-semibold text-gray-800">{activePayslipDetails.nationality}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Days Worked</p>
                        <p className="text-sm font-semibold text-gray-800">{activePayslipDetails.daysWorked} days</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-1">Gender</p>
                        <p className="text-sm font-semibold text-gray-800">{activePayslipDetails.gender}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Earnings & Deductions</h3>
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="py-2 font-medium">Description</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="py-3 font-medium text-gray-900">Base Salary</td>
                        <td className="py-3 text-right font-bold text-gray-900">OMR {activePayslipDetails.baseSalary.toFixed(2)}</td>
                      </tr>
                      {activePayslipDetails.lateCount > 0 && (
                        <tr>
                          <td className="py-3 text-red-600">Late Deductions ({activePayslipDetails.lateCount} instances)</td>
                          <td className="py-3 text-right text-red-600 font-medium">-OMR {(activePayslipDetails.lateCount * 50).toFixed(2)}</td>
                        </tr>
                      )}
                      {activePayslipDetails.unpaidLeave > 0 && (
                        <tr>
                          <td className="py-3 text-red-600">Unpaid Leave Deductions ({activePayslipDetails.unpaidLeave} days)</td>
                          <td className="py-3 text-right text-red-600 font-medium">-OMR {(activePayslipDetails.unpaidLeave * 100).toFixed(2)}</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="py-4 text-right font-bold text-gray-900 uppercase tracking-wider text-sm">Net Pay</td>
                        <td className="py-4 text-right font-black text-2xl text-blue-600">OMR {activePayslipDetails.netPay.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Transaction History */}
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Payment Installment History</h3>
                  {activePayslipDetails.empTxs.length > 0 ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50">
                          <tr className="text-gray-500 text-xs uppercase tracking-wider">
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Method</th>
                            <th className="px-4 py-3 font-medium text-right">Amount Paid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {activePayslipDetails.empTxs.map((tx) => (
                            <tr key={tx.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">{tx.date}</td>
                              <td className="px-4 py-3 text-gray-600">{tx.method}</td>
                              <td className="px-4 py-3 text-right font-bold text-green-600">OMR {tx.amount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-900">Total Paid</td>
                            <td className="px-4 py-3 text-right font-bold text-green-600">OMR {activePayslipDetails.totalPaid.toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-500 italic border border-gray-100">
                      No payment installments recorded yet.
                    </div>
                  )}
                </div>

                {/* Final Summary Box */}
                <div className={`mt-8 p-6 rounded-2xl border-2 flex justify-between items-center ${activePayslipDetails.balance > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-green-50 border-green-200 text-green-900'
                  }`}>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wider opacity-70 mb-1">
                      {activePayslipDetails.balance > 0 ? 'Remaining Balance' : 'Status'}
                    </p>
                    <p className="text-2xl font-black">
                      {activePayslipDetails.balance > 0 ? `OMR ${activePayslipDetails.balance.toFixed(2)}` : 'Fully Settled'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">Authorized By</p>
                    <p className="text-sm font-semibold">Osan HR Dept.</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
