import { useState, useEffect, useMemo } from 'react';
import { Download, Filter, FileSpreadsheet, Users, Lock, CheckCircle2, Wallet, Printer, Plus, History, X, Save, FileText, Check, Sparkles, Calendar, LayoutGrid, List } from 'lucide-react';
import {
  getEmployees,
  getPayrollTransactionsFromDb,
  savePayrollTransactionToDb,
  getEmployeePayslipOverrides,
  saveEmployeePayslipRecord,
  getAttendanceExceptionsFromDb
} from '../../lib/databaseService';
import { supabase } from '../../lib/supabase';
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
  const [ledgerViewMode, setLedgerViewMode] = useState<'table' | 'cards'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'cards' : 'table';
    }
    return 'table';
  });

  const [payslipOverrides, setPayslipOverrides] = useState<Record<string, any>>({});
  const [attendanceExceptions, setAttendanceExceptions] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(1.25);
  const [payslipEditForm, setPayslipEditForm] = useState<any>({});

  const loadData = async () => {
    try {
      const [emps, txMap, overrides, liveExceptions] = await Promise.all([
        getEmployees(),
        getPayrollTransactionsFromDb(selectedMonth, selectedYear),
        getEmployeePayslipOverrides(selectedMonth, selectedYear),
        getAttendanceExceptionsFromDb()
      ]);
      setEmployees(emps);
      setTransactions(txMap);
      setPayslipOverrides(overrides);
      setAttendanceExceptions(liveExceptions || []);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime for instant payroll & exception updates
    const channel = supabase
      .channel(`payroll-ledger-${selectedMonth}-${selectedYear}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => {
        loadData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
  const [mobilePayslipTab, setMobilePayslipTab] = useState<'edit' | 'preview'>('edit');

  // Generate dynamic ledger data based on real employees, real exceptions, and custom overrides
  const ledgerData = useMemo(() => {
    return employees.map(emp => {
      const override = payslipOverrides[emp.id] || {};
      const daysWorked = override.paid_days !== undefined ? Number(override.paid_days) : 22;

      // Real live attendance exceptions from database
      const employeeExceptions = attendanceExceptions.filter(exc => 
        (exc.employee && exc.employee.toLowerCase() === emp.name.toLowerCase()) || 
        exc.user_id === emp.id
      );
      const lateCount = employeeExceptions.filter(exc => (exc.type || '').includes('Late')).length;
      const unpaidLeave = employeeExceptions.filter(exc => (exc.type || '').includes('Absent')).length;

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
        exceptions: employeeExceptions,
        accountNumber: override.account_number || emp.account_number || 'CASH IN HAND',
        mobileNumber: override.mobile_number || emp.phone || ''
      };
    });
  }, [employees, transactions, payslipOverrides, attendanceExceptions]);

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

  const calculateAutoValues = (form: any, customMultiplier?: number) => {
    const basic = Number(form.basicSalary) || 0;
    const leave = Number(form.leaveDays) || 0;
    const hoursStr = form.hoursWorked || '00:000';
    const mult = customMultiplier ?? overtimeMultiplier;

    // Standard monthly base: 30 days in Oman labor law
    const dailyWage = basic > 0 ? basic / 30 : 0;
    // Standard monthly hours: 8 hrs/day * 30 days = 240 hrs
    const hourlyWage = basic > 0 ? basic / 240 : 0;

    // Leave deduction = leaveDays * dailyWage
    const autoLeaveDeduction = Number((leave * dailyWage).toFixed(3));
    const autoPaidDays = Math.max(0, 30 - leave);

    // Overtime hours calculation from hoursWorked
    let otHours = 0;
    if (typeof hoursStr === 'string' && hoursStr.includes(':')) {
      const parts = hoursStr.split(':');
      const h = parseFloat(parts[0]) || 0;
      const m = parseFloat(parts[1]) || 0;
      otHours = h + (m / 60);
    } else {
      otHours = parseFloat(String(hoursStr)) || 0;
    }
    const autoOvertimeAmount = Number((otHours * hourlyWage * mult).toFixed(3));

    return {
      autoLeaveDeduction,
      autoPaidDays,
      autoOvertimeAmount,
      dailyWage,
      hourlyWage,
      otHours
    };
  };

  const handleOpenPayslip = (row: any) => {
    setActivePayslipId(row.id);
    const existing = payslipOverrides[row.id] || {};
    const baseObj = {
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
      incentiveAmount: existing.incentive_amount !== undefined ? Number(existing.incentive_amount) : (existing.incentiveAmount !== undefined ? Number(existing.incentiveAmount) : 0),
      advanceSalary: existing.advance_salary !== undefined ? Number(existing.advance_salary) : (row.advanceSalary || 0),
      deductionNotCame: existing.deduction_not_came !== undefined ? Number(existing.deduction_not_came) : (row.deductionNotCame || 0),
      probationFirstMonth: existing.probation_first_month !== undefined ? Number(existing.probation_first_month) : (row.probationFirstMonth || 0),
      deductionAnnualLeave: existing.deduction_annual_leave !== undefined ? Number(existing.deduction_annual_leave) : (row.deductionAnnualLeave || 0),
      totalBalance: existing.total_balance !== undefined ? Number(existing.total_balance) : (row.balance || 0),
    };

    setPayslipEditForm(baseObj);
  };

  // Sync payslipEditForm whenever month or year changes while modal is open
  useEffect(() => {
    if (!activePayslipId) return;
    const empRow = ledgerData.find(e => e.id === activePayslipId);
    if (!empRow) return;
    const existing = payslipOverrides[activePayslipId] || {};
    setPayslipEditForm((prev: any) => ({
      ...prev,
      employeeName: existing.employee_name || empRow.name || prev.employeeName || '',
      designation: existing.designation || empRow.job_title || empRow.role || prev.designation || 'Accountant',
      dateOfJoining: existing.date_of_joining || (empRow.join_date ? new Date(empRow.join_date).toLocaleDateString('en-GB') : prev.dateOfJoining || '23/07/2026'),
      payPeriod: existing.pay_period || prev.payPeriod || 'Monthly',
      payDate: existing.pay_date || `06/${(MONTHS.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}/${selectedYear}`,
      accountNumber: existing.account_number || empRow.accountNumber || empRow.account_number || prev.accountNumber || 'CASH IN HAND',
      mobileNumber: existing.mobile_number || empRow.mobileNumber || empRow.phone || prev.mobileNumber || '',
      paidDays: existing.paid_days !== undefined ? Number(existing.paid_days) : (empRow.daysWorked || 30),
      leaveDays: existing.leave_days !== undefined ? Number(existing.leave_days) : (empRow.leaveDays || 0),
      hoursWorked: existing.hours_worked || empRow.hoursWorked || '00:000',
      basicSalary: existing.basic_salary !== undefined ? Number(existing.basic_salary) : (empRow.baseSalary || 120),
      otherAllowance: existing.other_allowance !== undefined ? Number(existing.other_allowance) : (empRow.otherAllowance || 70),
      transportation: existing.transportation !== undefined ? Number(existing.transportation) : (empRow.transportation || 0),
      overtimeAmount: existing.overtime_amount !== undefined ? Number(existing.overtime_amount) : (empRow.overtimeAmount || 0),
      incentiveAmount: existing.incentive_amount !== undefined ? Number(existing.incentive_amount) : (existing.incentiveAmount !== undefined ? Number(existing.incentiveAmount) : (prev.incentiveAmount || 0)),
      advanceSalary: existing.advance_salary !== undefined ? Number(existing.advance_salary) : (empRow.advanceSalary || 0),
      deductionNotCame: existing.deduction_not_came !== undefined ? Number(existing.deduction_not_came) : (empRow.deductionNotCame || 0),
      probationFirstMonth: existing.probation_first_month !== undefined ? Number(existing.probation_first_month) : (empRow.probationFirstMonth || 0),
      deductionAnnualLeave: existing.deduction_annual_leave !== undefined ? Number(existing.deduction_annual_leave) : (empRow.deductionAnnualLeave || 0),
      totalBalance: existing.total_balance !== undefined ? Number(existing.total_balance) : (empRow.balance || 0),
    }));
  }, [selectedMonth, selectedYear, payslipOverrides]);

  const autoCalculations = useMemo(() => {
    return calculateAutoValues(payslipEditForm, overtimeMultiplier);
  }, [payslipEditForm.basicSalary, payslipEditForm.leaveDays, payslipEditForm.hoursWorked, overtimeMultiplier]);

  const liveBasicSalary = Number(payslipEditForm.basicSalary) || 0;
  const liveOtherAllowance = Number(payslipEditForm.otherAllowance) || 0;
  const liveTransportation = Number(payslipEditForm.transportation) || 0;
  const liveOvertimeAmount = Number(payslipEditForm.overtimeAmount) || 0;
  const liveIncentiveAmount = Number(payslipEditForm.incentiveAmount) || 0;
  const liveAdvanceSalary = Number(payslipEditForm.advanceSalary) || 0;
  const liveDeductionNotCame = Number(payslipEditForm.deductionNotCame) || 0;
  const liveProbationFirstMonth = Number(payslipEditForm.probationFirstMonth) || 0;
  const liveDeductionAnnualLeave = Number(payslipEditForm.deductionAnnualLeave) || 0;
  const liveTotalBalance = Number(payslipEditForm.totalBalance) || 0;

  const liveGrossEarnings = liveBasicSalary + liveOtherAllowance + liveTransportation + liveIncentiveAmount;
  const liveTotalDeductions = liveAdvanceSalary + liveDeductionNotCame + liveProbationFirstMonth + liveDeductionAnnualLeave;
  const liveNetPay = Math.max(0, liveGrossEarnings + liveOvertimeAmount - liveTotalDeductions);
  const liveFinalPayout = liveNetPay + liveTotalBalance;

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
      incentiveAmount: liveIncentiveAmount,
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
        incentive_amount: liveIncentiveAmount,
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
      <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between animate-in fade-in zoom-in-95 duration-300 no-print">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 w-full xl:w-auto">
          <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
            <Filter className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="font-bold text-xs uppercase tracking-wider">Filters:</span>
          </div>

          <div className="flex gap-2">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-1 sm:flex-none bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 sm:px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              {MONTHS.map(m => <option key={m} value={m} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{m}</option>)}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="flex-1 sm:flex-none bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 sm:px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">2026</option>
              <option className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">2025</option>
            </select>
          </div>

          <div className="flex gap-2 flex-wrap">
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="flex-1 sm:flex-none bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 sm:px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary min-w-[130px]">
              {companiesList.map(c => <option key={c} value={c} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{c === 'All' ? 'All Companies' : c}</option>)}
            </select>
            <select value={selectedNationality} onChange={(e) => setSelectedNationality(e.target.value)} className="flex-1 sm:flex-none bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 sm:px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Nationalities</option>
              <option value="Omani" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Omani</option>
              <option value="Expat" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Expat</option>
            </select>
            <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className="flex-1 sm:flex-none bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 sm:px-4 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary">
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Genders</option>
              <option value="Male" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Male</option>
              <option value="Female" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Female</option>
            </select>
          </div>
        </div>

        <div className="flex w-full xl:w-auto items-center gap-2 sm:gap-3">
          <button onClick={() => setIsLocked(!isLocked)} className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl transition-colors font-bold text-xs border ${isLocked ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 hover:bg-amber-500/20' : 'bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-white border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
            <Lock className="w-4 h-4 shrink-0" />
            <span>{isLocked ? 'Payroll Locked' : 'Lock Payroll'}</span>
          </button>
          <button onClick={handleExportCSV} className="flex-1 xl:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-emerald-600 text-white px-4 sm:px-5 py-2.5 rounded-xl transition-colors font-bold text-xs shadow-lg shadow-primary/20">
            <Download className="w-4 h-4 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 no-print">
        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex items-center gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Filtered Employees</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{totalEmployees}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex items-center gap-4">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Fully Paid Employees</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{paidCount} <span className="text-sm text-slate-400 dark:text-gray-500 font-normal">/ {totalEmployees}</span></p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-amber-500/20 flex items-center gap-4 bg-amber-500/5 dark:bg-amber-500/10 shadow-sm dark:shadow-none">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Wallet className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-400/80 font-bold uppercase tracking-wider">Total Paid Out</p>
            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">OMR {totalPaidOut}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-primary/20 flex items-center gap-4 bg-primary/5 dark:bg-primary/10 shadow-sm dark:shadow-none">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs text-emerald-700 dark:text-primary/80 font-bold uppercase tracking-wider">Total Net Pay</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">OMR {totalNetPay}</p>
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 no-print">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Payroll Details</h2>
                {isLocked && (
                  <div className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-500 text-[10px] sm:text-xs font-bold flex items-center gap-1 border border-amber-500/20">
                    <Lock className="w-3 h-3" />
                    READ-ONLY
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-400 sm:hidden">
                {filteredData.length} records • OMR {totalNetPay}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* View Mode Toggle: Table vs Cards */}
            <div className="flex items-center bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-0.5 rounded-xl shadow-xs">
              <button
                onClick={() => setLedgerViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  ledgerViewMode === 'table'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setLedgerViewMode('cards')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  ledgerViewMode === 'cards'
                    ? 'bg-white dark:bg-slate-800 text-primary shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <button
              onClick={handleMarkAllPaid}
              disabled={isLocked || filteredData.length === 0}
              className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white px-3 sm:px-4 py-2 rounded-xl transition-colors font-bold border border-slate-200 dark:border-white/10 text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Mark All as Paid</span>
            </button>
          </div>
        </div>

        {ledgerViewMode === 'table' ? (
          <div>
            <div className="sm:hidden px-3.5 py-1.5 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] text-slate-500 dark:text-gray-400 flex items-center justify-between">
              <span>← Swipe table or switch to Cards view →</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px] text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 text-[11px] sm:text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-white/10">
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 pl-4 sm:pl-6 font-bold">Employee</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold">Demographics</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold">Days Worked</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold">Base & Deduct</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold text-emerald-600 dark:text-emerald-400">Net Pay</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold">Balance</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 font-bold">Status</th>
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 pr-4 sm:pr-6 font-bold text-right min-w-[95px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredData.length > 0 ? (
                    filteredData.map(row => (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 pl-4 sm:pl-6">
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{row.name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-gray-400">{row.company} • {row.role}</div>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.nationality === 'Omani' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'}`}>
                              {row.nationality}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">{row.gender}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                          {row.daysWorked} <span className="text-xs font-normal text-slate-500 dark:text-gray-500">days</span>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">OMR {row.baseSalary} <span className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">Base</span></span>
                            {row.totalDeductions > 0 && (
                              <span className="text-xs font-bold text-red-600 dark:text-red-400">-OMR {row.totalDeductions} <span className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">Deduct</span></span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 whitespace-nowrap">
                          <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">OMR {row.netPay}</span>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className={`font-bold text-xs ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-500'}`}>OMR {row.balance}</span>
                            {row.totalPaid > 0 && <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Paid: OMR {row.totalPaid}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 whitespace-nowrap">
                          <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 sm:py-1 rounded-full border ${row.status === 'Fully Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                            row.status === 'Partially Paid' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                            }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 pr-4 sm:pr-6 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { setActiveEmployeeId(row.id); setPayAmount(row.balance.toString()); }}
                              disabled={isLocked || row.balance <= 0}
                              className="p-1.5 sm:p-2 text-emerald-600 dark:text-emerald-400 hover:text-white hover:bg-emerald-500 rounded-lg transition-colors border border-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title="Log Payment"
                            >
                              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenPayslip(row)}
                              className="p-1.5 sm:p-2 text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-500 rounded-lg transition-colors border border-blue-500/20 cursor-pointer"
                              title="Preview & Edit Payslip"
                            >
                              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
        ) : (
          /* Cards View for Mobile & Tablet */
          <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4 bg-slate-50/50 dark:bg-transparent">
            {filteredData.length > 0 ? (
              filteredData.map(row => (
                <div
                  key={row.id}
                  className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/40 flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-primary transition-colors">
                        {row.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 truncate">
                        {row.company} • {row.role}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                      row.status === 'Fully Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' :
                      row.status === 'Partially Paid' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' :
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      {row.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${row.nationality === 'Omani' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'}`}>
                      {row.nationality}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-gray-400">{row.gender}</span>
                    <span className="ml-auto text-xs font-bold text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                      {row.daysWorked} days
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Base</div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">OMR {row.baseSalary}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Net Pay</div>
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 mt-0.5">OMR {row.netPay}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-500">Balance</div>
                      <div className={`text-xs font-bold mt-0.5 ${row.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-gray-500'}`}>
                        OMR {row.balance}
                      </div>
                    </div>
                  </div>

                  {row.totalDeductions > 0 && (
                    <div className="text-[10px] text-red-500 dark:text-red-400 font-semibold flex items-center justify-between px-1">
                      <span>Deductions applied:</span>
                      <span>-OMR {row.totalDeductions}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                    <button
                      onClick={() => { setActiveEmployeeId(row.id); setPayAmount(row.balance.toString()); }}
                      disabled={isLocked || row.balance <= 0}
                      className="flex-1 py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Pay</span>
                    </button>

                    <button
                      onClick={() => handleOpenPayslip(row)}
                      className="flex-1 py-1.5 px-3 bg-blue-500/10 hover:bg-blue-500 text-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Payslip</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center text-slate-500 dark:text-gray-500 font-bold bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5">
                No ledger records found for the selected filters.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Payment Modal */}
      {activeEmpDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 no-print">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-300 text-xs">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 truncate pr-2">
                <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Log Payment for {activeEmpDetails.name}</span>
              </h2>
              <button onClick={() => setActiveEmployeeId(null)} className="p-2 text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white rounded-lg transition-colors cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-1 font-bold">Net Pay</p>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">OMR {activeEmpDetails.netPay}</p>
                </div>
                <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                  <button onClick={handleLogPayment} className="w-full py-3 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-primary/20 cursor-pointer">
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

            {/* Mobile / Tablet Tab Switcher (Visible only on < lg screens) */}
            <div className="lg:hidden flex border-b border-slate-800 bg-[#0e172a] shrink-0 no-print">
              <button
                type="button"
                onClick={() => setMobilePayslipTab('edit')}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${mobilePayslipTab === 'edit'
                    ? 'border-rose-500 text-rose-400 bg-rose-500/10'
                    : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Edit Parameters</span>
              </button>
              <button
                type="button"
                onClick={() => setMobilePayslipTab('preview')}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${mobilePayslipTab === 'preview'
                    ? 'border-rose-500 text-rose-400 bg-rose-500/10'
                    : 'border-transparent text-slate-400 hover:text-white'
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Document Preview</span>
              </button>
            </div>

            {/* Split Screen Body: Left Parameters (Live Edit) + Right Document Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden min-h-0">

              {/* LEFT COLUMN: PAYSLIP PARAMETERS (Real-time Editable) */}
              <div className={`lg:col-span-4 xl:col-span-4 bg-[#0d1424] border-r border-slate-800 p-4 sm:p-5 overflow-y-auto max-h-[84vh] space-y-5 text-xs text-slate-300 no-print ${mobilePayslipTab === 'preview' ? 'hidden lg:block' : 'block'}`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-rose-500 font-extrabold text-xs tracking-wider uppercase">PAYSLIP PARAMETERS</span>
                  <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    ● Real-Time Sync
                  </span>
                </div>

                {/* PAYROLL MONTH & PERIOD SELECTOR */}
                <div className="p-3.5 bg-[#131d33] rounded-xl border border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wide">
                      <Calendar className="w-3.5 h-3.5 text-rose-400" />
                      Payslip Month & Year
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        const m = MONTHS[now.getMonth()];
                        const y = now.getFullYear().toString();
                        setSelectedMonth(m);
                        setSelectedYear(y);
                        setPayslipEditForm((prev: any) => ({
                          ...prev,
                          customMonthTitle: '',
                          payDate: `06/${(now.getMonth() + 1).toString().padStart(2, '0')}/${y}`
                        }));
                      }}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-md border border-rose-500/30 transition-all cursor-pointer flex items-center gap-1"
                      title="Automatically switch to current calendar month"
                    >
                      <Sparkles className="w-3 h-3 text-rose-400" />
                      Current Month
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Month</label>
                      <select
                        value={selectedMonth}
                        onChange={e => {
                          const newM = e.target.value;
                          setSelectedMonth(newM);
                          setPayslipEditForm((prev: any) => ({
                            ...prev,
                            customMonthTitle: '',
                            payDate: `06/${(MONTHS.indexOf(newM) + 1).toString().padStart(2, '0')}/${selectedYear}`
                          }));
                        }}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold text-xs outline-none focus:border-rose-500 cursor-pointer"
                      >
                        {MONTHS.map(m => (
                          <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Year</label>
                      <select
                        value={selectedYear}
                        onChange={e => {
                          const newY = e.target.value;
                          setSelectedYear(newY);
                          setPayslipEditForm((prev: any) => ({
                            ...prev,
                            customMonthTitle: '',
                            payDate: `06/${(MONTHS.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}/${newY}`
                          }));
                        }}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold text-xs outline-none focus:border-rose-500 cursor-pointer"
                      >
                        {['2024', '2025', '2026', '2027', '2028'].map(y => (
                          <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400">Header Display Override (Optional)</label>
                      {payslipEditForm.customMonthTitle && (
                        <button
                          type="button"
                          onClick={() => setPayslipEditForm({ ...payslipEditForm, customMonthTitle: '' })}
                          className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={`e.g. Payslip for the Month of ${selectedMonth.slice(0, 3).toUpperCase()} ${selectedYear}`}
                      value={payslipEditForm.customMonthTitle || ''}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, customMonthTitle: e.target.value })}
                      className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs outline-none focus:border-rose-500"
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                      <span>Header preview:</span>
                      <strong className="text-amber-400 uppercase">{payslipEditForm.customMonthTitle || `PAYSLIP FOR THE MONTH OF ${selectedMonth.slice(0, 3).toUpperCase()} ${selectedYear}`}</strong>
                    </div>
                  </div>
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
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Attendance Summary</div>
                    <span className="text-[10px] text-slate-500">Auto-Calculates & Custom Editable</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Paid Days</label>
                      </div>
                      <input
                        type="number"
                        value={payslipEditForm.paidDays ?? 30}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, paidDays: parseInt(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                      <span className="block text-[9px] text-slate-400 text-center mt-1">
                        Auto: {autoCalculations.autoPaidDays}d
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Leave Days</label>
                      </div>
                      <input
                        type="number"
                        value={payslipEditForm.leaveDays ?? 0}
                        onChange={e => {
                          const newLeave = parseInt(e.target.value) || 0;
                          const daily = liveBasicSalary > 0 ? liveBasicSalary / 30 : 0;
                          const calcLeaveDeduct = Number((newLeave * daily).toFixed(3));
                          setPayslipEditForm((prev: any) => ({
                            ...prev,
                            leaveDays: newLeave,
                            paidDays: Math.max(0, 30 - newLeave),
                            deductionNotCame: calcLeaveDeduct
                          }));
                        }}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2.5 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                      <span className="block text-[9px] text-red-400 text-center mt-1 font-semibold truncate" title={`Auto: OMR ${autoCalculations.autoLeaveDeduction.toFixed(3)}`}>
                        -OMR {autoCalculations.autoLeaveDeduction.toFixed(3)}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Hours (OT)</label>
                        <select
                          value={overtimeMultiplier}
                          onChange={e => {
                            const newMult = parseFloat(e.target.value);
                            setOvertimeMultiplier(newMult);
                            const hourly = liveBasicSalary > 0 ? liveBasicSalary / 240 : 0;
                            const otH = autoCalculations.otHours;
                            setPayslipEditForm((prev: any) => ({
                              ...prev,
                              overtimeAmount: Number((otH * hourly * newMult).toFixed(3))
                            }));
                          }}
                          className="bg-[#18263f] border border-slate-700 rounded px-1.5 py-0.5 text-[9px] text-emerald-400 font-bold outline-none cursor-pointer"
                          title="Overtime Rate Multiplier"
                        >
                          <option value={1.00}>1.0x Rate</option>
                          <option value={1.25}>1.25x OT</option>
                          <option value={1.50}>1.5x OT</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        value={payslipEditForm.hoursWorked || '00:000'}
                        placeholder="e.g. 10 or 10:00"
                        onChange={e => {
                          const newHours = e.target.value;
                          let otH = 0;
                          if (newHours.includes(':')) {
                            const parts = newHours.split(':');
                            otH = (parseFloat(parts[0]) || 0) + ((parseFloat(parts[1]) || 0) / 60);
                          } else {
                            otH = parseFloat(newHours) || 0;
                          }
                          const hourly = liveBasicSalary > 0 ? liveBasicSalary / 240 : 0;
                          const calcOT = Number((otH * hourly * overtimeMultiplier).toFixed(3));
                          setPayslipEditForm((prev: any) => ({
                            ...prev,
                            hoursWorked: newHours,
                            overtimeAmount: calcOT
                          }));
                        }}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-2 py-2 text-white font-bold outline-none focus:border-rose-500 text-center"
                      />
                      <span className="block text-[9px] text-emerald-400 text-center mt-1 font-semibold truncate" title={`Auto: OMR ${autoCalculations.autoOvertimeAmount.toFixed(3)}`}>
                        +OMR {autoCalculations.autoOvertimeAmount.toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* EARNINGS & INCENTIVES SECTION */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">Earnings & Incentives (OMR)</div>
                    <span className="text-[10px] text-slate-400">Directly Editable</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Basic Salary</label>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.basicSalary ?? 0}
                        onChange={e => {
                          const newBasic = parseFloat(e.target.value) || 0;
                          const daily = newBasic > 0 ? newBasic / 30 : 0;
                          const hourly = newBasic > 0 ? newBasic / 240 : 0;
                          const leaveD = Number(((payslipEditForm.leaveDays || 0) * daily).toFixed(3));
                          const otA = Number((autoCalculations.otHours * hourly * overtimeMultiplier).toFixed(3));
                          setPayslipEditForm((prev: any) => ({
                            ...prev,
                            basicSalary: newBasic,
                            deductionNotCame: leaveD,
                            overtimeAmount: otA
                          }));
                        }}
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

                    {/* OVERTIME AMOUNT (EDITABLE + AUTO FILL) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Overtime Amount</label>
                        <button
                          type="button"
                          onClick={() => setPayslipEditForm((prev: any) => ({ ...prev, overtimeAmount: autoCalculations.autoOvertimeAmount }))}
                          className="text-[9px] text-emerald-400 hover:text-emerald-300 font-semibold underline cursor-pointer"
                          title="Apply auto-calculated overtime amount"
                        >
                          Auto: {autoCalculations.autoOvertimeAmount.toFixed(3)}
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.overtimeAmount ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, overtimeAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-rose-500"
                      />
                      {payslipEditForm.overtimeAmount !== undefined && Number(payslipEditForm.overtimeAmount) !== autoCalculations.autoOvertimeAmount && (
                        <span className="block text-[9px] text-amber-400 mt-0.5">✏️ Custom Overtime Value</span>
                      )}
                    </div>
                  </div>

                  {/* INCENTIVES & BONUS INPUT (NEW CUSTOM FIELD) */}
                  {/* INCENTIVES & BONUS / SPECIAL ALLOWANCE INPUT */}
                  <div className="bg-[#142038] p-3 rounded-xl border border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold uppercase text-emerald-300">Incentives / Allowance (OMR)</label>
                      <span className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        Row 3 of Earnings
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="e.g. 15.000 or 50.000"
                      value={payslipEditForm.incentiveAmount ?? 0}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, incentiveAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#192845] border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-300 font-extrabold outline-none focus:border-emerald-400"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-300 pt-0.5">
                      <span>Added to Earnings (Row 3):</span>
                      <strong className="text-white font-mono">OMR {liveIncentiveAmount.toFixed(3)}</strong>
                    </div>
                  </div>
                </div>

                {/* DEDUCTIONS SECTION */}
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold text-red-400 uppercase tracking-wide">Deductions (OMR)</div>
                    <span className="text-[10px] text-slate-400">Directly Editable</span>
                  </div>

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

                    {/* NOT CAME & SICK LEAVE DEDUCTION (EDITABLE + AUTO FILL) */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-bold uppercase text-slate-400">Not Came & Sick</label>
                        <button
                          type="button"
                          onClick={() => setPayslipEditForm((prev: any) => ({ ...prev, deductionNotCame: autoCalculations.autoLeaveDeduction }))}
                          className="text-[9px] text-red-400 hover:text-red-300 font-semibold underline cursor-pointer"
                          title="Apply auto-calculated leave deduction"
                        >
                          Auto: {autoCalculations.autoLeaveDeduction.toFixed(3)}
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        value={payslipEditForm.deductionNotCame ?? 0}
                        onChange={e => setPayslipEditForm({ ...payslipEditForm, deductionNotCame: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-red-400 font-bold outline-none focus:border-rose-500"
                      />
                      {payslipEditForm.deductionNotCame !== undefined && Number(payslipEditForm.deductionNotCame) !== autoCalculations.autoLeaveDeduction && (
                        <span className="block text-[9px] text-amber-400 mt-0.5">✏️ Custom Deduction Value</span>
                      )}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400">Past Carryover / Prior Dues (Optional)</label>
                      {Number(payslipEditForm.totalBalance) !== 0 && (
                        <button
                          type="button"
                          onClick={() => setPayslipEditForm((prev: any) => ({ ...prev, totalBalance: 0 }))}
                          className="text-[9px] text-slate-400 hover:text-white underline cursor-pointer"
                        >
                          Clear (0.000)
                        </button>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.001"
                      placeholder="0.000"
                      value={payslipEditForm.totalBalance ?? 0}
                      onChange={e => setPayslipEditForm({ ...payslipEditForm, totalBalance: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#162035] border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-bold outline-none focus:border-rose-500"
                    />
                    <span className="block text-[9px] text-slate-400 mt-1">
                      Added directly to final take-home payout ({liveNetPay.toFixed(3)} + {liveTotalBalance.toFixed(3)} = {liveFinalPayout.toFixed(3)} OMR).
                    </span>
                  </div>
                </div>

                {/* SAVE ACTION BUTTON */}
                <div className="pt-2">
                  <button
                    onClick={handleSavePayslipRecord}
                    disabled={saveStatus === 'saving'}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${saveStatus === 'saved'
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
              <div className={`lg:col-span-8 xl:col-span-8 bg-slate-200 dark:bg-slate-900/90 p-2 sm:p-6 overflow-y-auto max-h-[84vh] flex justify-center items-start ${mobilePayslipTab === 'edit' ? 'hidden lg:flex' : 'flex'}`}>

                {/* Horizontal scroll wrapper for printable paper on small mobile viewports */}
                <div className="w-full flex justify-center overflow-x-auto pb-4">
                  {/* The Paper Sheet */}
                  <div id="printable-payslip" className="bg-white text-black p-3 sm:p-8 shadow-2xl rounded-sm w-full max-w-[820px] min-w-[320px] border border-slate-400 select-text font-sans shrink-0">

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
                            {payslipEditForm.customMonthTitle || `Payslip for the Month of ${selectedMonth.slice(0, 3).toUpperCase()} ${selectedYear}`}
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
                                  {liveFinalPayout.toFixed(3)}
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

                        {/* Main 5-Column Earnings vs Deductions Table */}
                        <div className="border-2 border-black text-xs mb-3 overflow-x-auto">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-[#d9d9d9] border-b-2 border-black font-extrabold uppercase text-[11px]">
                                <th className="p-1.5 px-2 border-r-2 border-black w-[24%]">EARNINGS</th>
                                <th className="p-1.5 px-2 border-r-2 border-black text-right w-[14%]">AMOUNT</th>
                                <th className="p-1.5 px-2 border-r-2 border-black w-[34%]">DEDUCTIONS</th>
                                <th className="p-1.5 px-2 border-r-2 border-black text-right w-[14%]">AMOUNT</th>
                                <th className="p-1.5 px-2 text-right w-[14%] border-l-[2.5px] border-black bg-[#cfcfcf]">
                                  Overtime Pay
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/40 font-semibold text-xs">
                              <tr>
                                <td className="p-1.5 px-2 border-r-2 border-black">Basic salary</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">OMR {liveBasicSalary.toFixed(3)}</td>
                                <td className="p-1.5 px-2 border-r-2 border-black">Advance salary</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveAdvanceSalary > 0 ? liveAdvanceSalary.toFixed(3) : '-'}</td>
                                <td className="p-1.5 px-2 text-right border-l-[2.5px] border-black font-bold">
                                  {liveOvertimeAmount > 0 ? `OMR ${liveOvertimeAmount.toFixed(3)}` : 'OMR -'}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-1.5 px-2 border-r-2 border-black">Other Allowance</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">
                                  {liveOtherAllowance > 0 ? `OMR ${liveOtherAllowance.toFixed(3)}` : 'OMR -'}
                                </td>
                                <td className="p-1.5 px-2 border-r-2 border-black">Deduction not came & Sick leave</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveDeductionNotCame > 0 ? liveDeductionNotCame.toFixed(3) : '-'}</td>
                                <td className="p-1.5 px-2 text-right border-l-[2.5px] border-black">OMR -</td>
                              </tr>
                              <tr>
                                <td className="p-1.5 px-2 border-r-2 border-black">Incentives / Allowance</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">
                                  {liveIncentiveAmount > 0 ? `OMR ${liveIncentiveAmount.toFixed(3)}` : 'OMR -'}
                                </td>
                                <td className="p-1.5 px-2 border-r-2 border-black">Probation Period First Month</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveProbationFirstMonth > 0 ? liveProbationFirstMonth.toFixed(3) : '-'}</td>
                                <td className="p-1.5 px-2 text-right border-l-[2.5px] border-black">OMR -</td>
                              </tr>
                              <tr>
                                <td className="p-1.5 px-2 border-r-2 border-black">Transportation</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-bold">
                                  {liveTransportation > 0 ? `OMR ${liveTransportation.toFixed(3)}` : 'OMR -'}
                                </td>
                                <td className="p-1.5 px-2 border-r-2 border-black">Deduction Annual leave</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right">OMR {liveDeductionAnnualLeave > 0 ? liveDeductionAnnualLeave.toFixed(3) : '-'}</td>
                                <td className="p-1.5 px-2 text-right border-l-[2.5px] border-black">OMR -</td>
                              </tr>
                              <tr className="border-t-2 border-black font-extrabold bg-[#f7f7f7]">
                                <td className="p-1.5 px-2 border-r-2 border-black">Gross Earnings</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-black">OMR {liveGrossEarnings.toFixed(3)}</td>
                                <td className="p-1.5 px-2 border-r-2 border-black">Total Deductions</td>
                                <td className="p-1.5 px-2 border-r-2 border-black text-right font-black">
                                  {liveTotalDeductions > 0 ? `OMR ${liveTotalDeductions.toFixed(3)}` : 'OMR -'}
                                </td>
                                <td className="p-1.5 px-2 text-right font-black border-l-[2.5px] border-black bg-slate-100">
                                  {liveOvertimeAmount > 0 ? `OMR ${liveOvertimeAmount.toFixed(3)}` : 'OMR -'}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* NETPAY Summary Table - Reconciled & Auditable */}
                        <div className="border-2 border-black text-xs mb-3">
                          <table className="w-full border-collapse text-left">
                            <thead>
                              <tr className="bg-[#d9d9d9] border-b-2 border-black font-extrabold uppercase text-[11px]">
                                <th className="p-1.5 px-2 w-[70%]">NETPAY SUMMARY</th>
                                <th className="p-1.5 px-2 text-right w-[30%]">AMOUNT</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/40 font-semibold text-xs">
                              <tr>
                                <td className="p-1.5 px-2">Gross Monthly Earnings</td>
                                <td className="p-1.5 px-2 text-right font-bold">OMR {liveGrossEarnings.toFixed(3)}</td>
                              </tr>
                              <tr>
                                <td className="p-1.5 px-2">Total Deductions (Leaves / Absences)</td>
                                <td className="p-1.5 px-2 text-right font-bold text-red-600">
                                  {liveTotalDeductions > 0 ? `-OMR ${liveTotalDeductions.toFixed(3)}` : 'OMR 0.000'}
                                </td>
                              </tr>
                              <tr>
                                <td className="p-1.5 px-2">Overtime Pay</td>
                                <td className="p-1.5 px-2 text-right font-bold text-emerald-700">
                                  {liveOvertimeAmount > 0 ? `+OMR ${liveOvertimeAmount.toFixed(3)}` : 'OMR 0.000'}
                                </td>
                              </tr>
                              {liveTotalBalance !== 0 && (
                                <tr className="bg-amber-50/70 border-t border-amber-200">
                                  <td className="p-1.5 px-2 text-amber-900 font-bold">
                                    {liveTotalBalance > 0 ? 'Past Carryover / Prior Dues' : 'Past Balance Adjustment'}
                                  </td>
                                  <td className="p-1.5 px-2 text-right font-bold text-amber-900">
                                    {liveTotalBalance > 0 ? `+OMR ${liveTotalBalance.toFixed(3)}` : `-OMR ${Math.abs(liveTotalBalance).toFixed(3)}`}
                                  </td>
                                </tr>
                              )}
                              <tr className="border-t-2 border-black font-extrabold bg-[#f2f2f2]">
                                <td className="p-1.5 px-2 font-black text-black uppercase">Total Net Payable (Take Home)</td>
                                <td className="p-1.5 px-2 text-right font-black text-sm text-black">OMR {liveFinalPayout.toFixed(3)}</td>
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

                      {/* Bottom Signature Blocks: 4 Columns with Clean Blank Space for Manual Signatures and Stamp */}
                      <div className="border-t-2 border-black pt-4 mt-6">
                        <div className="grid grid-cols-4 gap-3 text-center items-end">

                          {/* 1. Approved by */}
                          <div className="flex flex-col items-center">
                            <div className="h-16 w-full flex items-center justify-center">
                              {/* Blank space for manual signing */}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 mt-1">{payslipEditForm.payDate || '06.10.2026'}</div>
                            <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                              Approved by
                            </div>
                          </div>

                          {/* 2. Prepared by */}
                          <div className="flex flex-col items-center">
                            <div className="h-16 w-full flex items-center justify-center">
                              {/* Blank space for manual signing */}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 mt-1">{payslipEditForm.payDate || '6.10.2026'}</div>
                            <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                              Prepared by
                            </div>
                          </div>

                          {/* 3. Authorized Signature */}
                          <div className="flex flex-col items-center">
                            <div className="h-16 w-full flex items-center justify-center">
                              {/* Blank space for manual company stamp and signature */}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 mt-1">{payslipEditForm.payDate || '6.10.2026'}</div>
                            <div className="border-t-2 border-black w-full pt-1 text-xs font-bold uppercase mt-1">
                              Authorized Signature
                            </div>
                          </div>

                          {/* 4. Employee Signature */}
                          <div className="flex flex-col items-center">
                            <div className="h-16 w-full flex items-center justify-center">
                              {/* Blank space for employee manual signature */}
                            </div>
                            <div className="text-[10px] font-bold text-slate-700 mt-1">{payslipEditForm.payDate || '06/10/2026'}</div>
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
        </div>
      )}

    </div>
  );
}
