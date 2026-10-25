import { useState } from 'react';
import { X, User as UserIcon, Calendar, ShieldCheck, Clock, MapPin, Mail, Phone, Heart, FileText, Camera, Trash2 } from 'lucide-react';
import type { User } from '../../types';
import { compressAndResizeAvatar } from '../../lib/imageUtils';
import { updateEmployeeInDb, getSavedLocalAvatar } from '../../lib/databaseService';

interface EmployeeProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: User | null;
  companyName?: string;
  shiftSchedule?: {
    start: string;
    end: string;
  };
  onAvatarChange?: (url: string) => void;
}

export function EmployeeProfileModal({
  isOpen,
  onClose,
  profile,
  companyName,
  shiftSchedule,
  onAvatarChange
}: EmployeeProfileModalProps) {
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | undefined>(() => {
    return profile?.avatar_url || (profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : undefined);
  });

  // Sync avatar when profile changes
  const cachedFromStorage = profile ? getSavedLocalAvatar(profile.id, profile.email, profile.phone) : undefined;
  const effectiveProfileAvatar = profile?.avatar_url || cachedFromStorage;
  if (effectiveProfileAvatar && effectiveProfileAvatar !== currentAvatar && !isUploadingPhoto) {
    setCurrentAvatar(effectiveProfileAvatar);
  }
  if (!isOpen || !profile) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const calculateAge = (dobString?: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(profile.date_of_birth);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      const dataUrl = await compressAndResizeAvatar(file, 400, 0.85);
      setCurrentAvatar(dataUrl);
      await updateEmployeeInDb(profile.id, { avatar_url: dataUrl });
      if (onAvatarChange) onAvatarChange(dataUrl);
    } catch (err) {
      console.error('Failed to upload avatar:', err);
      alert('Could not process image. Please try another image.');
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    try {
      setIsUploadingPhoto(true);
      setCurrentAvatar(undefined);
      await updateEmployeeInDb(profile.id, { avatar_url: '' });
      if (onAvatarChange) onAvatarChange('');
    } catch (err) {
      console.error('Failed to remove avatar:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header Profile Hero */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close Profile"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar Container */}
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-md border-2 border-white/30 text-white font-black text-2xl flex items-center justify-center shadow-lg overflow-hidden">
                {currentAvatar ? (
                  <img src={currentAvatar} alt={profile.name} className="w-full h-full object-cover" />
                ) : (
                  getInitials(profile.name)
                )}
              </div>

              <input
                id="employee-modal-avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingPhoto}
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black truncate">{profile.name}</h2>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-white/20 border border-white/20 uppercase shrink-0">
                  {profile.status || 'Active'}
                </span>
              </div>
              <p className="text-emerald-100 text-xs sm:text-sm font-semibold mt-0.5 truncate">
                {profile.job_title || profile.role || 'Officer'} • {profile.department || 'Operations'}
              </p>
              
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <p className="text-white/80 text-xs flex items-center gap-1.5 font-bold">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{companyName || profile.company || 'OSAN GROUP'}</span>
                </p>

                {/* Direct Action Chips for Profile Photo */}
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="employee-modal-avatar-upload"
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-extrabold cursor-pointer transition-colors flex items-center gap-1 text-white shadow-xs"
                  >
                    <Camera className="w-3 h-3" />
                    <span>{currentAvatar ? 'Change Photo' : 'Upload Photo'}</span>
                  </label>
                  {currentAvatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={isUploadingPhoto}
                      className="px-2 py-1 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-[10px] font-extrabold text-white cursor-pointer transition-colors flex items-center gap-1 shadow-xs"
                      title="Remove custom photo and use initials"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">

          {/* 1. Employment & Shift Schedule Card */}
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-primary" />
              <span>Shift & Working Hours</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">Scheduled Shift</span>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                  {shiftSchedule?.start || '08:30'} – {shiftSchedule?.end || '17:00'}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">Join Date</span>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                  {profile.join_date ? new Date(profile.join_date).toLocaleDateString('en-GB') : 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase">Direct Supervisor</span>
                <p className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5 truncate">
                  {profile.supervisor_name || 'HR Management'}
                </p>
              </div>
            </div>
          </div>

          {/* 2. Personal Information */}
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
              <UserIcon className="w-4 h-4 text-primary" />
              <span>Personal Information</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold block">Email</span>
                  <span className="font-extrabold text-slate-800 dark:text-gray-200 truncate block">{profile.email || 'No email registered'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold block">Phone</span>
                  <span className="font-extrabold text-slate-800 dark:text-gray-200">{profile.phone || 'No phone registered'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold block">Date of Birth</span>
                  <span className="font-extrabold text-slate-800 dark:text-gray-200">
                    {profile.date_of_birth ? `${new Date(profile.date_of_birth).toLocaleDateString('en-GB')} (${age} yrs)` : 'Not set'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5">
                <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold block">Nationality & Gender</span>
                  <span className="font-extrabold text-slate-800 dark:text-gray-200">
                    {(profile.nationality === 'Omani' ? 'OMAN' : (profile.nationality || 'OMAN'))} • {profile.gender || 'Male'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Leave Balances Summary */}
          <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Leave Balances (Oman Labour Law)</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/60 dark:border-blue-900/40 text-center">
                <span className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase block">Annual Leave</span>
                <span className="text-xl font-extrabold text-[#1D70B8] dark:text-blue-400 mt-1 block">
                  {profile.leave_balances?.yearly ?? 30} <span className="text-xs font-normal">days</span>
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40 text-center">
                <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 uppercase block">Sick Leave</span>
                <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1 block">
                  {profile.leave_balances?.sick ?? 14} <span className="text-xs font-normal">days</span>
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 text-center">
                <span className="text-[10px] font-bold text-emerald-900 dark:text-emerald-300 uppercase block">Special/Maternity</span>
                <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1 block">
                  {profile.leave_balances?.pregnancy ?? 98} <span className="text-xs font-normal">days</span>
                </span>
              </div>
            </div>
          </div>

          {/* 4. Official Documents Compliance */}
          {profile.documents && profile.documents.length > 0 && (
            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                <span>Official Compliance Documents</span>
              </h3>
              <div className="space-y-2">
                {profile.documents.map((doc, idx) => {
                  const hasExp = Boolean(doc.expiryDate);
                  let isExpired = false;
                  let daysRemaining: number | null = null;

                  if (hasExp) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const exp = new Date(doc.expiryDate!);
                    exp.setHours(0, 0, 0, 0);
                    daysRemaining = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    isExpired = daysRemaining < 0;
                  }

                  return (
                    <div key={doc.id || idx} className="p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{doc.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-400">
                            {doc.type || 'ID'}
                          </span>
                        </div>
                        {doc.number && <p className="text-[11px] font-mono text-slate-500 dark:text-gray-400 mt-0.5">#{doc.number}</p>}
                      </div>

                      {hasExp && (
                        <div className="text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            isExpired
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : daysRemaining! <= 30
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {isExpired ? 'Expired' : `${daysRemaining}d Left`}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">Exp: {new Date(doc.expiryDate!).toLocaleDateString('en-GB')}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. Emergency Contacts */}
          {profile.emergency_contacts && profile.emergency_contacts.length > 0 && (
            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-500" />
                <span>Emergency Contact</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profile.emergency_contacts.map((c, i) => (
                  <div key={i} className="p-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-white/5 text-xs">
                    <p className="font-extrabold text-slate-900 dark:text-white">{c.name} <span className="text-slate-400 font-normal">({c.relation})</span></p>
                    <p className="text-slate-600 dark:text-gray-300 font-mono mt-0.5">{c.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5 flex justify-end bg-slate-50/70 dark:bg-white/5">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
}
