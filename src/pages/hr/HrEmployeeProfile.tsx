import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Mail, Calendar, Clock, FileText, Download, X, Eye,
  User, ShieldAlert, Award, AlertCircle, Settings, Trash2, UserCheck, UserX,
  Briefcase, GraduationCap, Users, DollarSign, Home, Building2, RefreshCw, CreditCard, Edit3, Landmark, CheckCircle2,
  ChevronLeft, ChevronRight, Plus, MessageSquare, Camera
} from 'lucide-react';
import { MOCK_EMPLOYEES, MOCK_LEAVES } from './mockData';
import { DocumentRenewalModal } from '../../components/hr/DocumentRenewalModal';
import { 
  getEmployeeById, 
  deleteEmployeeInDb, 
  updateEmployeeInDb, 
  getEmployeeAttendanceLogsFromDb, 
  getEmployeeLeaveRequestsFromDb,
  addEmployeeDocumentToDb,
  deleteEmployeeDocumentFromDb,
  renewEmployeeDocumentInDb,
  getSavedLocalAvatar
} from '../../lib/databaseService';
import { supabase } from '../../lib/supabase';
import { isDatePublicHoliday } from '../../lib/holidayService';
import { sendEmployeeWhatsAppInvite } from '../../lib/whatsappService';
import { generateMonthlyAttendanceReport } from '../../lib/attendanceReportService';
import { compressAndResizeAvatar } from '../../lib/imageUtils';
import type { User as UserType, Nationality } from '../../types';

