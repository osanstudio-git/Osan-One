import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, FileSpreadsheet, Users, Lock, CheckCircle2, Wallet, Printer, Plus, History, X, Building2, Edit3, Save } from 'lucide-react';
import { MOCK_EXCEPTIONS } from '../../pages/hr/mockData';
import { 
  getEmployees, 
  getPayrollTransactionsFromDb, 
  savePayrollTransactionToDb, 
  getEmployeePayslipOverrides, 
  saveEmployeePayslipRecord 
} from '../../lib/databaseService';
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
  const [selectedMonth, setSelectedMonth] = useState('September');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [selectedCompany, setSelectedCompany] = useState<string>('All');
  const [selectedNationality, setSelectedNationality] = useState<string>('All');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [isLocked, setIsLocked] = useState(false);

  // Payslip editable overrides map: { [userId]: { basicSalary, otherAllowance, transportation, advanceSalary, deductionNotCame, probationFirstMonth, deductionAnnualLeave, overtimeAmount, paidDays, leaveDays, hoursWorked, accountNumber, mobileNumber } }
  const [payslipOverrides, setPayslipOverrides] = useState<Record<string, any>>({});
  const [isEditingPayslip, setIsEditingPayslip] = useState(false);
  const [payslipEditForm, setPayslipEditForm] = useState<any>({});

  const loadData = async () => {
    try {
      const [emps, txMap, overrides] = await Promise.all([
        getEmployees(),
        getPayrollTransactionsFromDb(selectedMonth, selectedYear),
        getEmployeePayslipOverrides(selectedMonth, selectedYear)
      ]);
      setEmployees(emps);
      setTransactions(txMap);
      setPayslipOverrides(overrides);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

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

  // Generate dynamic ledger data based on real employees and custom overrides
  const ledgerData = useMemo(() => {
    return employees.map(emp => {
      const override = payslipOverrides[emp.id] || {};

      const isPartTime = emp.role === 'Employee' && emp.id.endsWith('2');
      const daysWorked = override.paid_days !== undefined ? Number(override.paid_days) : (isPartTime ? 15 : 22);

      const lateExceptions = MOCK_EXCEPTIONS.filter(exc => exc.employee === emp.name && (exc.type.includes('Late') || exc.type.includes('Departure')));
      const lateCount = lateExceptions.length;
      const unpaidLeave = emp.id.endsWith('4') ? 2 : (emp.id.endsWith('7') ? 1 : 0);

      // Default or custom earnings & allowances
      let baseSalary = override.basic_salary !== undefined 
        ? Number(override.basic_salary) 
        : (emp.base_salary ? Number(emp.base_salary) : (emp.role === 'CEO' ? 8000 : emp.role === 'HR' ? 4000 : emp.role === 'Accountant' ? 3000 : 1200));

      const otherAllowance = override.other_allowance !== undefined ? Number(override.other_allowance) : 70;
      const transportation = override.transportation !== undefined ? Number(override.transportation) : 0;
      const overtimeAmount = override.overtime_amount !== undefined ? Number(override.overtime_amount) : 0;
      const grossEarnings = baseSalary + otherAllowance + transportation;

      // Deductions
      const advanceSalary = override.advance_salary !== undefined ? Number(override.advance_salary) : 0;
      const deductionNotCame = override.deduction_not_came !== undefined ? Number(override.deduction_not_came) : 0;
      const probationFirstMonth = override.probation_first_month !== undefined ? Number(override.probation_first_month) : 0;
      const deductionAnnualLeave = override.deduction_annual_leave !== undefined ? Number(override.deduction_annual_leave) : 0;

      const totalDeductions = advanceSalary + deductionNotCame + probationFirstMonth + deductionAnnualLeave;
      const netPay = Math.max(0, grossEarnings + overtimeAmount - totalDeductions);

      const empTxs = transactions[emp.id] || [];
      const totalPaid = empTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const balance = Math.max(0, netPay - totalPaid);

      let status: 'Pending' | 'Partially Paid' | 'Fully Paid' = 'Pending';
      if (totalPaid > 0 && balance > 0) status = 'Partially Paid';
      if (totalPaid > 0 && balance === 0) status = 'Fully Paid';

      return {
        ...emp,
        daysWorked,
        leaveDays: override.leave_days !== undefined ? Number(override.leave_days) : 0,
        hoursWorked: override.hours_worked || '00:000',
        lateCount,
        unpaidLeave,
        baseSalary,
        otherAllowance,
        transportation,
        grossEarnings,
        advanceSalary,
        deductionNotCame,
        probationFirstMonth,
        deductionAnnualLeave,
        totalDeductions,
        overtimeAmount,
        netPay,
        totalPaid,
        balance,
        status,
        empTxs,
        exceptions: lateExceptions,
        accountNumber: override.account_number || emp.account_number || 'CASH IN HAND',
        mobileNumber: override.mobile_number || emp.phone || ''
      };
    });
  }, [employees, transactions, payslipOverrides]);

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

  const handleMarkAllPaid = async () => {
    const newTxs = { ...transactions };
    const today = new Date().toISOString().split('T')[0];

    for (const d of filteredData) {
      if (d.balance > 0) {
        const empList = newTxs[d.id] ? [...newTxs[d.id]] : [];
        const newTx: PaymentTransaction = {
          id: Math.random().toString(36).substr(2, 9),
          date: today,
          amount: d.balance,
          method: 'Bank Transfer'
        };
        empList.push(newTx);
        newTxs[d.id] = empList;

        // Persist to Supabase
        await savePayrollTransactionToDb({
          userId: d.id,
          month: selectedMonth,
          year: selectedYear,
          amount: d.balance,
          method: 'Bank Transfer',
          date: today
        });
      }
    }
    setTransactions(newTxs);
  };

  const handleLogPayment = async () => {
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

    // Persist to Supabase
    await savePayrollTransactionToDb({
      userId: activeEmployeeId,
      month: selectedMonth,
      year: selectedYear,
      amount,
      method: payMethod,
      date: payDate
    });
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

      {/* Exact OSAN GROUP SPC Official Payslip Modal */}
      {activePayslipDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-300">

            {/* Modal Actions Toolbar (Hidden from Print) */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-3.5 flex justify-between items-center no-print shrink-0">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-slate-600" />
                <h2 className="text-slate-800 font-bold text-sm">
                  Official Payslip • {activePayslipDetails.name} ({selectedMonth} {selectedYear})
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isEditingPayslip) {
                      setPayslipEditForm({
                        basicSalary: activePayslipDetails.baseSalary,
                        otherAllowance: activePayslipDetails.otherAllowance,
                        transportation: activePayslipDetails.transportation,
                        overtimeAmount: activePayslipDetails.overtimeAmount,
                        advanceSalary: activePayslipDetails.advanceSalary,
                        deductionNotCame: activePayslipDetails.deductionNotCame,
                        probationFirstMonth: activePayslipDetails.probationFirstMonth,
                        deductionAnnualLeave: activePayslipDetails.deductionAnnualLeave,
                        paidDays: activePayslipDetails.daysWorked,
                        leaveDays: activePayslipDetails.leaveDays,
                        hoursWorked: activePayslipDetails.hoursWorked,
                        accountNumber: activePayslipDetails.accountNumber,
                        mobileNumber: activePayslipDetails.mobileNumber
                      });
                      setIsEditingPayslip(true);
                    } else {
                      setIsEditingPayslip(false);
                    }
                  }}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg font-bold transition-colors text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  {isEditingPayslip ? 'Cancel Edit' : 'Edit Payslip'}
                </button>

                {isEditingPayslip && (
                  <button
                    onClick={async () => {
                      if (!activePayslipDetails) return;
                      await saveEmployeePayslipRecord({
                        userId: activePayslipDetails.id,
                        month: selectedMonth,
                        year: selectedYear,
                        ...payslipEditForm
                      });
                      setPayslipOverrides(prev => ({
                        ...prev,
                        [activePayslipDetails.id]: {
                          ...prev[activePayslipDetails.id],
                          basic_salary: payslipEditForm.basicSalary,
                          other_allowance: payslipEditForm.otherAllowance,
                          transportation: payslipEditForm.transportation,
                          overtime_amount: payslipEditForm.overtimeAmount,
                          advance_salary: payslipEditForm.advanceSalary,
                          deduction_not_came: payslipEditForm.deductionNotCame,
                          probation_first_month: payslipEditForm.probationFirstMonth,
                          deduction_annual_leave: payslipEditForm.deductionAnnualLeave,
                          paid_days: payslipEditForm.paidDays,
                          leave_days: payslipEditForm.leaveDays,
                          hours_worked: payslipEditForm.hoursWorked,
                          account_number: payslipEditForm.accountNumber,
                          mobile_number: payslipEditForm.mobileNumber
                        }
                      }));
                      setIsEditingPayslip(false);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                )}

                <button 
                  onClick={() => window.print()} 
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-xs text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
                <button 
                  onClick={() => { setActivePayslipId(null); setIsEditingPayslip(false); }} 
                  className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Editable Form Panel (Shown when Edit mode is toggled) */}
            {isEditingPayslip && (
              <div className="bg-amber-50/70 border-b border-amber-200 p-4 overflow-y-auto max-h-48 text-xs text-slate-800 no-print">
                <div className="font-bold text-amber-900 mb-2 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Payslip Values for {activePayslipDetails.name} ({selectedMonth} {selectedYear})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Basic Salary (OMR)</label>
                    <input
                      type="number"
                      value={payslipEditForm.basicSalary}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, basicSalary: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Other Allowance (OMR)</label>
                    <input
                      type="number"
                      value={payslipEditForm.otherAllowance}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, otherAllowance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Transportation (OMR)</label>
                    <input
                      type="number"
                      value={payslipEditForm.transportation}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, transportation: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Overtime / Incentives</label>
                    <input
                      type="number"
                      value={payslipEditForm.overtimeAmount}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, overtimeAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-red-700 mb-0.5">Advance Salary (Deduction)</label>
                    <input
                      type="number"
                      value={payslipEditForm.advanceSalary}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, advanceSalary: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-red-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-red-700 mb-0.5">Deduction Not Came / Sick</label>
                    <input
                      type="number"
                      value={payslipEditForm.deductionNotCame}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, deductionNotCame: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-red-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-red-700 mb-0.5">Probation First Month</label>
                    <input
                      type="number"
                      value={payslipEditForm.probationFirstMonth}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, probationFirstMonth: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-red-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-red-700 mb-0.5">Deduction Annual Leave</label>
                    <input
                      type="number"
                      value={payslipEditForm.deductionAnnualLeave}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, deductionAnnualLeave: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-red-600 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Paid Days</label>
                    <input
                      type="number"
                      value={payslipEditForm.paidDays}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, paidDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Leave Days</label>
                    <input
                      type="number"
                      value={payslipEditForm.leaveDays}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, leaveDays: parseInt(e.target.value) || 0 })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">Hours Worked</label>
                    <input
                      type="text"
                      value={payslipEditForm.hoursWorked}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, hoursWorked: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 mb-0.5">A/C Number or Cash</label>
                    <input
                      type="text"
                      value={payslipEditForm.accountNumber}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, accountNumber: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Official Printable Payslip Content - Matching Osan Group SPC Document Structure */}
            <div id="printable-payslip" className="p-6 md:p-8 bg-white text-black overflow-y-auto font-sans leading-tight">
              
              <div className="border-4 border-black p-4 md:p-6 bg-white min-h-[700px] flex flex-col justify-between">
                
                <div>
                  {/* Top Header: Company Name & Month */}
                  <div className="text-center mb-4">
                    <h1 className="text-3xl md:text-4xl font-black tracking-wider uppercase text-black font-serif">
                      OSAN GROUP SPC
                    </h1>
                    <p className="text-base font-bold text-black mt-1 uppercase tracking-wide">
                      Payslip for the Month of {selectedMonth.slice(0, 3).toUpperCase()} {selectedYear}
                    </p>
                  </div>

                  {/* Summary Header Tables */}
                  <div className="border-2 border-black mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black text-xs">
                      
                      {/* Left: Employee Info */}
                      <div className="md:col-span-8 p-0">
                        <div className="bg-slate-200 font-bold px-3 py-1.5 border-b-2 border-black text-xs uppercase tracking-wide">
                          Employee Pay Summary
                        </div>
                        <div className="p-3 space-y-1.5 text-xs font-semibold">
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Employee Name:</span>
                            <span className="font-extrabold uppercase">{activePayslipDetails.name}</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Designation:</span>
                            <span>{activePayslipDetails.job_title || activePayslipDetails.role || 'Staff'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Date of Joining:</span>
                            <span>{activePayslipDetails.join_date ? new Date(activePayslipDetails.join_date).toLocaleDateString('en-GB') : '23/07/2026'}</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Pay Period:</span>
                            <span>Monthly</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Pay Date:</span>
                            <span>{new Date().toLocaleDateString('en-GB')}</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">A/C Number:</span>
                            <span className="font-bold">{activePayslipDetails.accountNumber}</span>
                          </div>
                          <div className="flex">
                            <span className="w-36 font-bold text-black">Mobile Number:</span>
                            <span>{activePayslipDetails.mobileNumber || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Net Pay Box & Attendance Stats */}
                      <div className="md:col-span-4 p-0 flex flex-col justify-between">
                        <div>
                          <div className="bg-slate-200 font-bold px-3 py-1.5 border-b-2 border-black text-center text-xs uppercase tracking-wide">
                            Employee Net Pay
                          </div>
                          <div className="p-4 text-center border-b-2 border-black bg-slate-50">
                            <div className="text-xs font-bold text-black mb-1 uppercase">OMR</div>
                            <div className="text-3xl font-black text-black">
                              {activePayslipDetails.netPay.toFixed(3)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 divide-x-2 divide-black text-[11px] font-bold text-center border-t-2 border-black bg-white">
                          <div className="p-2">
                            <div className="text-slate-600 text-[10px]">Paid Days:</div>
                            <div className="text-sm font-black">{activePayslipDetails.daysWorked}</div>
                          </div>
                          <div className="p-2">
                            <div className="text-slate-600 text-[10px]">Leave Days:</div>
                            <div className="text-sm font-black">{activePayslipDetails.leaveDays || 0}</div>
                          </div>
                          <div className="p-2">
                            <div className="text-slate-600 text-[10px]">Hours:</div>
                            <div className="text-xs font-black">{activePayslipDetails.hoursWorked}</div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Earnings & Deductions Official Breakdown Table */}
                  <div className="border-2 border-black mb-4 overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-200 border-b-2 border-black font-extrabold uppercase text-[11px]">
                          <th className="p-2 border-r-2 border-black w-1/4">EARNINGS</th>
                          <th className="p-2 border-r-2 border-black text-right w-1/4">AMOUNT (OMR)</th>
                          <th className="p-2 border-r-2 border-black w-1/4">DEDUCTIONS</th>
                          <th className="p-2 text-right w-1/4">AMOUNT (OMR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/30 font-medium text-xs">
                        <tr>
                          <td className="p-2 border-r-2 border-black">Basic Salary</td>
                          <td className="p-2 border-r-2 border-black text-right font-bold">{activePayslipDetails.baseSalary.toFixed(3)}</td>
                          <td className="p-2 border-r-2 border-black">Advance Salary</td>
                          <td className="p-2 text-right font-bold text-red-600">{activePayslipDetails.advanceSalary > 0 ? activePayslipDetails.advanceSalary.toFixed(3) : '-'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r-2 border-black">Other Allowance</td>
                          <td className="p-2 border-r-2 border-black text-right font-bold">{activePayslipDetails.otherAllowance > 0 ? activePayslipDetails.otherAllowance.toFixed(3) : '-'}</td>
                          <td className="p-2 border-r-2 border-black">Deduction not came & Sick leave</td>
                          <td className="p-2 text-right font-bold text-red-600">{activePayslipDetails.deductionNotCame > 0 ? activePayslipDetails.deductionNotCame.toFixed(3) : '-'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r-2 border-black">EARNINGS</td>
                          <td className="p-2 border-r-2 border-black text-right font-bold">-</td>
                          <td className="p-2 border-r-2 border-black">Probation Period First Month</td>
                          <td className="p-2 text-right font-bold text-red-600">{activePayslipDetails.probationFirstMonth > 0 ? activePayslipDetails.probationFirstMonth.toFixed(3) : '-'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r-2 border-black">Transportation</td>
                          <td className="p-2 border-r-2 border-black text-right font-bold">{activePayslipDetails.transportation > 0 ? activePayslipDetails.transportation.toFixed(3) : '-'}</td>
                          <td className="p-2 border-r-2 border-black">Deduction Annual Leave</td>
                          <td className="p-2 text-right font-bold text-red-600">{activePayslipDetails.deductionAnnualLeave > 0 ? activePayslipDetails.deductionAnnualLeave.toFixed(3) : '-'}</td>
                        </tr>
                        <tr>
                          <td className="p-2 border-r-2 border-black font-bold">Incentives / Overtime</td>
                          <td className="p-2 border-r-2 border-black text-right font-bold">{activePayslipDetails.overtimeAmount > 0 ? activePayslipDetails.overtimeAmount.toFixed(3) : '-'}</td>
                          <td className="p-2 border-r-2 border-black font-bold">Total Deductions</td>
                          <td className="p-2 text-right font-extrabold text-red-600">{activePayslipDetails.totalDeductions.toFixed(3)}</td>
                        </tr>
                        <tr className="bg-slate-100 font-extrabold border-t-2 border-black">
                          <td className="p-2.5 border-r-2 border-black">Gross Earnings</td>
                          <td className="p-2.5 border-r-2 border-black text-right">{activePayslipDetails.grossEarnings.toFixed(3)}</td>
                          <td className="p-2.5 border-r-2 border-black uppercase text-blue-900 font-black">Total Net Payable</td>
                          <td className="p-2.5 text-right font-black text-sm text-blue-900">OMR {activePayslipDetails.netPay.toFixed(3)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="text-[11px] text-slate-700 italic mb-8">
                    Note: I acknowledge that the salary amount mentioned above is correct and received.
                  </div>
                </div>

                {/* Bottom Official Signatures Area (Exact layout from uploaded document) */}
                <div className="border-t-2 border-black pt-6 mt-4">
                  <div className="grid grid-cols-4 gap-4 text-center items-end">
                    
                    {/* Approved By */}
                    <div className="flex flex-col items-center">
                      <div className="h-14 flex items-end justify-center font-serif italic text-lg font-bold text-blue-900">
                        Hamid
                      </div>
                      <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase">
                        Approved by
                      </div>
                      <span className="text-[10px] text-slate-600">{new Date().toLocaleDateString('en-GB')}</span>
                    </div>

                    {/* Prepared By */}
                    <div className="flex flex-col items-center">
                      <div className="h-14 flex items-end justify-center font-serif italic text-lg font-bold text-blue-900">
                        HR Dept.
                      </div>
                      <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase">
                        Prepared by
                      </div>
                      <span className="text-[10px] text-slate-600">{new Date().toLocaleDateString('en-GB')}</span>
                    </div>

                    {/* Authorized Signature + Stamp */}
                    <div className="flex flex-col items-center">
                      <div className="h-14 flex items-center justify-center">
                        <div className="border-2 border-blue-800 text-blue-800 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest rotate-[-5deg]">
                          OSAN GROUP SPC<br /><span className="text-[9px]">C.R: 1245480</span>
                        </div>
                      </div>
                      <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase">
                        Authorized Signature
                      </div>
                      <span className="text-[10px] text-slate-600">{new Date().toLocaleDateString('en-GB')}</span>
                    </div>

                    {/* Employee Signature */}
                    <div className="flex flex-col items-center">
                      <div className="h-14 flex items-end justify-center font-serif italic text-base text-slate-700">
                        {activePayslipDetails.name.split(' ')[0]}
                      </div>
                      <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase">
                        Employee Signature
                      </div>
                      <span className="text-[10px] text-slate-600">{new Date().toLocaleDateString('en-GB')}</span>
                    </div>

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
