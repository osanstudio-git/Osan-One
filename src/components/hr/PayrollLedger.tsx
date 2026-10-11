import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, FileSpreadsheet, Users, Lock, CheckCircle2, Wallet, Printer, Plus, History, X, Save, FileText, Check } from 'lucide-react';
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

  const [payslipOverrides, setPayslipOverrides] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
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
        deductionValue: totalDeductions,
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
      csvContent += `${row.name},${row.company},${row.role},${row.nationality},${row.gender},${row.daysWorked},${row.baseSalary},${row.lateCount},${row.unpaidLeave},${row.totalDeductions},${row.netPay},${row.totalPaid},${row.balance},${row.status}\n`;
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

  const handleOpenPayslip = (row: any) => {
    setActivePayslipId(row.id);
    const existing = payslipOverrides[row.id] || {};
    setPayslipEditForm({
      employeeName: existing.employee_name || row.name || '',
      designation: existing.designation || row.job_title || row.role || 'Accountant',
      dateOfJoining: existing.date_of_joining || (row.join_date ? new Date(row.join_date).toLocaleDateString('en-GB') : '23/07/2026'),
      payPeriod: existing.pay_period || 'Monthly',
      payDate: existing.pay_date || '06/10/2026',
      accountNumber: existing.account_number || row.accountNumber || row.account_number || 'CASH IN HAND',
      mobileNumber: existing.mobile_number || row.mobileNumber || row.phone || '',
      paidDays: existing.paid_days !== undefined ? Number(existing.paid_days) : (row.daysWorked || 30),
      leaveDays: existing.leave_days !== undefined ? Number(existing.leave_days) : (row.leaveDays || 0),
      hoursWorked: existing.hours_worked || row.hoursWorked || '00:000',
      basicSalary: existing.basic_salary !== undefined ? Number(existing.basic_salary) : (row.baseSalary || 120),
      otherAllowance: existing.other_allowance !== undefined ? Number(existing.other_allowance) : (row.otherAllowance || 70),
      transportation: existing.transportation !== undefined ? Number(existing.transportation) : (row.transportation || 0),
      overtimeAmount: existing.overtime_amount !== undefined ? Number(existing.overtime_amount) : (row.overtimeAmount || 0),
      advanceSalary: existing.advance_salary !== undefined ? Number(existing.advance_salary) : (row.advanceSalary || 0),
      deductionNotCame: existing.deduction_not_came !== undefined ? Number(existing.deduction_not_came) : (row.deductionNotCame || 0),
      probationFirstMonth: existing.probation_first_month !== undefined ? Number(existing.probation_first_month) : (row.probationFirstMonth || 0),
      deductionAnnualLeave: existing.deduction_annual_leave !== undefined ? Number(existing.deduction_annual_leave) : (row.deductionAnnualLeave || 0),
      totalBalance: existing.total_balance !== undefined ? Number(existing.total_balance) : (row.balance || 0),
    });
  };

  const liveBasicSalary = Number(payslipEditForm.basicSalary) || 0;
  const liveOtherAllowance = Number(payslipEditForm.otherAllowance) || 0;
  const liveTransportation = Number(payslipEditForm.transportation) || 0;
  const liveOvertimeAmount = Number(payslipEditForm.overtimeAmount) || 0;
  const liveAdvanceSalary = Number(payslipEditForm.advanceSalary) || 0;
  const liveDeductionNotCame = Number(payslipEditForm.deductionNotCame) || 0;
  const liveProbationFirstMonth = Number(payslipEditForm.probationFirstMonth) || 0;
  const liveDeductionAnnualLeave = Number(payslipEditForm.deductionAnnualLeave) || 0;
  const liveTotalBalance = Number(payslipEditForm.totalBalance) || 0;

  const liveGrossEarnings = liveBasicSalary + liveOtherAllowance + liveTransportation;
  const liveTotalDeductions = liveAdvanceSalary + liveDeductionNotCame + liveProbationFirstMonth + liveDeductionAnnualLeave;
  const liveNetPay = Math.max(0, liveGrossEarnings + liveOvertimeAmount - liveTotalDeductions);

  const handleSavePayslipRecord = async () => {
    if (!activePayslipDetails) return;
    setSaveStatus('saving');
    await saveEmployeePayslipRecord({
      userId: activePayslipDetails.id,
      month: selectedMonth,
      year: selectedYear,
      employeeName: payslipEditForm.employeeName,
      designation: payslipEditForm.designation,
      dateOfJoining: payslipEditForm.dateOfJoining,
      payPeriod: payslipEditForm.payPeriod,
      payDate: payslipEditForm.payDate,
      basicSalary: liveBasicSalary,
      otherAllowance: liveOtherAllowance,
      transportation: liveTransportation,
      overtimeAmount: liveOvertimeAmount,
      advanceSalary: liveAdvanceSalary,
      deductionNotCame: liveDeductionNotCame,
      probationFirstMonth: liveProbationFirstMonth,
      deductionAnnualLeave: liveDeductionAnnualLeave,
      totalBalance: liveTotalBalance,
      paidDays: Number(payslipEditForm.paidDays) || 0,
      leaveDays: Number(payslipEditForm.leaveDays) || 0,
      hoursWorked: payslipEditForm.hoursWorked,
      accountNumber: payslipEditForm.accountNumber,
      mobileNumber: payslipEditForm.mobileNumber
    });

    setPayslipOverrides(prev => ({
      ...prev,
      [activePayslipDetails.id]: {
        ...prev[activePayslipDetails.id],
        employee_name: payslipEditForm.employeeName,
        designation: payslipEditForm.designation,
        date_of_joining: payslipEditForm.dateOfJoining,
        pay_period: payslipEditForm.payPeriod,
        pay_date: payslipEditForm.payDate,
        basic_salary: liveBasicSalary,
        other_allowance: liveOtherAllowance,
        transportation: liveTransportation,
        overtime_amount: liveOvertimeAmount,
        advance_salary: liveAdvanceSalary,
        deduction_not_came: liveDeductionNotCame,
        probation_first_month: liveProbationFirstMonth,
        deduction_annual_leave: liveDeductionAnnualLeave,
        total_balance: liveTotalBalance,
        paid_days: Number(payslipEditForm.paidDays) || 0,
        leave_days: Number(payslipEditForm.leaveDays) || 0,
        hours_worked: payslipEditForm.hoursWorked,
        account_number: payslipEditForm.accountNumber,
        mobile_number: payslipEditForm.mobileNumber
      }
    }));

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2500);
  };

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
                        {row.totalDeductions > 0 && (
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">-OMR {row.totalDeductions} <span className="text-slate-400 dark:text-gray-500 font-normal">Deduct</span></span>
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
                        <button onClick={() => handleOpenPayslip(row)} className="p-2 text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors border border-blue-500/20" title="Preview & Edit Payslip">
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

      {/* Live Real-Time 2-Column OSAN GROUP SPC Payslip Generator Modal */}
      {activePayslipDetails && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-[1400px] bg-[#0b101e] text-white rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in-95 duration-300">

            {/* Top Modal Header Bar (Matching Image 1) */}
            <div className="bg-[#0e172a] border-b border-slate-800 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Official Osan Group SPC Payslip Generator (كشف راتب رسمي)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Official Monthly Payslip with CR No. 1245480, Verified Deductions & Bank/Cash Ledger
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <button
                  onClick={() => window.print()}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>PRINT / EXPORT PAYSLIP PDF</span>
                </button>

                <button
                  onClick={() => setActivePayslipId(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                  title="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split Screen Body: Left Parameters (Live Edit) + Right Document Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0">

              {/* LEFT COLUMN: PAYSLIP PARAMETERS (Real-time Editable) */}
              <div className="lg:col-span-4 xl:col-span-4 bg-[#0d1424] border-r border-slate-800 p-5 overflow-y-auto max-h-[84vh] space-y-5 text-xs text-slate-300 no-print">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-rose-500 font-extrabold text-xs tracking-wider uppercase">PAYSLIP PARAMETERS</span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    ● Real-Time Sync
                  </span>
                </div>

                {/* EMPLOYEE INFO SECTION */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Employee Information</div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Employee Name</label>
                    <input
                      type="text"
                      value={payslipEditForm.employeeName || ''}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, employeeName: e.target.value })}
                      className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Designation</label>
                      <input
                        type="text"
                        value={payslipEditForm.designation || ''}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, designation: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date of Joining</label>
                      <input
                        type="text"
                        value={payslipEditForm.dateOfJoining || ''}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, dateOfJoining: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Pay Period</label>
                      <input
                        type="text"
                        value={payslipEditForm.payPeriod || 'Monthly'}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, payPeriod: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Pay Date</label>
                      <input
                        type="text"
                        value={payslipEditForm.payDate || ''}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, payDate: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">A/C Number / Cash</label>
                      <input
                        type="text"
                        value={payslipEditForm.accountNumber || ''}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, accountNumber: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mobile Number</label>
                      <input
                        type="text"
                        value={payslipEditForm.mobileNumber || ''}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, mobileNumber: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* ATTENDANCE METRICS */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Attendance Summary</div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Paid Days</label>
                      <input
                        type="number"
                        value={payslipEditForm.paidDays ?? 30}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, paidDays: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Leave Days</label>
                      <input
                        type="number"
                        value={payslipEditForm.leaveDays ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, leaveDays: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Hours</label>
                      <input
                        type="text"
                        value={payslipEditForm.hoursWorked || '00:000'}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, hoursWorked: e.target.value })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* EARNINGS SECTION */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">Earnings (OMR)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Basic Salary</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.basicSalary ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, basicSalary: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-extrabold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Other Allowance</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.otherAllowance ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, otherAllowance: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Transportation</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.transportation ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, transportation: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Overtime / Incentives</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.overtimeAmount ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, overtimeAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>

                {/* DEDUCTIONS SECTION */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Deductions (OMR)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Advance Salary</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.advanceSalary ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, advanceSalary: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-red-400 font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Not Came & Sick</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.deductionNotCame ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, deductionNotCame: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-red-400 font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Probation 1st Month</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.probationFirstMonth ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, probationFirstMonth: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-red-400 font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Annual Leave Deduct</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.deductionAnnualLeave ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, deductionAnnualLeave: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-red-400 font-bold outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Total Balance / Carryover (OMR)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={payslipEditForm.totalBalance ?? 0}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, totalBalance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-bold outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                {/* SAVE ACTION BUTTON */}
                <div className="pt-2">
                  <button
                    onClick={handleSavePayslipRecord}
                    disabled={saveStatus === 'saving'}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                      saveStatus === 'saved'
                        ? 'bg-emerald-600 text-white'
                        : saveStatus === 'saving'
                        ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    }`}
                  >
                    {saveStatus === 'saved' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Changes Saved to Database!</span>
                      </>
                    ) : saveStatus === 'saving' ? (
                      <span>Saving to Supabase...</span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Payslip Record</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-2 italic">
                    Values update in real-time on the document preview to the right.
                  </p>
                </div>
              </div>

              {/* RIGHT COLUMN: LIVE OSAN GROUP SPC PRINTABLE DOCUMENT */}
              <div className="lg:col-span-8 xl:col-span-8 bg-slate-200 dark:bg-slate-900/90 p-4 sm:p-6 overflow-y-auto max-h-[84vh] flex justify-center items-start">
                
                {/* The Paper Sheet */}
                <div id="printable-payslip" className="bg-white text-black p-6 sm:p-8 shadow-2xl rounded-sm w-full max-w-[820px] border border-slate-400 select-text font-sans">
                  
                  {/* Thick Outer Black Border (Exact match to Image 2) */}
                  <div className="border-[2.5px] border-black p-3 sm:p-5 bg-white min-h-[750px] flex flex-col justify-between">
                    
                    <div>
                      {/* Top Centered Header: OSAN GROUP SPC */}
                      <div className="text-center mb-1">
                        <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-[0.25em] text-slate-800 uppercase text-center">
                          OSAN GROUP SPC
                        </h1>
                      </div>

                      {/* Boxed Subheader: Payslip for the Month of ... */}
                      <div className="border border-black py-1 text-center mb-3 bg-white">
                        <span className="text-xs sm:text-sm font-bold text-black uppercase tracking-wide">
                          Payslip for the Month of {selectedMonth.slice(0, 3).toUpperCase()} {selectedYear}
                        </span>
                      </div>

                      {/* Top Two-Part Grid Box */}
                      <div className="border-2 border-black grid grid-cols-12 text-xs mb-3">
                        
                        {/* Left Box: Employee Pay Summary */}
                        <div className="col-span-7 border-r-2 border-black">
                          <div className="bg-[#d9d9d9] font-black px-2.5 py-1 border-b-2 border-black text-xs uppercase tracking-tight">
                            Employee Pay Summary
                          </div>
                          <div className="p-2.5 space-y-1 text-xs font-semibold">
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Employee Name:</span>
                              <span className="font-extrabold uppercase">Mr. {payslipEditForm.employeeName || activePayslipDetails.name}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Designation:</span>
                              <span>{payslipEditForm.designation || 'Accountant'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Date of Joining:</span>
                              <span>{payslipEditForm.dateOfJoining || '23/07/2026'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Pay Period:</span>
                              <span>{payslipEditForm.payPeriod || 'Monthly'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Pay Date:</span>
                              <span>{payslipEditForm.payDate || '06/10/2026'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">A/C Number:</span>
                              <span className="font-bold">{payslipEditForm.accountNumber || 'CASH IN HAND'}</span>
                            </div>
                            <div className="flex">
                              <span className="w-32 font-bold text-black">Mobile Number:</span>
                              <span>{payslipEditForm.mobileNumber || ''}</span>
                            </div>
                          </div>
                        </div>

                        {/* Right Box: Employee Net Pay */}
                        <div className="col-span-5 flex flex-col justify-between">
                          <div>
                            <div className="bg-[#d9d9d9] font-black px-2.5 py-1 border-b-2 border-black text-xs text-center uppercase tracking-tight">
                              Employee Net Pay
                            </div>
                            <div className="p-3.5 flex items-baseline justify-between">
                              <span className="text-xs font-black text-black">OMR</span>
                              <span className="text-2xl sm:text-3xl font-black text-black">
                                {liveNetPay.toFixed(3)}
                              </span>
                            </div>
                          </div>

                          <div className="border-t-2 border-black text-[10px] sm:text-[11px] font-bold p-1 text-center flex justify-around bg-white">
                            <span>Paid Days: {payslipEditForm.paidDays ?? 30}</span>
                            <span>| Leave Days: {payslipEditForm.leaveDays ? payslipEditForm.leaveDays : ''}</span>
                            <span>| Hours: {payslipEditForm.hoursWorked || '00:000'}</span>
                          </div>
                        </div>

                      </div>

                      {/* Main 5-Column Earnings vs Deductions Table (Exact column structure from Image 2) */}
                      <div className="border-2 border-black text-xs mb-3 overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-[#d9d9d9] border-b-2 border-black font-extrabold uppercase text-[11px]">
                              <th className="p-1.5 px-2 border-r-2 border-black w-[25%]">EARNINGS</th>
                              <th className="p-1.5 px-2 border-r-2 border-black text-right w-[15%]">AMOUNT</th>
                              <th className="p-1.5 px-2 border-r-2 border-black w-[35%]">DEDUCTIONS</th>
                              <th className="p-1.5 px-2 border-r-2 border-black text-right w-[13%]">AMOUNT</th>
                              <th className="p-1.5 px-2 text-right w-[12%]">Incentives /Over time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/40 font-semibold text-xs">
                            <tr>
                              <td className="p-1.5 px-2 border-r-2 border-black">Basic salary</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">OMR {liveBasicSalary.toFixed(3)}</td>
                              <td className="p-1.5 px-2 border-r-2 border-black">Advance salary</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveAdvanceSalary > 0 ? liveAdvanceSalary.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 text-right">OMR {liveOvertimeAmount > 0 ? liveOvertimeAmount.toFixed(3) : '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 px-2 border-r-2 border-black">Other Allowance</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">OMR {liveOtherAllowance > 0 ? liveOtherAllowance.toFixed(1) : '-'}</td>
                              <td className="p-1.5 px-2 border-r-2 border-black">Deduction not came & Sick leave</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveDeductionNotCame > 0 ? liveDeductionNotCame.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 text-right">OMR -</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 px-2 border-r-2 border-black">EARNINGS</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">OMR -</td>
                              <td className="p-1.5 px-2 border-r-2 border-black">Probation Period First Month</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveProbationFirstMonth > 0 ? liveProbationFirstMonth.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 text-right">OMR -</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 px-2 border-r-2 border-black">Transportation</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">OMR {liveTransportation > 0 ? liveTransportation.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 border-r-2 border-black">Deduction Annual leave</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveDeductionAnnualLeave > 0 ? liveDeductionAnnualLeave.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 text-right">OMR -</td>
                            </tr>
                            <tr className="border-t-2 border-black font-extrabold">
                              <td className="p-1.5 px-2 border-r-2 border-black">Gross Earnings</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-black">OMR {liveGrossEarnings.toFixed(3)}</td>
                              <td className="p-1.5 px-2 border-r-2 border-black">Total Deductions</td>
                              <td className="p-1.5 px-2 border-r-2 border-black text-right font-black">OMR {liveTotalDeductions > 0 ? liveTotalDeductions.toFixed(3) : '-'}</td>
                              <td className="p-1.5 px-2 text-right font-black">OMR {liveOvertimeAmount > 0 ? liveOvertimeAmount.toFixed(3) : '-'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* NETPAY Sub-Table (Exact match to Image 2) */}
                      <div className="border-2 border-black text-xs mb-3">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-[#d9d9d9] border-b-2 border-black font-extrabold uppercase text-[11px]">
                              <th className="p-1.5 px-2 w-[70%]">NETPAY</th>
                              <th className="p-1.5 px-2 text-right w-[30%]">AMOUNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/40 font-semibold text-xs">
                            <tr>
                              <td className="p-1.5 px-2">Gross Earnings</td>
                              <td className="p-1.5 px-2 text-right font-bold">OMR {liveGrossEarnings.toFixed(3)}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 px-2">Total Balance</td>
                              <td className="p-1.5 px-2 text-right font-bold">OMR {liveTotalBalance > 0 ? liveTotalBalance.toFixed(3) : '-'}</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 px-2">Total Incentive/Overtime</td>
                              <td className="p-1.5 px-2 text-right font-bold">OMR {liveOvertimeAmount > 0 ? liveOvertimeAmount.toFixed(3) : '-'}</td>
                            </tr>
                            <tr className="border-t-2 border-black font-extrabold">
                              <td className="p-1.5 px-2 font-black">Total Net Payable</td>
                              <td className="p-1.5 px-2 text-right font-black text-sm">OMR {liveNetPay.toFixed(3)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Acknowledgment Note */}
                      <div className="text-[11px] text-slate-800 my-2 flex items-center justify-between">
                        <span className="font-bold">Note:</span>
                        <span className="italic text-center flex-1">
                          I acknowledge that the salary amount mentioned above is correct and received
                        </span>
                      </div>
                    </div>

                    {/* Bottom Signature Blocks: 4 Columns with Authentic Ink Signatures and Stamp */}
                    <div className="border-t-2 border-black pt-4 mt-6">
                      <div className="grid grid-cols-4 gap-3 text-center items-end">
                        
                        {/* 1. Approved by */}
                        <div className="flex flex-col items-center">
                          <div className="h-16 flex items-end justify-center relative">
                            {/* Blue cursive signature path matching Hamid's signature */}
                            <svg className="w-28 h-14" viewBox="0 0 120 50">
                              <path d="M10 40 Q 25 5, 38 30 Q 48 45, 58 18 Q 72 32, 90 20 Q 105 10, 110 35" stroke="#0044cc" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M18 36 Q 60 30, 102 34" stroke="#0044cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="text-[10px] font-bold text-blue-900 mt-1">06.10.2026</div>
                          <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                            Approved by
                          </div>
                        </div>

                        {/* 2. Prepared by */}
                        <div className="flex flex-col items-center">
                          <div className="h-16 flex items-end justify-center relative">
                            {/* Blue cursive signature path */}
                            <svg className="w-28 h-14" viewBox="0 0 120 50">
                              <path d="M15 32 Q 35 5, 48 24 Q 62 8, 75 35 Q 90 15, 108 28" stroke="#0044cc" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M25 38 Q 65 28, 98 35" stroke="#0044cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="text-[10px] font-bold text-blue-900 mt-1">6.10.2026</div>
                          <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                            Prepared by
                          </div>
                        </div>

                        {/* 3. Authorized Signature + Authentic Osan Group SPC Stamp */}
                        <div className="flex flex-col items-center">
                          <div className="h-16 flex items-center justify-center relative">
                            {/* Blue Official Stamp Box */}
                            <div className="border-2 border-blue-900 text-blue-900 px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider rotate-[-4deg] bg-blue-50/20 text-center leading-tight shadow-xs">
                              <div className="border border-blue-900 px-1 py-0.5">
                                <div className="font-bold text-[10px] text-blue-900">مجموعة اوسان ش.ش.و</div>
                                <div className="font-extrabold text-[9px] text-blue-900 tracking-wider">OSAN GROUP SPC</div>
                                <div className="font-bold text-[8px] text-blue-800">C.R: 1245480 س.ت</div>
                              </div>
                            </div>
                            {/* Overlay blue ink signature stroke */}
                            <svg className="absolute -top-1 left-1 w-28 h-14 pointer-events-none rotate-[-6deg]" viewBox="0 0 110 45">
                              <path d="M8 30 Q 30 8, 52 25 Q 75 12, 102 20" stroke="#0044cc" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                              <path d="M22 35 L 90 30" stroke="#0044cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="text-[10px] font-bold text-blue-900 mt-1">6.10.2026</div>
                          <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                            Authorized Signature
                          </div>
                        </div>

                        {/* 4. Employee Signature */}
                        <div className="flex flex-col items-center">
                          <div className="h-16 flex items-end justify-center relative">
                            {/* Employee blue handwritten signature */}
                            <svg className="w-28 h-14" viewBox="0 0 120 50">
                              <path d="M12 30 Q 32 40, 48 16 Q 66 38, 85 12 Q 100 30, 112 24" stroke="#0044cc" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M25 35 L 95 32" stroke="#0044cc" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="text-[10px] font-bold text-blue-900 mt-1">06/10/2026</div>
                          <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                            Employee Signature
                          </div>
                        </div>

                      </div>
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