type EmployeeTabType =
  | 'profile'          // Personal info, family, emergency contacts
  | 'career'           // Job, promotions history, transfer history
  | 'banking'          // Bank account details & salary transfer info
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
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [dbLeaves, setDbLeaves] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    const loadProfileData = () => {
      getEmployeeById(id).then(emp => {
        if (emp) {
          const localAvatar = getSavedLocalAvatar(emp.id, emp.email, emp.phone);
          if (localAvatar && !emp.avatar_url) {
            emp.avatar_url = localAvatar;
            updateEmployeeInDb(emp.id, { avatar_url: localAvatar });
          }
          setEmployee(emp);
        } else {
          setEmployee(MOCK_EMPLOYEES.find(e => e.id === id) || MOCK_EMPLOYEES[0]);
        }
      }).catch(err => {
        console.error(err);
        setEmployee(MOCK_EMPLOYEES.find(e => e.id === id) || MOCK_EMPLOYEES[0]);
      });

      getEmployeeAttendanceLogsFromDb(id).then((logs: any[]) => setDbLogs(logs)).catch(console.error);
      getEmployeeLeaveRequestsFromDb(id).then((leaves: any[]) => setDbLeaves(leaves)).catch(console.error);
    };

    loadProfileData();

    // Supabase Realtime channel for live punch-in/out and leave sync
    const channel = supabase
      .channel(`hr-profile-sync-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `user_id=eq.${id}` }, () => {
        getEmployeeAttendanceLogsFromDb(id).then((logs: any[]) => setDbLogs(logs)).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests', filter: `user_id=eq.${id}` }, () => {
        getEmployeeLeaveRequestsFromDb(id).then((leaves: any[]) => setDbLeaves(leaves)).catch(console.error);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${id}` }, () => {
        getEmployeeById(id).then(emp => emp && setEmployee(emp)).catch(console.error);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Management modal states
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [exitDateState, setExitDateState] = useState(() => new Date().toISOString().split('T')[0]);
  const [exitReasonState, setExitReasonState] = useState('Resignation');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renewalDocTarget, setRenewalDocTarget] = useState<{ id: string; name: string; type: string; expiryDate?: string; number?: string } | null>(null);
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const handleProfileDocRenew = async (docId: string, newExpiryDate: string, newNumber?: string, attachedFile?: string) => {
    if (!employee) return;
    await renewEmployeeDocumentInDb(employee.id, docId, newExpiryDate, newNumber, attachedFile);

    const updatedDocs = (employee.documents || []).map(d => {
      if (d.id === docId) {
        return { 
          ...d, 
          expiryDate: newExpiryDate, 
          number: newNumber || d.number,
          attachedFile: attachedFile || d.attachedFile
        };
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

  // Photo upload state & handlers
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;
    try {
      setIsUploadingPhoto(true);
      const dataUrl = await compressAndResizeAvatar(file, 400, 0.85);
      const updated = { ...employee, avatar_url: dataUrl };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { avatar_url: dataUrl });
    } catch (err) {
      console.error('Failed to update employee photo:', err);
      alert('Could not process image file. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!employee || !window.confirm("Remove profile photo for this employee?")) return;
    try {
      setIsUploadingPhoto(true);
      const updated = { ...employee, avatar_url: undefined };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { avatar_url: '' });
    } catch (err) {
      console.error('Failed to remove avatar:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_number: '',
    iban: '',
    swift_code: '',
    branch_name: '',
  });

  const openBankModal = () => {
    if (!employee) return;
    setBankForm({
      bank_name: employee.bank_name || '',
      account_number: employee.account_number || '',
      iban: employee.iban || '',
      swift_code: employee.swift_code || '',
      branch_name: employee.branch_name || '',
    });
    setIsBankModalOpen(true);
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setIsSavingBank(true);
    try {
      const updated = {
        ...employee,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        iban: bankForm.iban,
        swift_code: bankForm.swift_code,
        branch_name: bankForm.branch_name,
      };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, bankForm);
      setIsBankModalOpen(false);
    } catch (err) {
      console.error('Error saving bank details:', err);
    } finally {
      setIsSavingBank(false);
    }
  };

  // 1. Personal Info Edit
  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState({
    name: '',
    phone: '',
    email: '',
    nationality: 'OMAN' as Nationality,
    gender: 'Male' as 'Male' | 'Female',
    religion: 'Muslim' as 'Muslim' | 'Non-Muslim',
  });

  const openPersonalModal = () => {
    if (!employee) return;
    setPersonalForm({
      name: employee.name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      nationality: (employee.nationality === 'Omani' ? 'OMAN' : (employee.nationality || 'OMAN')),
      gender: employee.gender || 'Male',
      religion: employee.religion || 'Muslim',
    });
    setIsPersonalModalOpen(true);
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setIsSavingPersonal(true);
    try {
      const updated = { ...employee, ...personalForm };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, personalForm);
      setIsPersonalModalOpen(false);
    } catch (err) {
      console.error('Error saving personal details:', err);
    } finally {
      setIsSavingPersonal(false);
    }
  };

  // 2. Job & Placement Edit
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [jobForm, setJobForm] = useState({
    job_title: '',
    department: '',
    supervisor_name: '',
    base_salary: 800,
    allowances: 150,
  });

  const openJobModal = () => {
    if (!employee) return;
    setJobForm({
      job_title: employee.job_title || '',
      department: employee.department || '',
      supervisor_name: employee.supervisor_name || '',
      base_salary: employee.base_salary || 800,
      allowances: employee.allowances || 150,
    });
    setIsJobModalOpen(true);
  };

  const handleSaveJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setIsSavingJob(true);
    try {
      const updated = { ...employee, ...jobForm };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, jobForm);
      setIsJobModalOpen(false);
    } catch (err) {
      console.error('Error saving job details:', err);
    } finally {
      setIsSavingJob(false);
    }
  };

  // 3. Housing Edit
  const [isHousingModalOpen, setIsHousingModalOpen] = useState(false);
  const [isSavingHousing, setIsSavingHousing] = useState(false);
  const [housingForm, setHousingForm] = useState({
    housing_status: 'Lives with Family' as 'Lives with Family' | 'Company Accommodation' | 'Private Rental',
    building_name: '',
    building_address: '',
    room_number: '',
    occupancy_count: 4,
  });

  const openHousingModal = () => {
    if (!employee) return;
    setHousingForm({
      housing_status: employee.housing_status || 'Lives with Family',
      building_name: employee.accommodation_details?.building_name || '',
      building_address: employee.accommodation_details?.building_address || '',
      room_number: employee.accommodation_details?.room_number || '',
      occupancy_count: employee.accommodation_details?.occupancy_count || 4,
    });
    setIsHousingModalOpen(true);
  };

  const handleSaveHousing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setIsSavingHousing(true);
    try {
      const accommodation_details = housingForm.housing_status === 'Company Accommodation' ? {
        building_name: housingForm.building_name,
        building_address: housingForm.building_address,
        room_number: housingForm.room_number,
        occupancy_count: housingForm.occupancy_count,
      } : undefined;

      const updated = {
        ...employee,
        housing_status: housingForm.housing_status,
        accommodation_details,
      };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, {
        housing_status: housingForm.housing_status,
        accommodation_details,
      });
      setIsHousingModalOpen(false);
    } catch (err) {
      console.error('Error saving housing details:', err);
    } finally {
      setIsSavingHousing(false);
    }
  };

  // 4. Qualification Add/Delete
  const [isQualModalOpen, setIsQualModalOpen] = useState(false);
  const [qualForm, setQualForm] = useState({ degree: '', school: '', year: '' });
  const [isSavingQual, setIsSavingQual] = useState(false);

  const handleSaveQualification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !qualForm.degree.trim()) return;
    setIsSavingQual(true);
    try {
      const updatedQuals = [...(employee.qualifications || []), qualForm];
      const updated = { ...employee, qualifications: updatedQuals };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { qualifications: updatedQuals });
      setIsQualModalOpen(false);
      setQualForm({ degree: '', school: '', year: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingQual(false);
    }
  };

  const handleDeleteQualification = async (index: number) => {
    if (!employee) return;
    const updatedQuals = (employee.qualifications || []).filter((_, i) => i !== index);
    const updated = { ...employee, qualifications: updatedQuals };
    setEmployee(updated);
    await updateEmployeeInDb(employee.id, { qualifications: updatedQuals });
  };

  // 5. Work Experience Add/Delete
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [expForm, setExpForm] = useState({ company: '', role: '', period: '' });
  const [isSavingExp, setIsSavingExp] = useState(false);

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !expForm.company.trim()) return;
    setIsSavingExp(true);
    try {
      const updatedExp = [...(employee.experience || []), expForm];
      const updated = { ...employee, experience: updatedExp };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { experience: updatedExp });
      setIsExpModalOpen(false);
      setExpForm({ company: '', role: '', period: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingExp(false);
    }
  };

  const handleDeleteExperience = async (index: number) => {
    if (!employee) return;
    const updatedExp = (employee.experience || []).filter((_, i) => i !== index);
    const updated = { ...employee, experience: updatedExp };
    setEmployee(updated);
    await updateEmployeeInDb(employee.id, { experience: updatedExp });
  };

  // 6. Bonus Add
  const [isBonusModalOpen, setIsBonusModalOpen] = useState(false);
  const [bonusForm, setBonusForm] = useState({ date: new Date().toISOString().split('T')[0], amount: 100, reason: '' });
  const [isSavingBonus, setIsSavingBonus] = useState(false);

  const handleSaveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !bonusForm.reason.trim()) return;
    setIsSavingBonus(true);
    try {
      const updatedBonuses = [...(employee.bonuses || []), bonusForm];
      const updated = { ...employee, bonuses: updatedBonuses };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { bonuses: updatedBonuses });
      setIsBonusModalOpen(false);
      setBonusForm({ date: new Date().toISOString().split('T')[0], amount: 100, reason: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingBonus(false);
    }
  };

  // 7. Disciplinary Add
  const [isDiscModalOpen, setIsDiscModalOpen] = useState(false);
  const [discForm, setDiscForm] = useState({ date: new Date().toISOString().split('T')[0], violation: '', action: 'First Written Warning' });
  const [isSavingDisc, setIsSavingDisc] = useState(false);

  const handleSaveDisciplinary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !discForm.violation.trim()) return;
    setIsSavingDisc(true);
    try {
      const updatedDisc = [...(employee.disciplinary || []), discForm];
      const updated = { ...employee, disciplinary: updatedDisc };
      setEmployee(updated);
      await updateEmployeeInDb(employee.id, { disciplinary: updatedDisc });
      setIsDiscModalOpen(false);
      setDiscForm({ date: new Date().toISOString().split('T')[0], violation: '', action: 'First Written Warning' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDisc(false);
    }
  };

  // 8. Document Add / Delete
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    type: 'Work Visa (Residence)',
    docNumber: '',
    expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
    attachedFile: ''
  });
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !docForm.name.trim()) return;
    setIsSavingDoc(true);
    try {
      const insertedId = await addEmployeeDocumentToDb(employee.id, {
        name: docForm.name,
        type: docForm.type,
        number: docForm.docNumber,
        expiryDate: docForm.expiryDate,
        attachedFile: docForm.attachedFile || ''
      });

      const newDoc = {
        id: insertedId,
        name: docForm.name,
        type: docForm.type,
        number: docForm.docNumber,
        expiryDate: docForm.expiryDate,
        attachedFile: docForm.attachedFile || ''
      };

      const updatedDocs = [...(employee.documents || []), newDoc];
      const updated = { ...employee, documents: updatedDocs };
      setEmployee(updated);

      const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employee.id);
      if (idx !== -1) {
        MOCK_EMPLOYEES[idx] = updated as any;
      }

      setIsDocModalOpen(false);
      setDocForm({
        name: '',
        type: 'Work Visa (Residence)',
        docNumber: '',
        expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
        attachedFile: ''
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!employee) return;
    await deleteEmployeeDocumentFromDb(docId, employee.id);

    const updatedDocs = (employee.documents || []).filter(d => d.id !== docId);
    const updated = { ...employee, documents: updatedDocs };
    setEmployee(updated);

    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employee.id);
    if (idx !== -1) {
      MOCK_EMPLOYEES[idx] = updated as any;
    }
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

  // Month & Year Filter state for Shift Logs
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
    setSelectedCalendarDate(null);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
    setSelectedCalendarDate(null);
  };

  // Calculate days in selected month
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(selectedYear, selectedMonth, 1).getDay();

  // Local date formatter helper for yyyy-mm-dd without UTC shift
  const nowObj = new Date();
  const todayStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;

  // Generate heatmap & real shift log items for selected month & year
  const monthlyHeatmapData = Array.from({ length: daysInSelectedMonth }).map((_, i) => {
    const dayNum = i + 1;
    const dateObj = new Date(selectedYear, selectedMonth, dayNum);
    const mStr = String(selectedMonth + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const dateStr = `${selectedYear}-${mStr}-${dStr}`;
    
    const isOmani = employee?.nationality === 'OMAN' || employee?.nationality === 'Omani';
    const dayOfWeek = dateObj.getDay();
    const isWeekend = isOmani ? (dayOfWeek === 5 || dayOfWeek === 6) : (dayOfWeek === 5);

    const publicHoliday = isDatePublicHoliday(dateStr);
    const isFuture = dateStr > todayStr;

    // Find real attendance log row from Supabase
    const realLog = dbLogs.find(l => {
      if (l.date === dateStr) return true;
      if (l.clock_in_time && l.clock_in_time.startsWith(dateStr)) return true;
      return false;
    });

    // Find real approved leave from Supabase
    const realLeave = dbLeaves.find(l => {
      const empMatch = l.user_id === employee?.id || l.employee === employee?.name || l.user_id === id;
      if (!empMatch) return false;
      const isApproved = !l.status || l.status === 'Approved';
      if (!isApproved) return false;
      const s = l.startDate || l.start_date;
      const e = l.endDate || l.end_date;
      if (s && e) {
        return dateStr >= s && dateStr <= e;
      }
      return false;
    });

    let status: 'present' | 'late' | 'absent' | 'weekend' | 'leave' | 'holiday' | 'upcoming' = 'weekend';
    let clockInText = '--:--';
    let clockOutText = '--:--';
    let shiftDurationText = '0m';
    let totalMinutesWorked = 0;

    if (publicHoliday) {
      status = 'holiday';
      clockInText = 'OFF (Paid)';
      clockOutText = 'OFF (Paid)';
      shiftDurationText = 'Paid Holiday';
    } else if (realLeave) {
      status = 'leave';
      clockInText = `Leave (${realLeave.type || realLeave.leaveType || 'Approved'})`;
      clockOutText = `Leave (${realLeave.type || realLeave.leaveType || 'Approved'})`;
      shiftDurationText = 'Approved Leave';
    } else if (realLog) {
      const rawStatus = (realLog.status || '').toLowerCase();
      if (rawStatus.includes('late')) {
        status = 'late';
      } else {
        status = 'present';
      }

      if (realLog.clock_in_time) {
        const inDate = new Date(realLog.clock_in_time);
        clockInText = inDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        clockInText = '08:00 AM';
      }

      if (realLog.clock_out_time) {
        const outDate = new Date(realLog.clock_out_time);
        clockOutText = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (realLog.clock_in_time) {
          const diffMs = new Date(realLog.clock_out_time).getTime() - new Date(realLog.clock_in_time).getTime();
          totalMinutesWorked = Math.max(0, Math.floor(diffMs / (1000 * 60)));
          const hrs = Math.floor(totalMinutesWorked / 60);
          const mins = totalMinutesWorked % 60;
          if (hrs > 0 && mins > 0) {
            shiftDurationText = `${hrs}h ${mins}m`;
          } else if (hrs > 0) {
            shiftDurationText = `${hrs}h`;
          } else {
            shiftDurationText = `${mins}m`;
          }
        } else {
          shiftDurationText = '8h 0m';
          totalMinutesWorked = 480;
        }
      } else {
        clockOutText = 'Active Shift';
        shiftDurationText = 'Active Shift';
      }
    } else if (isWeekend) {
      status = 'weekend';
      clockInText = 'Weekend Off';
      clockOutText = 'Weekend Off';
      shiftDurationText = 'Off';
    } else if (!isFuture) {
      const joinStr = employee?.join_date || '2024-01-01';
      if (dateStr < todayStr && dateStr >= joinStr) {
        status = 'absent';
        clockInText = 'No Punch Record';
        clockOutText = 'No Punch Record';
        shiftDurationText = '0m';
      } else if (dateStr === todayStr) {
        status = 'upcoming';
        clockInText = 'Not Checked In Yet';
        clockOutText = '--:--';
        shiftDurationText = '--:--';
      } else {
        status = 'upcoming';
        clockInText = '--:--';
        clockOutText = '--:--';
        shiftDurationText = '--:--';
      }
    } else {
      status = 'upcoming';
      clockInText = 'Scheduled Shift';
      clockOutText = 'Scheduled Shift';
      shiftDurationText = '--:--';
    }

    return {
      dayNum,
      date: dateObj,
      dateStr,
      status,
      clockInText,
      clockOutText,
      shiftDurationText,
      totalMinutesWorked,
      holidayName: publicHoliday?.name
    };
  });

  // Calculate monthly stats dynamically
  const monthlyStats = {
    onTime: monthlyHeatmapData.filter(d => d.status === 'present').length,
    late: monthlyHeatmapData.filter(d => d.status === 'late').length,
    absent: monthlyHeatmapData.filter(d => d.status === 'absent').length,
    totalHours: (monthlyHeatmapData.filter(d => d.status === 'present' || d.status === 'late').length) * 8
  };

  const getHeatmapColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-emerald-500/80 hover:bg-emerald-400 text-white';
      case 'late': return 'bg-amber-500/80 hover:bg-amber-400 text-white';
      case 'absent': return 'bg-red-500/80 hover:bg-red-400 text-white';
      case 'holiday': return 'bg-purple-600/90 hover:bg-purple-500 text-white font-bold shadow-xs';
      case 'weekend': return 'bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10';
      case 'upcoming': return 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-gray-500 border border-dashed border-slate-300/80 dark:border-white/10';
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
      <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none animate-pulse" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 relative z-10">
          {/* Avatar Container */}
          <div className="shrink-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 border border-primary/30 flex items-center justify-center text-2xl sm:text-3xl font-bold text-primary shadow-lg overflow-hidden">
              {employee.avatar_url ? (
                <img src={employee.avatar_url} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                getInitials(employee.name)
              )}
            </div>

            <input
              id="hr-employee-avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploadingPhoto}
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">{employee.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${employee.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-gray-500/10 dark:text-gray-400 dark:border-gray-500/20'}`}>
                {employee.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 dark:text-gray-400 mb-2 font-medium">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Briefcase className="w-4 h-4 text-primary shrink-0" />
                <span className="truncate">{employee.role.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">{employee.company}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{employee.email}</span>
              </div>
            </div>

            {/* Quick Photo Actions */}
            <div className="flex items-center gap-2 mt-1">
              <label
                htmlFor="hr-employee-avatar-upload"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-gray-300 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-primary" />
                <span>{employee.avatar_url ? 'Change Photo' : 'Upload Photo'}</span>
              </label>
              {employee.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-red-500 hover:bg-red-500/10 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  title="Remove custom photo and reset to initials"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button
              onClick={() => sendEmployeeWhatsAppInvite({
                name: employee.name,
                phone: employee.phone,
                email: employee.email,
                company: employee.company || 'Osan Group',
                pin: employee.pin || '123456'
              })}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" />
              Share Login (WhatsApp)
            </button>
            <button
              onClick={() => {
                if (!employee) return;
                const cleanNation = (raw?: string) => {
                  if (!raw) return 'Oman';
                  let cleaned = raw.trim();
                  cleaned = cleaned.replace(/^Expat\s*[\(-]?\s*/i, '').replace(/\)$/, '').trim();
                  if (cleaned.toLowerCase() === 'expat') return 'Expatriate';
                  if (cleaned.toLowerCase() === 'omani') return 'Oman';
                  return cleaned || 'Oman';
                };

                const nationName = cleanNation(employee.nationality);
                const printWindow = window.open('', '_blank');
                if (!printWindow) return;

                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <title>${employee.name} - Employee Profile PDF</title>
                    <style>
                      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
                      .header { display: flex; justify-content: space-between; align-items: center; border-b: 3px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
                      .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
                      .subtitle { font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 1px; }
                      .section { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; background: #f8fafc; }
                      .section-title { font-size: 14px; font-weight: 800; color: #0f172a; border-b: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; }
                      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px; }
                      .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px; }
                      .value { font-weight: 600; color: #0f172a; }
                      .footer { margin-top: 40px; border-t: 1px dashed #cbd5e1; pt: 20px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
                      .stamp-box { border: 2px dashed #cbd5e1; padding: 20px; text-align: center; border-radius: 8px; font-weight: 700; color: #94a3b8; margin-top: 24px; }
                      @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                      }
                    </style>
                  </head>
                  <body>
                    <div class="header">
                      <div style="display: flex; align-items: center; gap: 16px;">
                        ${employee.avatar_url ? `
                          <img src="${employee.avatar_url}" style="width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 2px solid #10b981;" />
                        ` : ''}
                        <div>
                          <h1 class="title">${employee.name}</h1>
                          <div class="subtitle">${employee.job_title || employee.role} &bull; ${employee.company || 'OSAN GROUP'}</div>
                        </div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: 900; color: #10b981;">OSAN GROUP</div>
                        <div style="font-size: 11px; color: #64748b;">OFFICIAL HR DOSSIER FILE</div>
                      </div>
                    </div>

                    <div class="section">
                      <div class="section-title">1. Personal Information</div>
                      <div class="grid">
                        <div><span class="label">Full Legal Name</span><span class="value">${employee.name}</span></div>
                        <div><span class="label">Nationality</span><span class="value">${nationName}</span></div>
                        <div><span class="label">Gender Identification</span><span class="value">${employee.gender}</span></div>
                        <div><span class="label">Religion</span><span class="value">${employee.religion || 'Not Specified'}</span></div>
                        <div><span class="label">Phone Contact</span><span class="value">${employee.phone || 'N/A'}</span></div>
                        <div><span class="label">Email Address</span><span class="value">${employee.email}</span></div>
                      </div>
                    </div>

                    <div class="section">
                      <div class="section-title">2. Employment & Role</div>
                      <div class="grid">
                        <div><span class="label">Company</span><span class="value">${employee.company || 'OSAN GROUP'}</span></div>
                        <div><span class="label">Department</span><span class="value">${employee.department || 'Operations'}</span></div>
                        <div><span class="label">Job Title</span><span class="value">${employee.job_title || employee.role}</span></div>
                        <div><span class="label">Join Date</span><span class="value">${employee.join_date || 'N/A'}</span></div>
                        <div><span class="label">Employment Status</span><span class="value">${employee.status}</span></div>
                        <div><span class="label">Security PIN</span><span class="value">${employee.pin || '123456'}</span></div>
                      </div>
                    </div>

                    <div class="section">
                      <div class="section-title">3. WPS Banking Details</div>
                      <div class="grid">
                        <div><span class="label">Bank Name</span><span class="value">${employee.bank_name || 'Not Configured'}</span></div>
                        <div><span class="label">Account Number</span><span class="value">${employee.account_number || 'Not Configured'}</span></div>
                        <div><span class="label">IBAN</span><span class="value">${employee.iban || 'Not Configured'}</span></div>
                        <div><span class="label">SWIFT Code</span><span class="value">${employee.swift_code || 'Not Configured'}</span></div>
                      </div>
                    </div>

                    <div class="section">
                      <div class="section-title">4. Accommodation & Housing</div>
                      <div class="grid">
                        <div><span class="label">Housing Status</span><span class="value">${employee.housing_status || 'Lives with Family'}</span></div>
                        ${employee.housing_status === 'Company Accommodation' ? `
                          <div><span class="label">Building Name</span><span class="value">${employee.accommodation_details?.building_name || 'N/A'}</span></div>
                          <div><span class="label">Address</span><span class="value">${employee.accommodation_details?.building_address || 'N/A'}</span></div>
                          <div><span class="label">Room Number</span><span class="value">${employee.accommodation_details?.room_number || 'N/A'}</span></div>
                        ` : ''}
                      </div>
                    </div>

                    <div class="stamp-box">
                      OFFICIAL OSAN GROUP HR STAMP & SIGNATURE
                    </div>

                    <div class="footer">
                      <div>Generated on: ${new Date().toLocaleString()}</div>
                      <div>Document Ref: OSAN-HR-${employee.id.substring(0, 8).toUpperCase()}</div>
                    </div>

                    <script>
                      window.onload = function() {
                        window.print();
                      };
                    </script>
                  </body>
                  </html>
                `);
                printWindow.document.close();
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              Export PDF Profile
            </button>
            <button
              onClick={() => {
                if (!employee) return;
                generateMonthlyAttendanceReport({
                  employee: {
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    phone: employee.phone,
                    job_title: employee.job_title || employee.role,
                    department: employee.department,
                    company: employee.company,
                    nationality: employee.nationality,
                    join_date: employee.join_date,
                    avatar_url: employee.avatar_url,
                  },
                  companyName: employee.company || 'OSAN GROUP',
                  monthIndex: selectedMonth,
                  year: selectedYear,
                  shiftStart: (employee.nationality === 'OMAN' || employee.nationality === 'Omani') ? '08:30 AM' : '08:30 AM',
                  shiftEnd: (employee.nationality === 'OMAN' || employee.nationality === 'Omani') ? '05:00 PM' : '06:00 PM',
                  dailyLogs: monthlyHeatmapData,
                });
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs font-bold transition-colors text-emerald-700 dark:text-emerald-300 shadow-xs cursor-pointer active:scale-95"
              title="Download official monthly attendance report sheet"
            >
              <FileText className="w-4 h-4" />
              Attendance Sheet
            </button>
            <button
              onClick={() => setIsManageModalOpen(true)}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 dark:bg-primary/20 hover:bg-primary/20 dark:hover:bg-primary/30 border border-primary/30 rounded-xl text-xs font-bold transition-all text-primary cursor-pointer"
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
          { id: 'banking', label: 'Banking & Salary', icon: CreditCard },
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
      <div className="mt-4 sm:mt-6">

        {/* 1. PERSONAL & FAMILY TAB */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Personal card */}
            <div className="lg:col-span-2 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Personal Details</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openPersonalModal}
                    className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Personal Info
                  </button>
                  {employee.status === 'Inactive' && (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <UserX className="w-3 h-3" /> Exited Employee
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-6 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Full Legal Name</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{employee.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Nationality</span>
                  <span className="text-slate-900 dark:text-white font-semibold">
                    {employee.nationality?.replace(/^Expat\s*[\(-]?\s*/i, '').replace(/\)$/, '').replace(/^Omani$/i, 'OMAN') || 'OMAN'}
                  </span>
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
                  <span className="text-slate-900 dark:text-white font-semibold break-all">{employee.email}</span>
                </div>

                {employee.status === 'Inactive' && (
                  <div className="col-span-1 sm:col-span-2 p-3.5 sm:p-4 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl space-y-1.5 text-xs">
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
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
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
            <div className="lg:col-span-3 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Home className="w-4 sm:w-5 h-4 sm:h-5 text-primary shrink-0" /> Housing & Accommodation Monitoring
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={openHousingModal}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Housing
                  </button>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${employee.housing_status === 'Company Accommodation' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                    {employee.housing_status || 'Lives with Family'}
                  </span>
                </div>
              </div>

              {employee.housing_status === 'Company Accommodation' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Building / Camp Name</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span className="truncate">{employee.accommodation_details?.building_name || 'Al Khuwair Staff Complex'}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Building Address</span>
                    <span className="text-xs font-medium text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">{employee.accommodation_details?.building_address || 'Way 3512, Muscat'}</span>
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider block">Room / Unit #</span>
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 truncate block">
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
                <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-600 dark:text-gray-400">
                  🏡 Employee resides in private accommodation / family residence. No company housing monitoring required.
                </div>
              )}
            </div>

            {/* Family Members card */}
            <div className="lg:col-span-3 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3">Registered Family Dependents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {employee.family_members && employee.family_members.length > 0 ? (
                  employee.family_members.map((member, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                      <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div className="text-xs min-w-0">
                        <div className="text-slate-900 dark:text-white font-bold truncate">{member.name}</div>
                        <div className="text-slate-500 dark:text-gray-400 truncate">Relationship: {member.relation}</div>
                        <div className="text-slate-400 dark:text-gray-500 truncate">Birth Date: {member.dob}</div>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Position details */}
            <div className="lg:col-span-2 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Corporate Placement</h3>
                <button
                  onClick={openJobModal}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Placement & Salary
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-6 text-sm">
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

              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-2 pt-2 sm:pt-4">Compensation & Allowances</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block leading-none mb-1">Base Salary</span>
                    <span className="text-slate-900 dark:text-white font-bold">{employee.base_salary} OMR / month</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl">
                  <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <span className="text-slate-500 dark:text-gray-400 text-[10px] block leading-none mb-1">Allowances</span>
                    <span className="text-slate-900 dark:text-white font-bold">{employee.allowances} OMR / month</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Promotions and Department Transfers logs */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6">
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

        {/* 3. BANKING & SALARY TAB */}
        {activeTab === 'banking' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Bank Account Details Card */}
            <div className="lg:col-span-2 bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-primary shrink-0" /> Bank Account & WPS Direct Deposit
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Used for monthly salary transfers and automated payroll processing</p>
                </div>
                <button
                  onClick={openBankModal}
                  className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit Bank Details
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm">
                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Bank Name</span>
                  <span className="text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                    {employee.bank_name || 'Not Configured (Cash/Cheque)'}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Account Number</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono text-sm sm:text-base tracking-wider break-all">
                    {employee.account_number || 'N/A'}
                  </span>
                </div>

                <div className="sm:col-span-2 p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">IBAN Number (Oman WPS Format)</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono text-xs sm:text-sm tracking-wider break-all">
                    {employee.iban || 'N/A'}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">SWIFT / BIC Code</span>
                  <span className="text-slate-900 dark:text-white font-bold font-mono text-xs sm:text-sm">
                    {employee.swift_code || 'N/A'}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200/80 dark:border-white/10">
                  <span className="text-slate-500 dark:text-gray-400 text-xs block mb-1">Bank Branch Location</span>
                  <span className="text-slate-900 dark:text-white font-bold text-xs sm:text-sm">
                    {employee.branch_name || 'Main Branch, Muscat'}
                  </span>
                </div>
              </div>

              {employee.bank_name && employee.account_number ? (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  Bank account verified & active for Wage Protection System (WPS) direct deposit.
                </div>
              ) : (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-semibold">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>No bank account details configured yet.</span>
                  </div>
                  <button
                    onClick={openBankModal}
                    className="px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    + Add Bank Details
                  </button>
                </div>
              )}
            </div>

            {/* Compensation & Wages Summary Card */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6">
              <h3 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-white/10 pb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Monthly Wage Structure
              </h3>

              <div className="space-y-3 sm:space-y-4 text-xs">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <span className="text-slate-600 dark:text-gray-400 font-medium">Basic Salary</span>
                  <span className="text-slate-900 dark:text-white font-bold text-sm">{employee.base_salary} OMR</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-white/5 rounded-xl">
                  <span className="text-slate-600 dark:text-gray-400 font-medium">Allowances & Benefits</span>
                  <span className="text-slate-900 dark:text-white font-bold text-sm">{employee.allowances} OMR</span>
                </div>

                <div className="flex justify-between items-center p-3.5 bg-primary/10 dark:bg-primary/20 border border-primary/30 rounded-xl text-primary font-bold">
                  <span>Net Monthly Salary</span>
                  <span className="text-base font-black">{employee.base_salary + employee.allowances} OMR</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. QUALIFICATIONS & EXPERIENCE TAB */}
        {activeTab === 'qualifications' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Educational credentials */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary shrink-0" /> Educational Qualifications
                </h3>
                <button
                  onClick={() => setIsQualModalOpen(true)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Qualification
                </button>
              </div>
              {employee.qualifications && employee.qualifications.length > 0 ? (
                employee.qualifications.map((q, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="text-slate-900 dark:text-white font-bold text-sm truncate">{q.degree}</div>
                      <div className="text-slate-500 dark:text-gray-400 truncate">{q.school}</div>
                      <div className="text-primary font-semibold">Graduation Year: {q.year}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteQualification(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove Qualification"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No educational records attached.</div>
              )}
            </div>

            {/* Professional work experience history */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Work Experience History
                </h3>
                <button
                  onClick={() => setIsExpModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Experience
                </button>
              </div>
              {employee.experience && employee.experience.length > 0 ? (
                employee.experience.map((exp, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 min-w-0">
                      <div className="text-slate-900 dark:text-white font-bold text-sm truncate">{exp.role}</div>
                      <div className="text-slate-500 dark:text-gray-400 truncate">Company: {exp.company}</div>
                      <div className="text-emerald-600 dark:text-emerald-400 font-semibold">Period: {exp.period}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteExperience(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="Remove Experience"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No previous work experience recorded.</div>
              )}
            </div>
          </div>
        )}

        {/* 5. PERFORMANCE LEDGER (RECORDS) TAB */}
        {activeTab === 'records' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Bonuses */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary shrink-0" /> Awarded Bonuses & Perks
                </h3>
                <button
                  onClick={() => setIsBonusModalOpen(true)}
                  className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Award Bonus
                </button>
              </div>
              {employee.bonuses && employee.bonuses.length > 0 ? (
                employee.bonuses.map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 sm:p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="text-slate-900 dark:text-white font-bold truncate">Reason: {b.reason}</div>
                      <div className="text-slate-500 dark:text-gray-500">Awarded Date: {b.date}</div>
                    </div>
                    <div className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 shrink-0">+{b.amount} OMR</div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 dark:text-gray-500 text-xs">No bonuses registered for this employee.</div>
              )}
            </div>

            {/* Disciplinary records */}
            <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" /> Disciplinary Violations
                </h3>
                <button
                  onClick={() => setIsDiscModalOpen(true)}
                  className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Warning
                </button>
              </div>
              {employee.disciplinary && employee.disciplinary.length > 0 ? (
                employee.disciplinary.map((d, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 bg-red-500/5 border border-red-500/10 rounded-xl text-xs space-y-1">
                    <div className="flex flex-wrap justify-between items-center gap-1">
                      <span className="text-slate-900 dark:text-white font-bold truncate">{d.violation}</span>
                      <span className="text-red-600 dark:text-red-400 font-medium bg-red-500/10 px-2 py-0.5 rounded shrink-0">{d.action}</span>
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

        {/* 6. OFFICIAL DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="bg-white dark:bg-white/5 p-4 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Official Document Locker</h3>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Manage Civil IDs, Passports, Residence Work Visas & Visit Visas</p>
              </div>
              <button
                onClick={() => setIsDocModalOpen(true)}
                className="px-4 py-2 bg-primary hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-primary/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Upload New Document
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
              {employee.documents && employee.documents.length > 0 ? (
                employee.documents.map((doc) => (
                  <div key={doc.id} className="p-3.5 sm:p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight truncate">{doc.name}</span>
                        {getDocStatusBadge(doc.expiryDate)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-gray-400 mt-1">Classification: <span className="font-semibold text-slate-800 dark:text-gray-200">{doc.type}</span></div>
                      {doc.expiryDate && (
                        <div className="text-[10px] text-slate-400 dark:text-gray-500 mt-2">Expiry Date: <span className="font-semibold">{doc.expiryDate}</span></div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 pt-3 border-t border-slate-200/60 dark:border-white/10">
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="flex-1 min-w-[65px] text-xs font-semibold text-primary hover:text-emerald-600 dark:hover:text-emerald-400 py-1.5 sm:py-2 border border-slate-200 dark:border-white/10 hover:border-primary/30 bg-white dark:bg-white/5 hover:bg-primary/5 rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1"
                        title="View Document Details & Preview"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                      <button
                        onClick={() => {
                          if (doc.attachedFile && doc.attachedFile.startsWith('data:')) {
                            const link = document.createElement('a');
                            link.href = doc.attachedFile;
                            link.download = `${doc.name.replace(/\s+/g, '_')}_Document`;
                            link.click();
                          } else {
                            alert(`Document record: ${doc.name}\nRef: ${doc.number || 'N/A'}\nValid until: ${doc.expiryDate || 'N/A'}`);
                          }
                        }}
                        className="px-2.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-white/10 hover:border-slate-300 bg-white dark:bg-white/5 rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        title="Download Copy"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setRenewalDocTarget(doc)}
                        className="px-2.5 py-1.5 sm:py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-white border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        title="Renew Document"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Renew
                      </button>
                      <button
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 dark:text-gray-500 text-xs col-span-1 sm:col-span-2 xl:col-span-3 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                  No official documents attached yet. Click <strong>Upload New Document</strong> above to add Visas, Civil IDs, Passports or Contracts.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. LEAVES TAB */}
        {activeTab === 'leaves' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2 sm:mb-4">Active Leaves & Balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-6">

              <div className="bg-white dark:bg-white/5 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center mb-3 sm:mb-4 border-4 border-primary">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.yearly}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-1">Annual Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Total allowance: 30 days / year</p>
              </div>

              <div className="bg-white dark:bg-white/5 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center mb-3 sm:mb-4 border-4 border-amber-500">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.sick}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-1">Sick Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Paid scale rules applied</p>
              </div>

              <div className="bg-white dark:bg-white/5 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center mb-3 sm:mb-4 border-4 border-blue-400">
                  <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{employee.leave_balances.pregnancy}</span>
                  <span className="text-[9px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider">Days Available</span>
                </div>
                <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-1">Maternity Leave</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400">Eligible female employees only</p>
              </div>

            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-3 mt-6 sm:mt-8">Recent Leave Applications</h3>
            <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="p-3.5 sm:p-4 pl-4 sm:pl-6">Leave Type</th>
                      <th className="p-3.5 sm:p-4">Requested Dates</th>
                      <th className="p-3.5 sm:p-4">Approval Flow Status</th>
                      <th className="p-3.5 sm:p-4 pr-4 sm:pr-6">Attachments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {userLeaves.length > 0 ? (
                      userLeaves.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-xs">
                          <td className="p-3.5 sm:p-4 pl-4 sm:pl-6">
                            <div className="font-semibold text-slate-900 dark:text-white">{req.type} Leave</div>
                          </td>
                          <td className="p-3.5 sm:p-4">
                            <div className="text-slate-600 dark:text-gray-300">{req.start} to {req.end}</div>
                          </td>
                          <td className="p-3.5 sm:p-4">
                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                              req.status === 'Rejected' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                                'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="p-3.5 sm:p-4 pr-4 sm:pr-6">
                            {req.documentUrl ? (
                              <button className="text-primary hover:underline font-semibold cursor-pointer">Download Certificate</button>
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
          </div>
        )}

        {/* 7. SHIFT LOGS (ATTENDANCE) TAB */}
        {activeTab === 'attendance' && (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Month & Year Selection Bar */}
            <div className="bg-white dark:bg-white/5 p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary shrink-0" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                  Attendance Calendar ({MONTH_NAMES[selectedMonth]} {selectedYear})
                </h3>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 sm:p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-white transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setSelectedCalendarDate(null);
                  }}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 text-slate-900 dark:text-white text-xs font-bold outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setSelectedCalendarDate(null);
                  }}
                  className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-2.5 sm:px-3 py-1.5 text-slate-900 dark:text-white text-xs font-bold outline-none cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                      {y}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 sm:p-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-700 dark:text-white transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!employee) return;
                    generateMonthlyAttendanceReport({
                      employee: {
                        id: employee.id,
                        name: employee.name,
                        email: employee.email,
                        phone: employee.phone,
                        job_title: employee.job_title || employee.role,
                        department: employee.department,
                        company: employee.company,
                        nationality: employee.nationality,
                        join_date: employee.join_date,
                        avatar_url: employee.avatar_url,
                      },
                      companyName: employee.company || 'OSAN GROUP',
                      monthIndex: selectedMonth,
                      year: selectedYear,
                      shiftStart: (employee.nationality === 'OMAN' || employee.nationality === 'Omani') ? '08:30 AM' : '08:30 AM',
                      shiftEnd: (employee.nationality === 'OMAN' || employee.nationality === 'Omani') ? '05:00 PM' : '06:00 PM',
                      dailyLogs: monthlyHeatmapData,
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ml-1 sm:ml-2"
                  title={`Download Official ${MONTH_NAMES[selectedMonth]} ${selectedYear} Attendance Sheet`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download Attendance Sheet</span>
                  <span className="sm:hidden">Report</span>
                </button>
              </div>
            </div>

            {/* Monthly Dynamic Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-white/5 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">On-Time Days</div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{monthlyStats.onTime}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-500 mt-1">{MONTH_NAMES[selectedMonth]} {selectedYear}</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Late Warnings</div>
                <div className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400">{monthlyStats.late}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-500 mt-1">{MONTH_NAMES[selectedMonth]} {selectedYear}</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Absences</div>
                <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{monthlyStats.absent}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-500 mt-1">Unexcused</div>
              </div>
              <div className="bg-white dark:bg-white/5 p-3.5 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="text-slate-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-1">Hours Logged</div>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{monthlyStats.totalHours}h</div>
                <div className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-500 mt-1">Completed this month</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Monthly Calendar Heatmap Grid */}
              <div className="xl:col-span-1 bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {MONTH_NAMES[selectedMonth]} {selectedYear} Heatmap Grid
                    </h3>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 mb-4">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                      <div key={`${day}-${idx}`} className="text-center text-[10px] font-bold text-slate-400 dark:text-gray-500 mb-1">{day}</div>
                    ))}

                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`pad-${i}`} className="aspect-square rounded-xl bg-transparent" />
                    ))}

                    {monthlyHeatmapData.map((data, i) => {
                      const isSelectedDate = selectedCalendarDate === data.dateStr;
                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedCalendarDate(isSelectedDate ? null : data.dateStr)}
                          title={`${data.dateStr}: ${data.status.toUpperCase()} (Click to filter log feed)`}
                          className={`aspect-square rounded-lg border flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${getHeatmapColor(data.status)} ${
                            isSelectedDate ? 'ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110' : ''
                          }`}
                        >
                          <span>{data.dayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Heatmap Status Legend */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center justify-between text-[10px] font-semibold text-slate-500 dark:text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Present</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Late</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Absent</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span> Public Holiday</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Leave</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700"></span> Off</span>
                </div>
              </div>

              {/* Attendance Log Feed Table for Selected Month */}
              <div className="xl:col-span-2 bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden flex flex-col">
                <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Attendance Log Feed — {MONTH_NAMES[selectedMonth]} {selectedYear}
                    </h3>
                    {selectedCalendarDate && (
                      <p className="text-xs font-bold text-primary">
                        Filtered for Date: {selectedCalendarDate}
                      </p>
                    )}
                  </div>
                  {selectedCalendarDate && (
                    <button
                      onClick={() => setSelectedCalendarDate(null)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase">
                      <tr>
                        <th className="p-4 pl-6">Date</th>
                        <th className="p-4">Punch In</th>
                        <th className="p-4">Punch Out</th>
                        <th className="p-4">Shift Hours</th>
                        <th className="p-4 pr-6 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                      {monthlyHeatmapData
                        .filter(d => (!selectedCalendarDate || d.dateStr === selectedCalendarDate) && d.status !== 'weekend')
                        .map((log) => {
                          const formattedDate = log.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                          return (
                            <tr key={log.dateStr} className={`hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${selectedCalendarDate === log.dateStr ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                              <td className="p-4 pl-6 font-bold text-slate-900 dark:text-white">
                                {formattedDate}
                              </td>
                              <td className="p-4 font-mono text-slate-600 dark:text-gray-300">
                                {log.clockInText}
                              </td>
                              <td className="p-4 font-mono text-slate-600 dark:text-gray-300">
                                {log.clockOutText}
                              </td>
                              <td className="p-4 text-slate-600 dark:text-gray-300 font-semibold font-mono">
                                {log.shiftDurationText}
                              </td>
                              <td className="p-4 pr-6 text-right">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                                  log.status === 'present' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                  log.status === 'late' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                  log.status === 'absent' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                                  log.status === 'holiday' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20' :
                                  'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                }`}>
                                  {log.status === 'present' ? 'Present' : log.status === 'late' ? 'Late Warning' : log.status === 'absent' ? 'Absent' : log.status === 'holiday' ? (log.holidayName || 'Public Holiday') : 'Approved Leave'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Manage Status</h2>
              </div>
              <button
                onClick={() => { setIsManageModalOpen(false); setConfirmDelete(false); }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 sm:space-y-6">
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
                    className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 dark:bg-red-500/20 dark:hover:bg-red-500/30 border border-red-500/30 text-red-600 dark:text-red-400 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                    className="w-full py-2.5 bg-primary hover:bg-emerald-600 text-white font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
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
                        className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[10px] uppercase transition-colors cursor-pointer"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full py-2.5 bg-transparent hover:bg-red-500/10 border border-dashed border-red-500/30 hover:border-red-500 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
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

      {/* Edit Bank Account Details Modal */}
      {isBankModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" /> Edit Bank Account Details
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Update employee salary transfer bank account for {employee.name}</p>
              </div>
              <button
                onClick={() => setIsBankModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBankDetails} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Bank Name</label>
                <input
                  type="text"
                  required
                  value={bankForm.bank_name}
                  onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  placeholder="e.g. Bank Muscat"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Account Number</label>
                <input
                  type="text"
                  required
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  placeholder="e.g. 0423010098760012"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">IBAN Number (Oman WPS Format)</label>
                <input
                  type="text"
                  value={bankForm.iban}
                  onChange={(e) => setBankForm({ ...bankForm, iban: e.target.value })}
                  placeholder="e.g. OM68001000423010098760012"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">SWIFT / BIC Code</label>
                  <input
                    type="text"
                    value={bankForm.swift_code}
                    onChange={(e) => setBankForm({ ...bankForm, swift_code: e.target.value })}
                    placeholder="e.g. BKOMOMRX"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Branch Name</label>
                  <input
                    type="text"
                    value={bankForm.branch_name}
                    onChange={(e) => setBankForm({ ...bankForm, branch_name: e.target.value })}
                    placeholder="e.g. Ghala Branch"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button
                  type="button"
                  onClick={() => setIsBankModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBank}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-emerald-600 text-white font-bold shadow-lg shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingBank ? 'Saving...' : 'Save Bank Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1. Edit Personal Details Modal */}
      {isPersonalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Edit Personal Information
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Update personal records for {employee.name}</p>
              </div>
              <button onClick={() => setIsPersonalModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePersonal} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={personalForm.name}
                  onChange={(e) => setPersonalForm({ ...personalForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Phone Contact</label>
                  <input
                    type="text"
                    value={personalForm.phone}
                    onChange={(e) => setPersonalForm({ ...personalForm, phone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Email Account *</label>
                  <input
                    type="email"
                    required
                    value={personalForm.email}
                    onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Nationality Category</label>
                  <select
                    value={personalForm.nationality?.startsWith('Expat') ? 'Expat' : 'OMAN'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPersonalForm({ 
                        ...personalForm, 
                        nationality: val === 'OMAN' ? 'OMAN' : (personalForm.nationality?.startsWith('Expat') ? personalForm.nationality : 'Expat')
                      });
                    }}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                  >
                    <option value="OMAN">OMAN</option>
                    <option value="Expat">Expat</option>
                  </select>
                </div>

                {personalForm.nationality?.startsWith('Expat') && (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">🌍 Country Name</label>
                    <input
                      type="text"
                      value={personalForm.nationality.includes('(') ? personalForm.nationality.split('(')[1]?.replace(')', '') : ''}
                      onChange={(e) => setPersonalForm({ ...personalForm, nationality: e.target.value.trim() ? `Expat (${e.target.value.trim()})` : 'Expat' })}
                      placeholder="e.g. India, Philippines, Egypt..."
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Gender</label>
                  <select
                    value={personalForm.gender}
                    onChange={(e) => setPersonalForm({ ...personalForm, gender: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Religion</label>
                  <select
                    value={personalForm.religion}
                    onChange={(e) => setPersonalForm({ ...personalForm, religion: e.target.value as any })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                  >
                    <option value="Muslim">Muslim</option>
                    <option value="Non-Muslim">Non-Muslim</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsPersonalModalOpen(false)} className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingPersonal} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingPersonal ? 'Saving...' : 'Save Personal Info'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Placement & Salary Modal */}
      {isJobModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" /> Edit Placement & Wage Structure
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Update designation, department, and salary for {employee.name}</p>
              </div>
              <button onClick={() => setIsJobModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveJob} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Job Designation</label>
                  <input
                    type="text"
                    required
                    value={jobForm.job_title}
                    onChange={(e) => setJobForm({ ...jobForm, job_title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Department</label>
                  <input
                    type="text"
                    required
                    value={jobForm.department}
                    onChange={(e) => setJobForm({ ...jobForm, department: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Immediate Supervisor</label>
                <input
                  type="text"
                  value={jobForm.supervisor_name}
                  onChange={(e) => setJobForm({ ...jobForm, supervisor_name: e.target.value })}
                  placeholder="Supervisor's Full Name"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Base Salary (OMR)</label>
                  <input
                    type="number"
                    required
                    value={jobForm.base_salary}
                    onChange={(e) => setJobForm({ ...jobForm, base_salary: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Allowances (OMR)</label>
                  <input
                    type="number"
                    required
                    value={jobForm.allowances}
                    onChange={(e) => setJobForm({ ...jobForm, allowances: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsJobModalOpen(false)} className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingJob} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingJob ? 'Saving...' : 'Save Placement & Salary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Edit Housing & Accommodation Modal */}
      {isHousingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary" /> Edit Housing & Accommodation
                </h3>
                <p className="text-xs text-slate-500 dark:text-gray-400">Configure housing arrangement for {employee.name}</p>
              </div>
              <button onClick={() => setIsHousingModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHousing} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Housing Arrangement Type</label>
                <select
                  value={housingForm.housing_status}
                  onChange={(e) => setHousingForm({ ...housingForm, housing_status: e.target.value as any })}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none cursor-pointer"
                >
                  <option value="Lives with Family">Lives with Family / Private Residence</option>
                  <option value="Company Accommodation">Company Shared Accommodation / Staff Camp</option>
                  <option value="Private Rental">Private Rental Residence</option>
                </select>
              </div>

              {housingForm.housing_status === 'Company Accommodation' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Building / Camp Name</label>
                    <input
                      type="text"
                      value={housingForm.building_name}
                      onChange={(e) => setHousingForm({ ...housingForm, building_name: e.target.value })}
                      placeholder="e.g. Al Khuwair Staff Complex"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Building Address</label>
                    <input
                      type="text"
                      value={housingForm.building_address}
                      onChange={(e) => setHousingForm({ ...housingForm, building_address: e.target.value })}
                      placeholder="e.g. Way 3512, Al Khuwair, Muscat"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Room / Unit #</label>
                      <input
                        type="text"
                        value={housingForm.room_number}
                        onChange={(e) => setHousingForm({ ...housingForm, room_number: e.target.value })}
                        placeholder="e.g. Flat 102"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Occupancy Count</label>
                      <input
                        type="number"
                        value={housingForm.occupancy_count}
                        onChange={(e) => setHousingForm({ ...housingForm, occupancy_count: Number(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsHousingModalOpen(false)} className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingHousing} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingHousing ? 'Saving...' : 'Save Housing Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Educational Qualification Modal */}
      {isQualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Add Educational Qualification</h2>
              </div>
              <button onClick={() => setIsQualModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQualification} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Degree / Certificate Title *</label>
                <input
                  type="text"
                  required
                  value={qualForm.degree}
                  onChange={(e) => setQualForm({ ...qualForm, degree: e.target.value })}
                  placeholder="e.g. Bachelor of Business Administration"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">University / School Name</label>
                <input
                  type="text"
                  value={qualForm.school}
                  onChange={(e) => setQualForm({ ...qualForm, school: e.target.value })}
                  placeholder="e.g. Sultan Qaboos University"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Graduation Year</label>
                <input
                  type="text"
                  value={qualForm.year}
                  onChange={(e) => setQualForm({ ...qualForm, year: e.target.value })}
                  placeholder="e.g. 2022"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsQualModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingQual} className="px-5 py-2 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingQual ? 'Saving...' : 'Add Qualification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Work Experience Modal */}
      {isExpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Add Work Experience</h2>
              </div>
              <button onClick={() => setIsExpModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExperience} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Company / Organization *</label>
                <input
                  type="text"
                  required
                  value={expForm.company}
                  onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                  placeholder="e.g. Petroleum Development Oman"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Job Designation / Role</label>
                <input
                  type="text"
                  value={expForm.role}
                  onChange={(e) => setExpForm({ ...expForm, role: e.target.value })}
                  placeholder="e.g. Senior Operations Officer"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Duration / Period</label>
                <input
                  type="text"
                  value={expForm.period}
                  onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                  placeholder="e.g. Jan 2021 – Present (3 yrs)"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsExpModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingExp} className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingExp ? 'Saving...' : 'Add Experience'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Award Bonus Modal */}
      {isBonusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Award Bonus or Perk</h2>
              </div>
              <button onClick={() => setIsBonusModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBonus} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Reason / Achievement *</label>
                <input
                  type="text"
                  required
                  value={bonusForm.reason}
                  onChange={(e) => setBonusForm({ ...bonusForm, reason: e.target.value })}
                  placeholder="e.g. Q3 Sales Goal Milestone & Employee of the Month"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Bonus Amount (OMR)</label>
                  <input
                    type="number"
                    required
                    value={bonusForm.amount}
                    onChange={(e) => setBonusForm({ ...bonusForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Award Date</label>
                  <input
                    type="date"
                    required
                    value={bonusForm.date}
                    onChange={(e) => setBonusForm({ ...bonusForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsBonusModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingBonus} className="px-5 py-2 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingBonus ? 'Saving...' : 'Award Bonus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Disciplinary Warning Modal */}
      {isDiscModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Log Disciplinary Violation</h2>
              </div>
              <button onClick={() => setIsDiscModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDisciplinary} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Violation Details *</label>
                <input
                  type="text"
                  required
                  value={discForm.violation}
                  onChange={(e) => setDiscForm({ ...discForm, violation: e.target.value })}
                  placeholder="e.g. Unexcused Absence or Policy Non-compliance"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-red-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Action Taken</label>
                  <select
                    value={discForm.action}
                    onChange={(e) => setDiscForm({ ...discForm, action: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-red-500 cursor-pointer"
                  >
                    <option value="Verbal Warning" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Verbal Warning</option>
                    <option value="First Written Warning" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">First Written Warning</option>
                    <option value="Final Warning" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Final Warning</option>
                    <option value="Salary Deduction" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Salary Deduction</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Incident Date</label>
                  <input
                    type="date"
                    required
                    value={discForm.date}
                    onChange={(e) => setDiscForm({ ...discForm, date: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-red-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsDiscModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingDisc} className="px-5 py-2 rounded-xl bg-red-600 text-white font-bold cursor-pointer disabled:opacity-50">
                  {isSavingDisc ? 'Saving...' : 'Log Violation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload New Document Modal */}
      {isDocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Upload New Official Document</h2>
              </div>
              <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Document Classification / Category *</label>
                <select
                  value={docForm.type}
                  onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-primary cursor-pointer"
                >
                  <option value="Work Visa (Residence)" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Work Visa / Residence Permit</option>
                  <option value="Visit Visa / Entry Permit" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Visit Visa / Express Entry Permit</option>
                  <option value="Civil ID / Resident Card" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Civil ID / Resident Card</option>
                  <option value="Passport Copy" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Passport Copy</option>
                  <option value="Employment Contract" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Labor / Employment Contract</option>
                  <option value="Educational Certificate" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Educational Degree / Certificate</option>
                  <option value="Medical / Health Check" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Medical Fitness / Health Check</option>
                  <option value="Other Official Document" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Document Title / Description *</label>
                <input
                  type="text"
                  required
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  placeholder="e.g. Oman Work Residence Visa (2026-2028)"
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Document Number / Ref</label>
                  <input
                    type="text"
                    value={docForm.docNumber}
                    onChange={(e) => setDocForm({ ...docForm, docNumber: e.target.value })}
                    placeholder="e.g. WV-991823"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={docForm.expiryDate}
                    onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-gray-300 mb-1">Attach File (PDF, PNG, JPG)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setDocForm(prev => ({ ...prev, attachedFile: reader.result as string }));
                      };
                      reader.readAsDataURL(selected);
                    }
                  }}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl p-2 text-slate-900 dark:text-white outline-none text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-emerald-600 cursor-pointer"
                />
                {docForm.attachedFile && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-1">
                    ✓ File attached & ready for preview
                  </span>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10 justify-end">
                <button type="button" onClick={() => setIsDocModalOpen(false)} className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 cursor-pointer font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingDoc} className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold cursor-pointer disabled:opacity-50 shadow-md shadow-primary/20">
                  {isSavingDoc ? 'Uploading...' : 'Save & Attach Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Interactive Document Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            {/* Viewer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                    {viewingDoc.name}
                    {getDocStatusBadge(viewingDoc.expiryDate)}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    {employee?.name} &bull; {viewingDoc.type} {viewingDoc.number ? `(#${viewingDoc.number})` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Viewer Content / Preview Area */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Document Meta Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-white/5 p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-[10px] uppercase font-bold block">Document Type</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{viewingDoc.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-[10px] uppercase font-bold block">Expiry Date</span>
                  <span className="font-semibold text-slate-800 dark:text-gray-200">{viewingDoc.expiryDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-gray-400 text-[10px] uppercase font-bold block">Document Reference</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-gray-200">{viewingDoc.number || 'N/A'}</span>
                </div>
              </div>

              {/* Preview Container */}
              <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-slate-100 dark:bg-black/30 min-h-[260px] flex items-center justify-center">
                {viewingDoc.attachedFile && viewingDoc.attachedFile.startsWith('data:image') ? (
                  <img
                    src={viewingDoc.attachedFile}
                    alt={viewingDoc.name}
                    className="max-h-[500px] w-auto max-w-full object-contain mx-auto rounded-lg shadow-sm"
                  />
                ) : viewingDoc.attachedFile && viewingDoc.attachedFile.startsWith('data:application/pdf') ? (
                  <iframe
                    src={viewingDoc.attachedFile}
                    title={viewingDoc.name}
                    className="w-full h-[450px] border-0 rounded-lg"
                  />
                ) : (
                  /* Elegant Official Record Certificate */
                  <div className="p-8 text-center space-y-4 max-w-md w-full">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center border border-primary/20 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-base">
                        {viewingDoc.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                        Official verified document record in OSAN HR System
                      </p>
                    </div>
                    <div className="bg-white dark:bg-white/5 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 text-left text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Employee:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{employee?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Classification:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{viewingDoc.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Valid Until:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{viewingDoc.expiryDate || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Document Number:</span>
                        <span className="font-mono text-slate-800 dark:text-gray-300">{viewingDoc.number || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Viewer Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/5">
              <button
                onClick={() => {
                  setRenewalDocTarget(viewingDoc);
                  setViewingDoc(null);
                }}
                className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Renew This Document
              </button>

              <div className="flex items-center gap-2">
                {viewingDoc.attachedFile && viewingDoc.attachedFile.startsWith('data:') && (
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = viewingDoc.attachedFile;
                      link.download = `${viewingDoc.name.replace(/\s+/g, '_')}_Document`;
                      link.click();
                    }}
                    className="px-4 py-2 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download File
                  </button>
                )}
                <button
                  onClick={() => setViewingDoc(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl font-semibold text-xs cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
