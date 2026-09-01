import { useState, useRef, useEffect } from 'react';
import { X, UserPlus, Loader2, DollarSign, Calendar, Compass, GraduationCap, Briefcase, Paperclip, Phone, Mail, Check, MessageSquare } from 'lucide-react';
import type { Role, Nationality, User } from '../../types';
import { sendEmployeeWhatsAppInvite } from '../../lib/whatsappService';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: { name: string; authPolicy?: string }[];
  onAdd: (employee: Partial<User>) => Promise<void>;
}

export function AddEmployeeModal({ isOpen, onClose, companies, onAdd }: AddEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    companyPhone: '',
    role: 'Employee' as Role,
    company: companies[0]?.name || '',
    nationality: 'Omani' as Nationality,
    gender: 'Male' as 'Male' | 'Female',
    religion: 'Muslim' as 'Muslim' | 'Non-Muslim',
    joinDate: new Date().toISOString().split('T')[0],
    baseSalary: 800,
    allowances: 150,
    jobTitle: '',
    department: '',
    supervisorName: '',
    housingStatus: 'Lives with Family' as 'Lives with Family' | 'Company Accommodation',
    buildingName: '',
    buildingAddress: '',
    roomNumber: '',
    occupancyCount: 4,
    degree: '',
    school: '',
    gradYear: '',
    prevCompany: '',
    prevRole: '',
    prevPeriod: '',
    emergencyName: '',
    emergencyPhone: '',
    bankName: '',
    accountNumber: '',
    iban: '',
    swiftCode: '',
    branchName: ''
  });

  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [residencyFile, setResidencyFile] = useState<File | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);

  const [academicFile, setAcademicFile] = useState<File | null>(null);
  const [experienceFile, setExperienceFile] = useState<File | null>(null);

  const passportRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const residencyRef = useRef<HTMLInputElement>(null);
  const contractRef = useRef<HTMLInputElement>(null);
  const academicRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdEmpInfo, setCreatedEmpInfo] = useState<{
    name: string;
    email: string;
    phone?: string;
    company: string;
    pin: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        company: companies[0]?.name || ''
      }));
      setCreatedEmpInfo(null);
    }
  }, [isOpen, companies]);

  if (!isOpen) return null;

  const selectedCompObj = companies.find(c => c.name === formData.company);
  const activeCompanyPolicy = selectedCompObj?.authPolicy || 'both';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.company) return;

    if (activeCompanyPolicy === 'email' && !formData.email.trim()) {
      alert('Email Address is required under this company\'s Email Only authentication policy.');
      return;
    }
    if (activeCompanyPolicy === 'phone' && !formData.phone.trim()) {
      alert('Personal Mobile is required under this company\'s Phone & PIN authentication policy.');
      return;
    }
    if (activeCompanyPolicy === 'both' && !formData.email.trim() && !formData.phone.trim()) {
      alert('Please fill out either Email Address or Phone Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const docsList = [
        { id: '1', name: 'Passport', type: 'Official ID', expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 5)).toISOString().split('T')[0], attachedFile: passportFile?.name },
        { id: '2', name: 'National ID Card', type: 'Official ID', expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0], attachedFile: idCardFile?.name },
        { id: '3', name: 'Residency Permit', type: 'Official ID', expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0], attachedFile: residencyFile?.name },
        { id: '4', name: 'Employment Contract', type: 'Agreement', expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0], attachedFile: contractFile?.name }
      ];

      const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();

      const submissionData = {
        name: formData.name,
        email: activeCompanyPolicy === 'phone' ? `placeholder-${Math.random().toString(36).substring(2, 7)}@osan-placeholder.com` : formData.email,
        phone: activeCompanyPolicy === 'email' ? undefined : formData.phone,
        company_phone: formData.companyPhone,
        role: formData.role,
        company: formData.company,
        nationality: formData.nationality,
        gender: formData.gender,
        religion: formData.religion,
        join_date: formData.joinDate,
        base_salary: Number(formData.baseSalary) || 0,
        allowances: Number(formData.allowances) || 0,
        job_title: formData.jobTitle || 'Officer',
        department: formData.department || 'Operations',
        supervisor_name: formData.supervisorName || 'N/A',
        housing_status: formData.housingStatus,
        accommodation_details: formData.housingStatus === 'Company Accommodation' ? {
          building_name: formData.buildingName || 'Al Khuwair Staff Complex',
          building_address: formData.buildingAddress || 'Way 3512, Al Khuwair, Muscat',
          room_number: formData.roomNumber || 'Room 102',
          occupancy_count: Number(formData.occupancyCount) || 4
        } : undefined,
        bank_name: formData.bankName,
        account_number: formData.accountNumber,
        iban: formData.iban,
        swift_code: formData.swiftCode,
        branch_name: formData.branchName,
        pin: generatedPin,
        
        qualifications: formData.degree ? [
          { degree: formData.degree, school: formData.school, year: formData.gradYear, attachedCertificate: academicFile?.name }
        ] : [],
        
        experience: formData.prevCompany ? [
          { company: formData.prevCompany, role: formData.prevRole, period: formData.prevPeriod, attachedCertificate: experienceFile?.name }
        ] : [],
        
        family_members: formData.housingStatus === 'Lives with Family' ? [
          { name: 'Family Dependent', relation: 'Spouse', dob: '1996-01-01' }
        ] : [],
        
        emergency_contacts: formData.emergencyName ? [
          { name: formData.emergencyName, relation: "Parent's Contact", phone: formData.emergencyPhone }
        ] : [],
        
        promotions: [],
        disciplinary: [],
        bonuses: [],
        transfers: [],
        documents: docsList
      };

      await onAdd(submissionData);
      
      setCreatedEmpInfo({
        name: submissionData.name,
        email: submissionData.email,
        phone: submissionData.phone,
        company: submissionData.company,
        pin: generatedPin
      });

      setFormData({
        name: '',
        email: '',
        phone: '',
        companyPhone: '',
        role: 'Employee',
        company: companies[0]?.name || '',
        nationality: 'Omani',
        gender: 'Male',
        religion: 'Muslim',
        joinDate: new Date().toISOString().split('T')[0],
        baseSalary: 800,
        allowances: 150,
        jobTitle: '',
        department: '',
        supervisorName: '',
        housingStatus: 'Lives with Family',
        buildingName: '',
        buildingAddress: '',
        roomNumber: '',
        occupancyCount: 4,
        degree: '',
        school: '',
        gradYear: '',
        prevCompany: '',
        prevRole: '',
        prevPeriod: '',
        emergencyName: '',
        emergencyPhone: '',
        bankName: '',
        accountNumber: '',
        iban: '',
        swiftCode: '',
        branchName: ''
      });
      setPassportFile(null);
      setIdCardFile(null);
      setResidencyFile(null);
      setContractFile(null);
      setAcademicFile(null);
      setExperienceFile(null);
    } catch (error) {
      console.error(error);
      alert('Failed to add employee. Please check inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdEmpInfo) {
    const isPhoneAuth = activeCompanyPolicy === 'phone' || (activeCompanyPolicy === 'both' && createdEmpInfo.phone);

    const handleWhatsAppShare = () => {
      sendEmployeeWhatsAppInvite({
        name: createdEmpInfo.name,
        phone: createdEmpInfo.phone,
        email: createdEmpInfo.email,
        company: createdEmpInfo.company,
        pin: createdEmpInfo.pin
      });
    };

    const handleCloseAll = () => {
      setCreatedEmpInfo(null);
      onClose();
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="absolute inset-0 transition-opacity" onClick={handleCloseAll} />
        
        <div className="relative bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 text-center overflow-hidden">
          <div className="w-16 h-16 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <Check className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Employee Profile Created!</h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">Credentials generated successfully for {createdEmpInfo.name}</p>

          <div className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl p-4 text-left text-xs space-y-3 mb-6">
            <div>
              <span className="text-slate-500 dark:text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">Access Method</span>
              <span className="text-slate-900 dark:text-white font-bold">{isPhoneAuth ? 'Phone Number & Security PIN' : 'Email & Security PIN / Google Auth'}</span>
            </div>
            
            {createdEmpInfo.phone && (
              <div>
                <span className="text-slate-500 dark:text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">Registered Phone</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold text-sm">{createdEmpInfo.phone}</span>
              </div>
            )}

            {createdEmpInfo.email && (
              <div>
                <span className="text-slate-500 dark:text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">Registered Email</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold">{createdEmpInfo.email}</span>
              </div>
            )}

            <div>
              <span className="text-slate-500 dark:text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">6-Digit Security PIN</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-base tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block">{createdEmpInfo.pin}</span>
            </div>

            <div>
              <span className="text-slate-500 dark:text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[10px]">PWA Portal URL</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono break-all font-semibold">https://one.osangroupoman.com</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <MessageSquare className="w-4 h-4" /> Share Credentials via WhatsApp
            </button>

            <button
              type="button"
              onClick={handleCloseAll}
              className="w-full py-2.5 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-xs font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-2xl p-6 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl">
              <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add New Employee</h2>
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Fill out complete Electronic File components</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-slate-700 dark:text-gray-400 dark:hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          
          {/* SECTION A: Primary Assignment */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Placement & Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Company Assignment *</label>
                <select
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary appearance-none transition-all"
                >
                  {companies.map(c => (
                    <option key={c.name} value={c.name} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION B: Contact Credentials */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Contacts & Credentials</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeCompanyPolicy !== 'phone' && (
                <div className={activeCompanyPolicy === 'email' ? 'col-span-3' : 'col-span-1'}>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Email Address {activeCompanyPolicy === 'email' && '*'}
                  </label>
                  <input
                    type="email"
                    required={activeCompanyPolicy === 'email'}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                  />
                </div>
              )}

              {activeCompanyPolicy !== 'email' && (
                <div className={activeCompanyPolicy === 'phone' ? 'col-span-3' : 'col-span-1'}>
                  <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Personal Mobile {activeCompanyPolicy === 'phone' && '*'}
                  </label>
                  <input
                    type="tel"
                    required={activeCompanyPolicy === 'phone'}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. 96891234567"
                    className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                  />
                </div>
              )}

              <div className={activeCompanyPolicy === 'both' ? 'col-span-1' : 'col-span-3'}>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Company Mobile
                </label>
                <input
                  type="tel"
                  value={formData.companyPhone}
                  onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                  placeholder="e.g. 96891234000"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: Job Profile, Supervisors & Compensation */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Placement Details & Wages</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Job Designation</label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  placeholder="e.g. Senior Specialist"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g. Technology"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Direct Supervisor</label>
                <input
                  type="text"
                  value={formData.supervisorName}
                  onChange={(e) => setFormData({ ...formData, supervisorName: e.target.value })}
                  placeholder="Supervisor's Name"
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.joinDate}
                  onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Base Salary (OMR) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.baseSalary}
                  onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary font-bold transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Allowance / Benefits (OMR) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.allowances}
                  onChange={(e) => setFormData({ ...formData, allowances: Number(e.target.value) })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary font-bold transition-all"
                />
              </div>
            </div>

            {/* Optional Bank Account Details */}
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
                  💳 Bank Account Information <span className="text-[10px] text-slate-400 font-normal">(Optional for WPS Salary Transfers)</span>
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-0.5">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="e.g. Bank Muscat"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-0.5">Account Number</label>
                  <input
                    type="text"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    placeholder="e.g. 0423010098760012"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-gray-400 mb-0.5">IBAN Number</label>
                  <input
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    placeholder="e.g. OM68001000423010098760012"
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">Nationality Category</label>
                <select
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value as Nationality })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary appearance-none transition-all"
                >
                  <option value="Omani" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Omani</option>
                  <option value="Expat" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Expat</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400 mb-1">System Privilege</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-primary appearance-none transition-all"
                >
                  <option value="Employee" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Employee</option>
                  <option value="HR" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">HR Admin</option>
                  <option value="Accountant" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Accountant</option>
                  <option value="CEO" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">CEO</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2">
                <span className="text-[11px] text-slate-700 dark:text-gray-400 font-bold">Gender</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-900 dark:text-white font-semibold">
                    <input
                      type="radio"
                      name="gender"
                      value="Male"
                      checked={formData.gender === 'Male'}
                      onChange={() => setFormData({ ...formData, gender: 'Male' })}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Male
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-900 dark:text-white font-semibold">
                    <input
                      type="radio"
                      name="gender"
                      value="Female"
                      checked={formData.gender === 'Female'}
                      onChange={() => setFormData({ ...formData, gender: 'Female' })}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Female
                  </label>
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2">
                <span className="text-[11px] text-slate-700 dark:text-gray-400 font-bold">Religion</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-900 dark:text-white font-semibold">
                    <input
                      type="radio"
                      name="religion"
                      value="Muslim"
                      checked={formData.religion === 'Muslim'}
                      onChange={() => setFormData({ ...formData, religion: 'Muslim' })}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Muslim
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-900 dark:text-white font-semibold">
                    <input
                      type="radio"
                      name="religion"
                      value="Non-Muslim"
                      checked={formData.religion === 'Non-Muslim'}
                      onChange={() => setFormData({ ...formData, religion: 'Non-Muslim' })}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    Non-Muslim
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION D: Academic Qualifications & Experience */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Academic & Job Background</h3>
            
            {/* Academic */}
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <GraduationCap className="w-4 h-4 text-primary" /> Qualifications
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Degree (e.g. BSc Computer Science)"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  placeholder="School / University"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Graduation Year"
                  value={formData.gradYear}
                  onChange={(e) => setFormData({ ...formData, gradYear: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
              </div>
              {/* Attachment box for qualifications */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => academicRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 dark:text-gray-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg transition-all px-3 py-1.5 shadow-xs"
                >
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  Attach Academic Certificate
                </button>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate font-medium">
                  {academicFile ? `📄 ${academicFile.name}` : 'No certificate uploaded'}
                </span>
                <input
                  type="file"
                  ref={academicRef}
                  onChange={(e) => setAcademicFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            </div>

            {/* Experience */}
            <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Work History
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Previous Company"
                  value={formData.prevCompany}
                  onChange={(e) => setFormData({ ...formData, prevCompany: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Designation Role"
                  value={formData.prevRole}
                  onChange={(e) => setFormData({ ...formData, prevRole: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
                <input
                  type="text"
                  placeholder="Period (e.g. 2021 - 2024)"
                  value={formData.prevPeriod}
                  onChange={(e) => setFormData({ ...formData, prevPeriod: e.target.value })}
                  className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary placeholder:text-slate-400 dark:placeholder:text-gray-500"
                />
              </div>
              {/* Attachment box for experience */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => experienceRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 dark:text-gray-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg transition-all px-3 py-1.5 shadow-xs"
                >
                  <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Attach Experience Reference Letter
                </button>
                <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate font-medium">
                  {experienceFile ? `📄 ${experienceFile.name}` : 'No certificate uploaded'}
                </span>
                <input
                  type="file"
                  ref={experienceRef}
                  onChange={(e) => setExperienceFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* SECTION E: Family status and Emergencies */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Dependents & Emergency Contacts</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Housing dropdown selection */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-2 col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400">Housing Status Arrangement</label>
                <select
                  value={formData.housingStatus}
                  onChange={(e) => setFormData({ ...formData, housingStatus: e.target.value as any })}
                  className="w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none appearance-none font-semibold"
                >
                  <option value="Lives with Family" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Lives with Family</option>
                  <option value="Company Accommodation" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Company Accommodation</option>
                </select>

                {formData.housingStatus === 'Company Accommodation' && (
                  <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-2 border-t border-slate-200 dark:border-white/5 mt-2">
                    <input
                      type="text"
                      placeholder="Building / Camp Name (e.g. Al Khuwair Block B)"
                      value={formData.buildingName}
                      onChange={(e) => setFormData({ ...formData, buildingName: e.target.value })}
                      className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                    <input
                      type="text"
                      placeholder="Building Address (e.g. Way 3512, Muscat)"
                      value={formData.buildingAddress}
                      onChange={(e) => setFormData({ ...formData, buildingAddress: e.target.value })}
                      className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Room / Flat #"
                        value={formData.roomNumber}
                        onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                        className="w-1/2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                      />
                      <input
                        type="number"
                        placeholder="Occupants #"
                        value={formData.occupancyCount}
                        onChange={(e) => setFormData({ ...formData, occupancyCount: Number(e.target.value) })}
                        className="w-1/2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Emergency parent's details */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl space-y-2 col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-gray-400">Emergency Contact (Parent / Next of Kin) *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Contact Name"
                    value={formData.emergencyName}
                    onChange={(e) => setFormData({ ...formData, emergencyName: e.target.value })}
                    className="w-1/2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Contact Mobile Number"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                    className="w-1/2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION F: Official Document Locker Uploads */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-slate-200 dark:border-white/10 pb-1">Official Documents Locker</h3>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 leading-none mb-2">Please upload high-resolution PDF or JPEG files for the official record files.</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Passport */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col justify-between items-center text-center">
                <span className="text-[10px] font-bold text-slate-900 dark:text-white mb-2">Passport File</span>
                <button
                  type="button"
                  onClick={() => passportRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg text-[10px] font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  {passportFile ? 'Attached' : 'Choose File'}
                </button>
                {passportFile && (
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-full font-bold">{passportFile.name}</span>
                )}
                <input type="file" ref={passportRef} className="hidden" onChange={(e) => setPassportFile(e.target.files?.[0] || null)} />
              </div>

              {/* ID Card */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col justify-between items-center text-center">
                <span className="text-[10px] font-bold text-slate-900 dark:text-white mb-2">National ID File</span>
                <button
                  type="button"
                  onClick={() => idRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg text-[10px] font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  {idCardFile ? 'Attached' : 'Choose File'}
                </button>
                {idCardFile && (
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-full font-bold">{idCardFile.name}</span>
                )}
                <input type="file" ref={idRef} className="hidden" onChange={(e) => setIdCardFile(e.target.files?.[0] || null)} />
              </div>

              {/* Residency Permit */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col justify-between items-center text-center">
                <span className="text-[10px] font-bold text-slate-900 dark:text-white mb-2">Residency Card</span>
                <button
                  type="button"
                  onClick={() => residencyRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg text-[10px] font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  {residencyFile ? 'Attached' : 'Choose File'}
                </button>
                {residencyFile && (
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-full font-bold">{residencyFile.name}</span>
                )}
                <input type="file" ref={residencyRef} className="hidden" onChange={(e) => setResidencyFile(e.target.files?.[0] || null)} />
              </div>

              {/* Contract */}
              <div className="p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl flex flex-col justify-between items-center text-center">
                <span className="text-[10px] font-bold text-slate-900 dark:text-white mb-2">Labor Contract</span>
                <button
                  type="button"
                  onClick={() => contractRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-white hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-lg text-[10px] font-bold text-slate-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
                >
                  <Paperclip className="w-3 h-3 text-primary" />
                  {contractFile ? 'Attached' : 'Choose File'}
                </button>
                {contractFile && (
                  <span className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-1 truncate max-w-full font-bold">{contractFile.name}</span>
                )}
                <input type="file" ref={contractRef} className="hidden" onChange={(e) => setContractFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>

          {/* Submits */}
          <div className="flex gap-3 justify-end pt-4 mt-6 border-t border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 dark:text-gray-300 dark:hover:text-white dark:bg-white/5 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim() || !formData.company}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-emerald-600 rounded-xl font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {isSubmitting ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
