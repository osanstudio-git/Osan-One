import { useState, useEffect } from 'react';
import { LayoutGrid, List, CheckCircle2, XCircle, Clock, Search, Calendar, Plus, Trash2, Globe, Check, X, FileText, MessageSquare, UserCheck, UploadCloud } from 'lucide-react';
import { getLeaveRequestsFromDb, updateLeaveRequestStatusInDb, recordEmployeeLeaveByHrInDb, attachMedicalReportToLeaveInDb } from '../../lib/databaseService';
import { getPublicHolidays, syncPublicHolidaysFromDb, addPublicHoliday, deletePublicHoliday, type PublicHoliday } from '../../lib/holidayService';
import { getLeaveApprovalWhatsAppUrl, getLeaveRejectionWhatsAppUrl } from '../../lib/whatsappService';
import { supabase } from '../../lib/supabase';

export function HrLeaves() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'requests' | 'holidays'>('requests');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'grid' : 'list';
    }
    return 'grid';
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Record Leave on Behalf of Employee State
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [isSubmittingRecord, setIsSubmittingRecord] = useState(false);
  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [recordForm, setRecordForm] = useState({
    userId: '',
    leaveType: 'Yearly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    status: 'Approved' as 'Approved' | 'Pending',
    notes: ''
  });

  // Action Notice Modal State (WhatsApp instant prompt)
  const [actionModalNotice, setActionModalNotice] = useState<{
    leave: any;
    action: 'Approved' | 'Rejected';
  } | null>(null);

  // Holidays state
  const [holidays, setHolidays] = useState<PublicHoliday[]>(() => getPublicHolidays());
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

  // Holiday Date & Month Formatter Helpers
  const formatHolidayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const date = new Date(y, m, d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getHolidayMonthName = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 2) return '';
    const mIndex = parseInt(parts[1], 10) - 1;
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return MONTHS[mIndex] || '';
  };

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
    
    // Sync public holidays from live database in real time
    syncPublicHolidaysFromDb().then(data => {
      if (data && data.length > 0) setHolidays(data);
    });

    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, name, email, phone, role, job_title, department, gender, religion')
        .order('name');
      if (data) setEmployeesList(data);
    };
    fetchEmployees();

    // Subscribe to live leave requests via Supabase Realtime
    const leaveChannel = supabase
      .channel('hr-leaves-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
        loadLeaves();
      })
      .subscribe();

    // Subscribe to live public holidays via Supabase Realtime
    const holidayChannel = supabase
      .channel('hr-public-holidays-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_holidays' }, async () => {
        const live = await syncPublicHolidaysFromDb();
        setHolidays(live);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leaveChannel);
      supabase.removeChannel(holidayChannel);
    };
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) return;
    await addPublicHoliday(holidayForm);
    const live = await syncPublicHolidaysFromDb();
    setHolidays(live);
    setIsHolidayModalOpen(false);
    setHolidayForm({
      name: '',
      date: new Date().toISOString().split('T')[0],
      daysCount: 1,
      type: 'National',
      notes: ''
    });
  };

  const handleDeleteHoliday = async (id: string) => {
    await deletePublicHoliday(id);
    const live = await syncPublicHolidaysFromDb();
    setHolidays(live);
  };

  const handleAction = async (id: string, status: 'Approved' | 'Rejected') => {
    const targetLeave = leaves.find(l => l.id === id);
    // Optimistic UI update: instantly update status on screen
    setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    try {
      await updateLeaveRequestStatusInDb(id, status);
      await loadLeaves();
      if (targetLeave) {
        setActionModalNotice({
          leave: { ...targetLeave, status },
          action: status
        });
      }
    } catch (err) {
      console.error('Failed to update leave status:', err);
      await loadLeaves();
    }
  };

  const handleUploadMedicalForLeave = async (leaveId: string, file: File) => {
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const success = await attachMedicalReportToLeaveInDb(leaveId, base64);
        if (success) {
          await loadLeaves();
        } else {
          alert('Failed to attach medical report. Please try again.');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error uploading medical doc:', err);
      alert('Error uploading document.');
    }
  };

  const handleRecordLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordForm.userId || !recordForm.startDate || !recordForm.endDate) {
      alert('Please select an employee and valid start/end dates.');
      return;
    }
    setIsSubmittingRecord(true);
    try {
      let docUrl: string | undefined = undefined;
      if (recordFile) {
        docUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(recordFile);
        });
      }

      const res = await recordEmployeeLeaveByHrInDb({
        userId: recordForm.userId,
        leaveType: recordForm.leaveType,
        startDate: recordForm.startDate,
        endDate: recordForm.endDate,
        status: recordForm.status,
        notes: recordForm.notes,
        documentUrl: docUrl
      });
      if (res.success) {
        setIsRecordModalOpen(false);
        setRecordFile(null);
        setRecordForm({
          userId: '',
          leaveType: 'Yearly',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          status: 'Approved',
          notes: ''
        });
        await loadLeaves();
        alert('Employee leave recorded successfully in database and balance adjusted!');
      } else {
        alert(res.error || 'Failed to record leave.');
      }
    } catch (err: any) {
      alert('Error recording leave: ' + err?.message);
    } finally {
      setIsSubmittingRecord(false);
    }
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
      <div className="w-full sm:w-fit p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10 grid grid-cols-2 sm:flex sm:items-center gap-1">
        <button
          onClick={() => setActiveSection('requests')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSection === 'requests'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">Leave Requests</span>
        </button>
        <button
          onClick={() => setActiveSection('holidays')}
          className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeSection === 'holidays'
              ? 'bg-primary text-white shadow-sm'
              : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4 shrink-0" />
          <span className="truncate">Holidays ({holidays.length})</span>
        </button>
      </div>

      {activeSection === 'requests' && (
        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-white/5 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm">
            <div className="flex items-start justify-between gap-2 w-full sm:w-auto">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#1D70B8] shrink-0" />
                  Workforce Leave Applications
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium mt-0.5">
                  Review and approve employee leave requests across branches.
                </p>
              </div>

              {/* Mobile view switcher in top-right */}
              <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsRecordModalOpen(true)}
                  className="p-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  title="Record Employee Leave"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-xl border border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-gray-400'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:text-gray-400'
                    }`}
                    title="List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Action & View Switcher */}
            <div className="hidden sm:flex items-center gap-2.5">
              <button
                onClick={() => setIsRecordModalOpen(true)}
                className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Record Employee Leave</span>
              </button>

              <div className="flex items-center bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-white/10 text-[#1D70B8] shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                  <span>List</span>
                </button>
              </div>
            </div>
          </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Status Filter Tabs */}
        <div className="w-full sm:w-auto grid grid-cols-4 sm:flex sm:items-center gap-1 sm:gap-2 p-1 sm:p-0 bg-slate-100 dark:bg-white/5 sm:bg-transparent sm:dark:bg-transparent rounded-2xl border border-slate-200 dark:border-white/10 sm:border-0">
          <button
            onClick={() => setStatusFilter('Pending')}
            className={`py-2 px-1 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              statusFilter === 'Pending'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white sm:bg-white sm:dark:bg-white/5 sm:border sm:border-slate-200 sm:dark:border-white/10'
            }`}
          >
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden xs:inline">Pending</span>
            <span className="opacity-90">({pendingCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('Approved')}
            className={`py-2 px-1 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              statusFilter === 'Approved'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white sm:bg-white sm:dark:bg-white/5 sm:border sm:border-slate-200 sm:dark:border-white/10'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden xs:inline">Approved</span>
            <span className="opacity-90">({approvedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('Rejected')}
            className={`py-2 px-1 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              statusFilter === 'Rejected'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white sm:bg-white sm:dark:bg-white/5 sm:border sm:border-slate-200 sm:dark:border-white/10'
            }`}
          >
            <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
            <span className="hidden xs:inline">Rejected</span>
            <span className="opacity-90">({rejectedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('all')}
            className={`py-2 px-1 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#1D70B8] text-white shadow-sm'
                : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white sm:bg-white sm:dark:bg-white/5 sm:border sm:border-slate-200 sm:dark:border-white/10'
            }`}
          >
            <span>All</span>
            <span className="opacity-90">({leaves.length})</span>
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

                {leave.documentUrl ? (
                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewDoc(leave.documentUrl)}
                      className="flex-1 py-2 px-3 bg-blue-50/80 hover:bg-blue-100 dark:bg-white/5 dark:hover:bg-white/10 text-[#1D70B8] dark:text-blue-400 rounded-xl text-xs font-bold border border-blue-200/60 dark:border-white/10 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" /> View Attached Document
                    </button>
                    <label className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-colors" title="Replace / Update document">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadMedicalForLeave(leave.id, f);
                        }}
                      />
                    </label>
                  </div>
                ) : ((leave.type || '').toLowerCase().includes('sick') || (leave.type || '').toLowerCase().includes('maternity')) ? (
                  <label className="mt-3 w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold border border-amber-500/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs" title="Upload official doctor or hospital certificate">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>+ Upload Medical Certificate</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadMedicalForLeave(leave.id, f);
                      }}
                    />
                  </label>
                ) : null}

                {leave.notes && (
                  <div className="mt-2.5 p-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 text-[11px] text-slate-600 dark:text-gray-300">
                    <span className="font-bold text-slate-700 dark:text-gray-200">Reason / Notes:</span> {leave.notes}
                  </div>
                )}
              </div>

              {/* Status or Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5">
                {leave.status === 'Approved' ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="py-1 px-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4" /> Approved
                    </span>

                    {/* WhatsApp Notice pill (EN | AR) */}
                    <div className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-0.5 text-[11px] shadow-2xs">
                      <div className="px-1.5 py-0.5 flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Notice:</span>
                      </div>
                      <a
                        href={getLeaveApprovalWhatsAppUrl({
                          employeeName: leave.employee,
                          phone: leave.phone,
                          leaveType: leave.type,
                          startDate: leave.start,
                          endDate: leave.end,
                          totalDays: leave.durationDays,
                          language: 'en'
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md font-black uppercase text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={`Send English Approval Message to ${leave.employee}`}
                      >
                        EN
                      </a>
                      <span className="opacity-30 text-[10px] select-none">|</span>
                      <a
                        href={getLeaveApprovalWhatsAppUrl({
                          employeeName: leave.employee,
                          phone: leave.phone,
                          leaveType: leave.type,
                          startDate: leave.start,
                          endDate: leave.end,
                          totalDays: leave.durationDays,
                          language: 'ar'
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md font-black text-emerald-600 dark:text-emerald-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={`إرسال رسالة الموافقة بالعربية إلى ${leave.employee}`}
                      >
                        AR
                      </a>
                    </div>
                  </div>
                ) : leave.status === 'Rejected' ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="py-1 px-3 bg-red-500/10 text-red-600 dark:text-red-400 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-red-500/20">
                      <XCircle className="w-4 h-4" /> Rejected
                    </span>

                    {/* WhatsApp Notice pill (EN | AR) */}
                    <div className="inline-flex items-center rounded-lg border border-red-500/30 bg-red-500/10 p-0.5 text-[11px] shadow-2xs">
                      <div className="px-1.5 py-0.5 flex items-center gap-1 font-bold text-red-700 dark:text-red-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Notice:</span>
                      </div>
                      <a
                        href={getLeaveRejectionWhatsAppUrl({
                          employeeName: leave.employee,
                          phone: leave.phone,
                          leaveType: leave.type,
                          startDate: leave.start,
                          endDate: leave.end,
                          language: 'en'
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md font-black uppercase text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={`Send English Rejection Message to ${leave.employee}`}
                      >
                        EN
                      </a>
                      <span className="opacity-30 text-[10px] select-none">|</span>
                      <a
                        href={getLeaveRejectionWhatsAppUrl({
                          employeeName: leave.employee,
                          phone: leave.phone,
                          leaveType: leave.type,
                          startDate: leave.start,
                          endDate: leave.end,
                          language: 'ar'
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md font-black text-red-600 dark:text-red-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                        title={`إرسال رسالة الرفض بالعربية إلى ${leave.employee}`}
                      >
                        AR
                      </a>
                    </div>
                  </div>
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
                  <th className="p-4">Document</th>
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
                      {leave.documentUrl ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewDoc(leave.documentUrl)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-white/10 dark:hover:bg-white/20 text-[#1D70B8] dark:text-blue-400 rounded-lg text-[11px] font-bold border border-blue-200/60 dark:border-white/10 flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <FileText className="w-3 h-3" /> View Doc
                          </button>
                          <label className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors" title="Replace / Update document">
                            <UploadCloud className="w-3 h-3" />
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadMedicalForLeave(leave.id, f);
                              }}
                            />
                          </label>
                        </div>
                      ) : ((leave.type || '').toLowerCase().includes('sick') || (leave.type || '').toLowerCase().includes('maternity')) ? (
                        <label className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-[11px] font-bold border border-amber-500/30 inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs" title="Upload official medical certificate">
                          <UploadCloud className="w-3 h-3" />
                          <span>+ Attach Cert</span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,.pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadMedicalForLeave(leave.id, f);
                            }}
                          />
                        </label>
                      ) : (
                        <span className="text-slate-400 dark:text-gray-500 text-[11px] italic">None</span>
                      )}
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
                      {leave.status === 'Approved' ? (
                        <div className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-0.5 text-[11px] shadow-2xs">
                          <div className="px-1.5 py-0.5 flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Notice:</span>
                          </div>
                          <a
                            href={getLeaveApprovalWhatsAppUrl({
                              employeeName: leave.employee,
                              phone: leave.phone,
                              leaveType: leave.type,
                              startDate: leave.start,
                              endDate: leave.end,
                              totalDays: leave.durationDays,
                              language: 'en'
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md font-black uppercase text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            title={`Send English Approval Message to ${leave.employee}`}
                          >
                            EN
                          </a>
                          <span className="opacity-30 text-[10px] select-none">|</span>
                          <a
                            href={getLeaveApprovalWhatsAppUrl({
                              employeeName: leave.employee,
                              phone: leave.phone,
                              leaveType: leave.type,
                              startDate: leave.start,
                              endDate: leave.end,
                              totalDays: leave.durationDays,
                              language: 'ar'
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md font-black text-emerald-600 dark:text-emerald-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            title={`إرسال رسالة الموافقة بالعربية إلى ${leave.employee}`}
                          >
                            AR
                          </a>
                        </div>
                      ) : leave.status === 'Rejected' ? (
                        <div className="inline-flex items-center rounded-lg border border-red-500/30 bg-red-500/10 p-0.5 text-[11px] shadow-2xs">
                          <div className="px-1.5 py-0.5 flex items-center gap-1 font-bold text-red-700 dark:text-red-400">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Notice:</span>
                          </div>
                          <a
                            href={getLeaveRejectionWhatsAppUrl({
                              employeeName: leave.employee,
                              phone: leave.phone,
                              leaveType: leave.type,
                              startDate: leave.start,
                              endDate: leave.end,
                              language: 'en'
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md font-black uppercase text-slate-700 dark:text-slate-200 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            title={`Send English Rejection Message to ${leave.employee}`}
                          >
                            EN
                          </a>
                          <span className="opacity-30 text-[10px] select-none">|</span>
                          <a
                            href={getLeaveRejectionWhatsAppUrl({
                              employeeName: leave.employee,
                              phone: leave.phone,
                              leaveType: leave.type,
                              startDate: leave.start,
                              endDate: leave.end,
                              language: 'ar'
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded-md font-black text-red-600 dark:text-red-400 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            title={`إرسال رسالة الرفض بالعربية إلى ${leave.employee}`}
                          >
                            AR
                          </a>
                        </div>
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
                          <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {formatHolidayDate(h.date)}
                              </span>
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                {getHolidayMonthName(h.date)}
                              </span>
                            </div>
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
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20 shadow-2xs">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>{formatHolidayDate(h.date)}</span>
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 bg-emerald-600/15 rounded">
                              {getHolidayMonthName(h.date)}
                            </span>
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

      {/* Attached Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Document Attachment Preview</span>
              </h3>
              <button onClick={() => setPreviewDoc(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-black/30">
              {previewDoc.startsWith('data:image') || previewDoc.match(/\.(png|jpe?g|webp)$/i) ? (
                <img src={previewDoc} alt="Attachment" className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-sm" />
              ) : (
                <iframe src={previewDoc} className="w-full h-[60vh] rounded-xl border-0" title="Attached Document" />
              )}
            </div>
            <div className="p-3 border-t border-slate-100 dark:border-white/5 flex justify-end gap-2 bg-slate-50 dark:bg-white/5">
              <a
                href={previewDoc}
                download="leave_attachment"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#1D70B8] hover:bg-[#155994] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs"
              >
                Download / Open Full
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ACTION NOTICE (WHATSAPP MODAL PROMPT UPON APPROVE / REJECT) */}
      {actionModalNotice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  actionModalNotice.action === 'Approved' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'
                }`}>
                  {actionModalNotice.action === 'Approved' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {actionModalNotice.action === 'Approved' ? 'Leave Request Approved' : 'Leave Request Rejected'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400">
                    {actionModalNotice.leave.employee} • {actionModalNotice.leave.start} to {actionModalNotice.leave.end}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActionModalNotice(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-gray-300">
              Send the official {actionModalNotice.action === 'Approved' ? 'Approval' : 'Rejection'} letter to <strong>{actionModalNotice.leave.employee}</strong> on WhatsApp now?
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={actionModalNotice.action === 'Approved'
                  ? getLeaveApprovalWhatsAppUrl({
                      employeeName: actionModalNotice.leave.employee,
                      phone: actionModalNotice.leave.phone,
                      leaveType: actionModalNotice.leave.type,
                      startDate: actionModalNotice.leave.start,
                      endDate: actionModalNotice.leave.end,
                      totalDays: actionModalNotice.leave.durationDays,
                      language: 'en'
                    })
                  : getLeaveRejectionWhatsAppUrl({
                      employeeName: actionModalNotice.leave.employee,
                      phone: actionModalNotice.leave.phone,
                      leaveType: actionModalNotice.leave.type,
                      startDate: actionModalNotice.leave.start,
                      endDate: actionModalNotice.leave.end,
                      language: 'en'
                    })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActionModalNotice(null)}
                className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
              >
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Send in English (EN)</span>
              </a>

              <a
                href={actionModalNotice.action === 'Approved'
                  ? getLeaveApprovalWhatsAppUrl({
                      employeeName: actionModalNotice.leave.employee,
                      phone: actionModalNotice.leave.phone,
                      leaveType: actionModalNotice.leave.type,
                      startDate: actionModalNotice.leave.start,
                      endDate: actionModalNotice.leave.end,
                      totalDays: actionModalNotice.leave.durationDays,
                      language: 'ar'
                    })
                  : getLeaveRejectionWhatsAppUrl({
                      employeeName: actionModalNotice.leave.employee,
                      phone: actionModalNotice.leave.phone,
                      leaveType: actionModalNotice.leave.type,
                      startDate: actionModalNotice.leave.start,
                      endDate: actionModalNotice.leave.end,
                      language: 'ar'
                    })}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActionModalNotice(null)}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>إرسال بالعربية (AR)</span>
              </a>
            </div>

            <button
              onClick={() => setActionModalNotice(null)}
              className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 cursor-pointer"
            >
              Skip WhatsApp Notice
            </button>
          </div>
        </div>
      )}

      {/* RECORD EMPLOYEE LEAVE (HR DIRECT ENTRY MODAL) */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-white/10 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Record Employee Leave</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Add already taken or approved leaves into records</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsRecordModalOpen(false);
                  setRecordFile(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordLeaveSubmit} className="space-y-4">
              {/* Employee Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Select Employee *
                </label>
                <select
                  required
                  value={recordForm.userId}
                  onChange={(e) => setRecordForm({ ...recordForm, userId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  <option value="">-- Choose Employee --</option>
                  {employeesList.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.job_title || emp.role} {emp.department ? `• ${emp.department}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Leave Category */}
              {(() => {
                const selectedEmp = employeesList.find(e => e.id === recordForm.userId);
                const isEmpFemale = ((selectedEmp?.gender || '').toLowerCase() === 'female');
                const isEmpMale = ((selectedEmp?.gender || '').toLowerCase() === 'male');

                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                        Leave Category *
                      </label>
                      {selectedEmp && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isEmpFemale 
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}>
                          {isEmpFemale ? '👩 Female Employee' : '👨 Male Employee'}
                        </span>
                      )}
                    </div>
                    <select
                      value={recordForm.leaveType}
                      onChange={(e) => setRecordForm({ ...recordForm, leaveType: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                    >
                      <option value="Yearly">Yearly / Annual Leave (Paid)</option>
                      <option value="Sick">Sick / Medical Leave</option>
                      
                      {/* Female Only: Maternity */}
                      {(!selectedEmp || isEmpFemale) && (
                        <option value="Maternity">Maternity Leave (98 Days)</option>
                      )}
                      
                      {/* Male Only: Paternity */}
                      {(!selectedEmp || isEmpMale) && (
                        <option value="Paternity">Paternity Leave (7 Days)</option>
                      )}
                      
                      <option value="Marriage">Marriage Leave (3 Days)</option>
                      <option value="Bereavement_Immediate">Bereavement Leave</option>
                      <option value="Unpaid">Unpaid Leave</option>
                    </select>
                  </div>
                );
              })()}

              {/* Optional Medical Certificate / Document Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Medical Certificate / Document (Optional)
                  </label>
                  {(recordForm.leaveType === 'Sick' || recordForm.leaveType === 'Maternity') && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                      Recommended for {recordForm.leaveType} Leave
                    </span>
                  )}
                </div>

                {recordFile ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span className="text-xs font-bold truncate">{recordFile.name}</span>
                      <span className="text-[10px] opacity-75 shrink-0">({(recordFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecordFile(null)}
                      className="p-1 rounded-lg hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-2xl bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer group">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => setRecordFile(e.target.files?.[0] || null)}
                    />
                    <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors mb-1" />
                    <span className="text-xs font-bold text-slate-700 dark:text-gray-300">
                      {recordForm.leaveType === 'Sick' || recordForm.leaveType === 'Maternity'
                        ? 'Attach Clinic / Hospital Sick Leave Certificate'
                        : 'Attach Medical Report or Official Document'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-gray-500">Supports PDF, JPG, PNG (Max 10MB)</span>
                  </label>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.startDate}
                    onChange={(e) => setRecordForm({ ...recordForm, startDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={recordForm.endDate}
                    min={recordForm.startDate}
                    onChange={(e) => setRecordForm({ ...recordForm, endDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Record Status *
                </label>
                <select
                  value={recordForm.status}
                  onChange={(e) => setRecordForm({ ...recordForm, status: e.target.value as 'Approved' | 'Pending' })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
                >
                  <option value="Approved">Approved (Already Taken - Automatically Deduct Balance)</option>
                  <option value="Pending">Pending (Requires Review)</option>
                </select>
              </div>

              {/* Notes / Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">
                  Notes / Reference (Optional)
                </label>
                <textarea
                  rows={2}
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                  placeholder="e.g. Annual leave taken in Jan 2026, offline approval record..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-white/10 rounded-2xl py-2.5 px-4 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecordModalOpen(false);
                    setRecordFile(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-gray-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRecord}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  {isSubmittingRecord ? 'Saving...' : 'Save & Record Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
