import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Mail, Calendar, Clock, FileText, Download, X,
  User, ShieldAlert, Award, AlertCircle, Settings, Trash2, UserCheck, UserX,
  Briefcase, GraduationCap, Users, DollarSign, Home, Building2, RefreshCw
} from 'lucide-react';
import { MOCK_EMPLOYEES, MOCK_LEAVES } from './mockData';
import { DocumentRenewalModal } from '../../components/hr/DocumentRenewalModal';
import { getEmployeeById, deleteEmployeeInDb } from '../../lib/databaseService';
import type { User as UserType } from '../../types';

type EmployeeTabType =
  | 'profile'          // Personal info, family, emergency contacts
  | 'career'           // Job, promotions history, transfer history
  | 'qualifications'   // Education qualifications, work experience
  | 'records'          // Disciplinary, bonuses
  | 'documents'        // Official documents locker
  | 'leaves'           // Attendance stats, balances, leave records
  | 'attendance';      // Shift attendance history

export function HrEmployeeProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<EmployeeTabType>('profile');
  const [employee, setEmployee] = useState<UserType | null>(null);

  useEffect(() => {
    if (id) {
      getEmployeeById(id).then(emp => {
        if (emp) {
          setEmployee(emp);
        } else {
          setEmployee(MOCK_EMPLOYEES.find(e => e.id === id) || MOCK_EMPLOYEES[0]);
        }
      }).catch(err => {
        console.error(err);
        setEmployee(MOCK_EMPLOYEES.find(e => e.id === id) || MOCK_EMPLOYEES[0]);
      });
    }
  }, [id]);

  // Management modal states
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [exitDateState, setExitDateState] = useState(() => new Date().toISOString().split('T')[0]);
  const [exitReasonState, setExitReasonState] = useState('Resignation');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renewalDocTarget, setRenewalDocTarget] = useState<{ id: string; name: string; type: string; expiryDate?: string; number?: string } | null>(null);

  const handleProfileDocRenew = (docId: string, newExpiryDate: string, newNumber?: string) => {
    if (!employee) return;
    const updatedDocs = (employee.documents || []).map(d => {
      if (d.id === docId) {
        return { ...d, expiryDate: newExpiryDate, number: newNumber || d.number };
      }
      return d;
    });
    const updated = { ...employee, documents: updatedDocs };
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employee.id);
    if (idx !== -1) {
      MOCK_EMPLOYEES[idx] = updated as any;
    }
    setEmployee(updated as any);
  };

  const handleUpdateStatus = () => {
    if (!employee) return;
    const updated = {
      ...employee,
      status: 'Inactive' as const,
      exitDate: exitDateState,
      exitReason: exitReasonState,
    };
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employee.id);
    if (idx !== -1) {
      MOCK_EMPLOYEES[idx] = updated as any;
    }
    setEmployee(updated as any);
    setIsManageModalOpen(false);
  };

  const handleReactivate = () => {
    if (!employee) return;
    const updated = {
      ...employee,
      status: 'Active' as const,
      exitDate: undefined,
      exitReason: undefined,
    };
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employee.id);
    if (idx !== -1) {
      MOCK_EMPLOYEES[idx] = updated as any;
    }
    setEmployee(updated as any);
    setIsManageModalOpen(false);
  };

  const handleDeleteEmployee = async () => {
    if (!employee) return;
    await deleteEmployeeInDb(employee.id);
    setIsManageModalOpen(false);
    navigate('/hr/directory');
  };

  const getInitials = (name: string) => {
    if (!name) return 'EM';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Generate mock heatmap data for the last 30 days
  const today = new Date();
  const heatmapData = Array.from({ length: 30 }).map((_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (29 - i));

    const isOmani = employee?.nationality === 'Omani';
    const dayOfWeek = date.getDay();
    const isWeekend = isOmani ? (dayOfWeek === 5 || dayOfWeek === 6) : (dayOfWeek === 5);
    let status: 'present' | 'late' | 'absent' | 'weekend' = 'present';

    if (isWeekend) status = 'weekend';
    else if (i % 7 === 0) status = 'late';
    else if (i === 12) status = 'absent';

    return { date, status };
  });

  const getHeatmapColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500/80 hover:bg-emerald-400 text-white';
      case 'late': return 'bg-amber-500/80 hover:bg-amber-400 text-white';
      case 'absent': return 'bg-red-500/80 hover:bg-red-400 text-white';
      case 'weekend': return 'bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10';
      default: return 'bg-slate-200 dark:bg-white/5';
    }
  };

  const userLeaves = MOCK_LEAVES.filter(l => l.employee === employee?.name);

  const getDocStatusBadge = (expiryDate?: string) => {
    if (!expiryDate) return <span className="text-slate-400 dark:text-gray-400 text-xs font-medium">No Expiry</span>;
    const exp = new Date(expiryDate);
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <AlertCircle className="w-2.5 h-2.5" /> Expired
        </span>
      );
    }
    if (diffDays <= 30) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <AlertCircle className="w-2.5 h-2.5" /> Expiring Soon
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        Active
      </span>
    );
  };

  if (!employee) {
    return (
      <div className="p-12 text-center text-slate-500 dark:text-gray-400 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading Employee File from Database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

      {/* Navigation & Header */}
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={() => navigate(-1)}
          className="p-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Employee File</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Electronic profile, compliance tracking, history and qualifications.</p>
        </div>
      </div>

      {/* Main Employee Information Card */}
      <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 animate-pulse" />

        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-primary/30 flex items-center justify-center text-3xl font-bold text-primary shadow-lg shrink-0">
            {getInitials(employee.name)}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{employee.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${employee.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'}`}>
                {employee.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-gray-400 mb-4 font-medium">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                {employee.role.replace('_', ' ')}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                {employee.company}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                {employee.email}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium transition-colors text-slate-700 dark:text-white shadow-sm">
              <Download className="w-4 h-4" />
              Export Dossier
            </button>
            <button
              onClick={() => setIsManageModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 border border-primary/30 rounded-xl text-sm font-medium transition-all text-primary"
            >
              <Settings className="w-4 h-4" />
              Manage Status
            </button>
          </div>
        </div>
      </div>

      {/* Tabs list for Electronic Employee File subsections */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-4 overflow-x-auto scrollbar-none">
        {[
          { id: 'profile', label: 'Personal & Family', icon: User },
          { id: 'career', label: 'Job & History', icon: Briefcase },
          { id: 'qualifications', label: 'Qualifications', icon: GraduationCap },
          { id: 'records', label: 'Performance Ledger', icon: Award },
          { id: 'documents', label: 'Document Locker', icon: FileText },
          { id: 'leaves', label: 'Leave & Balances', icon: Calendar },
          { id: 'attendance', label: 'Shift Logs', icon: Clock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as EmployeeTabType)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeTab === tab.id
              ? 'bg-primary/10 text-primary border border-primary/30 shadow-sm dark:bg-primary/20 dark:border-primary/40'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5'
              }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Render selected sub-section panel */}
      <div className="mt-6">

        {/* 1. PERSONAL & FAMILY TAB */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Personal card */}
            <div className="lg:col-span-2 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-6">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Personal Details</h3>
                {employee.status === 'Inactive' && (
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                    <UserX className="w-3 h-3" /> Exited Employee
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Full Legal Name</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Nationality Category</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.nationality}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Gender Identification</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.gender}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Religion (Mourning Rule Check)</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.religion || 'Not Specified'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Primary Phone Contact</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Email Account</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.email}</span>
                </div>

                {employee.status === 'Inactive' && (
                  <div className="col-span-2 p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl space-y-1.5 text-xs">
                    <div className="font-bold flex items-center gap-1 text-sm text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" /> Electronic Exit Log
                    </div>
                    <div><strong>Exit Effective Date:</strong> {(employee as any).exitDate || 'N/A'}</div>
                    <div><strong>Exit Clarification Reason:</strong> {(employee as any).exitReason || 'N/A'}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency contacts card */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">Emergency Contact File</h3>
              {employee.emergency_contacts && employee.emergency_contacts.length > 0 ? (
                employee.emergency_contacts.map((contact, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/5 rounded-xl text-xs space-y-1">
                    <div className="text-slate-900 dark:text-white font-bold">{contact.name}</div>
                    <div className="text-slate-500 dark:text-gray-400">Relationship: {contact.relation}</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold">{contact.phone}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No emergency contacts registered.</div>
              )}
            </div>

            {/* Housing & Accommodation Card */}
            <div className="lg:col-span-3 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary" /> Housing & Accommodation Monitoring
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${employee.housing_status === 'Company Accommodation' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                  {employee.housing_status || 'Lives with Family'}
                </span>
              </div>

              {employee.housing_status === 'Company Accommodation' ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Building / Camp Name</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      {employee.accommodation_details?.building_name || 'Al Khuwair Staff Complex'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Building Address</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      {employee.accommodation_details?.building_address || 'Way 3512, Muscat'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Room / Unit #</span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                      {employee.accommodation_details?.room_number || 'Flat 101'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Occupancy Count</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {employee.accommodation_details?.occupancy_count || 4} Members Residing
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-600 dark:text-gray-400">
                  🏡 Employee resides in private accommodation / family residence. No company housing monitoring required.
                </div>
              )}
            </div>

            {/* Family Members card */}
            <div className="lg:col-span-3 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">Registered Family Dependents</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employee.family_members && employee.family_members.length > 0 ? (
                  employee.family_members.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                      <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        <div className="text-slate-900 dark:text-white font-bold">{member.name}</div>
                        <div className="text-slate-500 dark:text-gray-400">Relationship: {member.relation}</div>
                        <div className="text-slate-400 dark:text-gray-500">Birth Date: {member.dob}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-gray-500 text-xs">No family members registered.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. JOB & HISTORY TAB */}
        {activeTab === 'career' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Position details */}
            <div className="lg:col-span-2 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">Corporate Placement</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Company Entity</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.company}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Job Designation</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.role.replace('_', ' ')}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Immediate Supervisor</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.supervisor_name || 'N/A (Top Management)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Join Date (Labor History)</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.join_date}</span>
                </div>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 pt-4">Compensation & Allowances</h3>
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block leading-none">Base Salary</span>
                    <span className="text-slate-900 dark:text-white font-bold">{employee.base_salary} OMR / month</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl">
                  <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block leading-none">Allowances</span>
                    <span className="text-slate-900 dark:text-white font-bold">{employee.allowances} OMR / month</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Promotions and Department Transfers logs */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 mb-3">Promotion Log</h3>
                {employee.promotions && employee.promotions.length > 0 ? (
                  employee.promotions.map((p, idx) => (
                    <div key={idx} className="border-l-2 border-primary/50 pl-3 py-1 space-y-0.5 text-xs">
                      <div className="text-slate-900 dark:text-white font-semibold">{p.from} ➔ {p.to}</div>
                      <div className="text-slate-500 dark:text-gray-500">{p.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-gray-500 text-xs">No promotions recorded.</div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 mb-3">Department Transfers</h3>
                {employee.transfers && employee.transfers.length > 0 ? (
                  employee.transfers.map((t, idx) => (
                    <div key={idx} className="border-l-2 border-emerald-500/50 pl-3 py-1 space-y-0.5 text-xs">
                      <div className="text-slate-900 dark:text-white font-semibold">{t.from_dept} Dept ➔ {t.to_dept} Dept</div>
                      <div className="text-slate-500 dark:text-gray-500">{t.date}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-400 dark:text-gray-500 text-xs">No transfers recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. QUALIFICATIONS & EXPERIENCE TAB */}
        {activeTab === 'qualifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Educational credentials */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" /> Educational Qualifications
              </h3>
              {employee.qualifications && employee.qualifications.length > 0 ? (
                employee.qualifications.map((q, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1 text-xs">
                    <div className="text-slate-900 dark:text-white font-bold text-sm">{q.degree}</div>
                    <div className="text-slate-500 dark:text-gray-400">{q.school}</div>
                    <div className="text-primary font-semibold">Graduation Year: {q.year}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No educational records attached.</div>
              )}
            </div>

            {/* Professional work experience history */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Work Experience History
              </h3>
              {employee.experience && employee.experience.length > 0 ? (
                employee.experience.map((exp, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1 text-xs">
                    <div className="text-slate-900 dark:text-white font-bold text-sm">{exp.role}</div>
                    <div className="text-slate-500 dark:text-gray-400">Company: {exp.company}</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Period: {exp.period}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No previous work experience recorded.</div>
              )}
            </div>
          </div>
        )}

        {/* 4. PERFORMANCE LEDGER (RECORDS) TAB */}
        {activeTab === 'records' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Bonuses */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Awarded Bonuses & Perks
              </h3>
              {employee.bonuses && employee.bonuses.length > 0 ? (
                employee.bonuses.map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs">
                    <div>
                      <div className="text-slate-900 dark:text-white font-bold">Reason: {b.reason}</div>
                      <div className="text-slate-500 dark:text-gray-500">Awarded Date: {b.date}</div>
                    </div>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">+{b.amount} OMR</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No bonuses registered for this employee.</div>
              )}
            </div>

            {/* Disciplinary records */}
            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" /> Disciplinary Violations
              </h3>
              {employee.disciplinary && employee.disciplinary.length > 0 ? (
                employee.disciplinary.map((d, idx) => (
                  <div key={idx} className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-900 dark:text-white font-bold">{d.violation}</span>
                      <span className="text-red-600 dark:text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded">{d.action}</span>
                    </div>
                    <div className="text-slate-500 dark:text-gray-500">Issued Date: {d.date}</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No disciplinary actions on record. Clean profile.</div>
              )}
            </div>
          </div>
        )}

        {/* 5. OFFICIAL DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">Official Document Locker</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employee.documents && employee.documents.length > 0 ? (
                employee.documents.map((doc) => (
                  <div key={doc.id} className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{doc.name}</span>
                        {getDocStatusBadge(doc.expiryDate)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Classification: {doc.type}</div>
                      {doc.expiryDate && (
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 mt-2">Expiry: {doc.expiryDate}</div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button className="flex-1 text-xs font-semibold text-primary hover:text-emerald-600 dark:hover:text-emerald-400 py-2 border border-slate-200 dark:border-white/10 hover:border-primary/30 bg-white dark:bg-white/5 hover:bg-primary/5 rounded-lg transition-all shadow-sm">
                        Download Copy
                      </button>
                      <button
                        onClick={() => setRenewalDocTarget(doc)}
                        className="px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-white border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Renew
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs col-span-3">No documents uploaded.</div>
              )}
            </div>
          </div>
        )}

        {/* 6. LEAVES TAB */}
        {activeTab === 'leaves' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Active Leaves & Balances</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center mb-4 border-4 border-primary">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.yearly}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">Annual Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Total allowance: 30 days / year</p>
              </div>

              <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center mb-4 border-4 border-amber-500">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.sick}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">Sick Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Paid scale rules applied</p>
              </div>

              <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-28 h-28 rounded-full flex flex-col items-center justify-center mb-4 border-4 border-blue-400">
                  <span className="text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.pregnancy}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white mb-1">Maternity Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Eligible female employees only</p>
              </div>

            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 mt-8">Recent Leave Applications</h3>
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="p-4 pl-6">Leave Type</th>
                    <th className="p-4">Requested Dates</th>
                    <th className="p-4">Approval Flow Status</th>
                    <th className="p-4">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {userLeaves.length > 0 ? (
                    userLeaves.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs">
                        <td className="p-4 pl-6">
                          <div className="font-semibold text-slate-900 dark:text-white">{req.type} Leave</div>
                        </td>
                        <td className="p-4">
                          <div className="text-slate-600 dark:text-gray-300">{req.start} to {req.end}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                            req.status === 'Rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {req.documentUrl ? (
                            <button className="text-primary hover:underline font-semibold">Download Certificate</button>
                          ) : (
                            <span className="text-slate-400 dark:text-gray-500">None</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-6 pl-6 text-slate-400 dark:text-gray-500" colSpan={4}>No recent leave logs.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. SHIFT LOGS (ATTENDANCE) TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">On-Time Days</div>
                <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">24</div>
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">Last 30 Days</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Late Warnings</div>
                <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">2</div>
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">Average 12m late</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Absences</div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400">0</div>
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">Unexcused</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Hours Logged</div>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">176h</div>
                <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">Completed this month</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Attendance Heatmap */}
              <div className="xl:col-span-1 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">30-Day Calendar Heatmap</h3>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                    <div key={`${day}-${idx}`} className="text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 mb-1">{day}</div>
                  ))}

                  {Array.from({ length: heatmapData[0].date.getDay() }).map((_, i) => (
                    <div key={`pad-${i}`} className="aspect-square rounded-xl bg-transparent" />
                  ))}

                  {heatmapData.map((data, i) => (
                    <div
                      key={i}
                      title={`${data.date.toLocaleDateString()}: ${data.status}`}
                      className={`aspect-square rounded-lg border border-slate-200 dark:border-white/5 flex items-center justify-center text-xs font-medium transition-transform cursor-pointer hover:scale-105 ${getHeatmapColor(data.status)}`}
                    >
                      <span className={data.status === 'weekend' ? 'text-slate-500 dark:text-gray-600' : 'text-white drop-shadow-md'}>
                        {data.date.getDate()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attendance Table Logs */}
              <div className="xl:col-span-2 bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-white/10">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Attendance Log Feed</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">
                      <tr>
                        <th className="p-4 pl-6">Date</th>
                        <th className="p-4">Punch In</th>
                        <th className="p-4">Punch Out</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">30 Jul 2026</td>
                        <td className="p-4 text-slate-600 dark:text-gray-300">08:20 AM</td>
                        <td className="p-4 text-slate-600 dark:text-gray-300">05:05 PM</td>
                        <td className="p-4"><span className="text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">Present</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">29 Jul 2026</td>
                        <td className="p-4 text-slate-600 dark:text-gray-300">08:48 AM</td>
                        <td className="p-4 text-slate-600 dark:text-gray-300">05:00 PM</td>
                        <td className="p-4"><span className="text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">Late</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Status Management Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Manage Status</h2>
              </div>
              <button
                onClick={() => { setIsManageModalOpen(false); setConfirmDelete(false); }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* If employee is active: Deactivate/Exit Form */}
              {employee.status === 'Active' ? (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <strong>Archive Employee:</strong> Deactivating an employee preserves historical logs and documents for audits, but revokes access.
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Exit Effective Date</label>
                      <input
                        type="date"
                        value={exitDateState}
                        onChange={(e) => setExitDateState(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 mb-1">Exit Clarification Reason</label>
                      <select
                        value={exitReasonState}
                        onChange={(e) => setExitReasonState(e.target.value)}
                        className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none appearance-none"
                      >
                        <option value="Resignation" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Resignation / Quit</option>
                        <option value="Termination" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Termination / Layoff</option>
                        <option value="Contract Expired" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">End of Contract Agreement</option>
                        <option value="Retirement" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Retirement</option>
                        <option value="Other" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Other reasons</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdateStatus}
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <UserX className="w-4 h-4" /> Log Exit & Deactivate Profile
                  </button>
                </div>
              ) : (
                /* Reactivate form */
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl text-xs flex items-start gap-2">
                    <UserCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <strong>Exited Profile:</strong> Reactivating this profile restores system authorization access and clears exit logs.
                    </div>
                  </div>

                  <button
                    onClick={handleReactivate}
                    className="w-full py-2.5 bg-primary hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4" /> Reactivate Profile
                  </button>
                </div>
              )}

              {/* Absolute Delete Section */}
              <div className="border-t border-slate-200 dark:border-white/10 pt-4 space-y-4">
                {confirmDelete ? (
                  <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4" /> Double Confirmation Warning
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-gray-400 leading-normal">
                      Are you absolutely sure you want to permanently delete this file? This bypasses standard archiving and permanently deletes all historical record logs.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDeleteEmployee}
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[10px] uppercase transition-colors"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-2.5 bg-transparent hover:bg-red-500/10 border border-dashed border-red-500/30 hover:border-red-500 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Permanently Delete Employee Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Renewal Drawer Modal */}
      <DocumentRenewalModal
        isOpen={!!renewalDocTarget}
        onClose={() => setRenewalDocTarget(null)}
        employeeName={employee.name}
        documentItem={renewalDocTarget}
        onRenew={handleProfileDocRenew}
      />
    </div>
  );
}
