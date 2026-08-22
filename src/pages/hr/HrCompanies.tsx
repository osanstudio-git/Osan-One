import { useState, useEffect } from 'react';
import { Building2, Users, MoreVertical, LayoutGrid, List, Shield } from 'lucide-react';
import { CompanyFormModal } from '../../components/hr/CompanyFormModal';
import type { CompanyData } from './mockData';
import { getCompanies, createCompany } from '../../lib/databaseService';

interface ThemeConfig {
  bgGrad: string;
  borderColor: string;
  textColor: string;
}

export function HrCompanies() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      const mapped: CompanyData[] = data.map(c => ({
        name: c.name,
        count: 0,
        authPolicy: c.auth_policy,
        omaniShiftStart: c.omani_shift_start,
        omaniShiftEnd: c.omani_shift_end,
        expatShiftStart: c.expat_shift_start,
        expatShiftEnd: c.expat_shift_end,
        logoUrl: c.logo_url,
        location: c.location,
        theme: 'emerald'
      }));
      setCompanies(mapped);
    } catch (err) {
      console.error('Failed to load companies:', err);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const handleSaveCompany = async (companyData: Omit<CompanyData, 'count'>) => {
    await createCompany({
      name: companyData.name,
      auth_policy: companyData.authPolicy || 'both',
      omani_shift_start: companyData.omaniShiftStart || '08:30',
      omani_shift_end: companyData.omaniShiftEnd || '17:00',
      expat_shift_start: companyData.expatShiftStart || '08:30',
      expat_shift_end: companyData.expatShiftEnd || '18:00',
      logo_url: companyData.logoUrl,
      location: companyData.location,
    });
    await loadCompanies();
  };

  const openAddModal = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const openEditModal = (company: CompanyData) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const getThemeConfig = (company: CompanyData): ThemeConfig => {
    const themeMap: Record<string, ThemeConfig> = {
      emerald: {
        bgGrad: 'from-emerald-500/30 to-teal-500/30 dark:from-emerald-500/20 dark:to-teal-500/20',
        borderColor: 'border-emerald-500',
        textColor: 'text-emerald-700 dark:text-emerald-400',
      },
      blue: {
        bgGrad: 'from-blue-500/30 to-cyan-500/30 dark:from-blue-500/20 dark:to-cyan-500/20',
        borderColor: 'border-blue-500',
        textColor: 'text-blue-700 dark:text-blue-400',
      },
      amber: {
        bgGrad: 'from-amber-500/30 to-orange-500/30 dark:from-amber-500/20 dark:to-orange-500/20',
        borderColor: 'border-amber-500',
        textColor: 'text-amber-700 dark:text-amber-400',
      },
      rose: {
        bgGrad: 'from-rose-500/30 to-pink-500/30 dark:from-rose-500/20 dark:to-pink-500/20',
        borderColor: 'border-rose-500',
        textColor: 'text-rose-700 dark:text-rose-400',
      },
      indigo: {
        bgGrad: 'from-indigo-500/30 to-purple-500/30 dark:from-indigo-500/20 dark:to-purple-500/20',
        borderColor: 'border-indigo-500',
        textColor: 'text-indigo-700 dark:text-indigo-400',
      },
    };

    return themeMap[company.theme || 'emerald'] || themeMap.emerald;
  };

  const getPolicyLabel = (policy?: string) => {
    if (policy === 'email') return 'Email Only';
    if (policy === 'phone') return 'Phone & PIN';
    return 'Hybrid Auth';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Corporate Entities</h2>
          <p className="text-slate-500 dark:text-gray-400 text-sm">Manage all subsidiary companies and branch locations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 bg-primary hover:bg-emerald-600 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors text-white shadow-lg shadow-primary/20"
          >
            <Building2 className="w-4 h-4" />
            Add Company
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {companies.map(company => {
            const theme = getThemeConfig(company);

            return (
              <div 
                key={company.name} 
                className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden group hover:border-slate-300 dark:hover:border-white/20 transition-all hover:-translate-y-1"
              >
                {/* Header Gradient */}
                <div className={`h-16 bg-gradient-to-br ${theme.bgGrad} relative`}>
                  <div className="absolute top-2 right-2 p-1.5 bg-white/90 dark:bg-background/80 backdrop-blur-md rounded-md text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/20 cursor-pointer transition-colors shadow-xs">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="px-4 pb-4 pt-0 relative">
                  {/* Logo / Monogram */}
                  <div className={`w-12 h-12 -mt-6 mb-3 rounded-xl bg-white dark:bg-slate-900 border-2 ${theme.borderColor} flex items-center justify-center text-sm font-black ${theme.textColor} shadow-md overflow-hidden`}>
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(company.name)
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-0.5 truncate" title={company.name}>{company.name}</h3>
                  <div className="flex items-center gap-1.5 text-[10px] bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 rounded-full text-slate-700 dark:text-gray-300 w-max mb-3 font-bold">
                    <Shield className="w-3 h-3 text-primary" />
                    <span>{getPolicyLabel(company.authPolicy)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-gray-400 mb-4 border-b border-slate-100 dark:border-white/10 pb-3 font-medium truncate" title={company.location || 'Headquarters'}>
                    {company.location || 'Headquarters'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-transparent">
                      <Users className={`w-3.5 h-3.5 ${theme.textColor}`} />
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-gray-400 leading-none mb-0.5 font-bold uppercase tracking-wider">Staff</div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs leading-none">{company.count}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => openEditModal(company)}
                      className="text-xs font-bold text-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                    >
                      Manage →
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Company Entity</th>
                <th className="p-4">Location</th>
                <th className="p-4">Login Policy</th>
                <th className="p-4">Total Staff</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
              {companies.map(company => {
                const theme = getThemeConfig(company);

                return (
                  <tr key={company.name} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border-2 ${theme.borderColor} flex items-center justify-center text-xs font-black ${theme.textColor} overflow-hidden shrink-0 shadow-sm`}>
                          {company.logoUrl ? (
                            <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(company.name)
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{company.name}</div>
                          {company.contactEmail && <div className="text-xs text-slate-500 dark:text-gray-400">{company.contactEmail}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-gray-400 font-medium">{company.location || 'Headquarters'}</td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-gray-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-full font-bold">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        {getPolicyLabel(company.authPolicy)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">
                        <Users className={`w-4 h-4 ${theme.textColor}`} />
                        <span className="font-extrabold text-slate-900 dark:text-white text-sm">{company.count}</span>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => openEditModal(company)}
                        className="text-xs font-bold text-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                );
              })}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-500 dark:text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Building2 className="w-10 h-10 text-slate-400 dark:text-gray-500 opacity-40" />
                      <p className="text-base font-bold text-slate-900 dark:text-white">No companies registered yet</p>
                      <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm">
                        Your multi-tenant database is empty. Click the button below to register your first organization.
                      </p>
                      <button
                        onClick={openAddModal}
                        className="mt-2 px-4 py-2 bg-primary hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20"
                      >
                        + Add First Company
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CompanyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCompany}
        initialData={editingCompany}
      />
    </div>
  );
}
