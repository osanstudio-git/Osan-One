import { useState, useEffect } from 'react';
import { Building2, Users, LayoutGrid, List, Shield, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { CompanyFormModal } from '../../components/hr/CompanyFormModal';
import type { CompanyData } from './mockData';
import { getCompanies, createCompany, deleteCompanyFromDb } from '../../lib/databaseService';

interface ThemeConfig {
  bgGrad: string;
  borderColor: string;
  textColor: string;
}

export function HrCompanies() {
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [deletingCompany, setDeletingCompany] = useState<CompanyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      const mapped: CompanyData[] = data.map(c => ({
        id: c.id,
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
      id: editingCompany?.id,
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

  const handleDeleteCompany = async () => {
    if (!deletingCompany) return;
    setIsDeleting(true);
    try {
      const targetIdOrName = deletingCompany.id || deletingCompany.name;
      await deleteCompanyFromDb(targetIdOrName);
      setDeletingCompany(null);
      await loadCompanies();
    } catch (err) {
      console.error('Failed to delete company:', err);
    } finally {
      setIsDeleting(false);
    }
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

  const getInitials = (name: string) => {
    if (!name) return 'CO';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const hasValidCustomLogo = (logoUrl?: string) => {
    return Boolean(logoUrl && !logoUrl.startsWith('blob:') && logoUrl.trim() !== '');
  };

  const getPolicyLabel = (policy?: string) => {
    if (policy === 'email') return 'Email Only';
    if (policy === 'phone') return 'Phone & PIN';
    return 'Hybrid Auth';
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Corporate Entities</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Manage all subsidiary companies and branch locations.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4" /> Add Company
          </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {companies.map(company => {
            const theme = getThemeConfig(company);

            return (
              <div 
                key={company.id || company.name} 
                className="bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden group hover:border-slate-300 dark:hover:border-white/20 transition-all hover:-translate-y-1"
              >
                <div className={`h-14 bg-gradient-to-br ${theme.bgGrad} relative flex items-center justify-end px-3`}>
                  <div className="flex items-center gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-lg p-1 shadow-xs border border-slate-200/50 dark:border-white/10">
                    <button
                      onClick={() => openEditModal(company)}
                      className="p-1 text-slate-600 hover:text-slate-900 dark:text-gray-300 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-white/20 transition-colors cursor-pointer"
                      title="Edit Company"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingCompany(company)}
                      className="p-1 text-red-500 hover:text-red-600 rounded-md hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Delete Company"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-0 relative">
                  <div className={`w-12 h-12 -mt-6 mb-3 rounded-xl bg-white dark:bg-slate-900 border-2 ${theme.borderColor} flex items-center justify-center text-sm font-black ${theme.textColor} shadow-md overflow-hidden p-1`}>
                    {hasValidCustomLogo(company.logoUrl) ? (
                      <img 
                        src={company.logoUrl} 
                        alt={company.name} 
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span class="${theme.textColor}">${getInitials(company.name)}</span>`;
                        }}
                      />
                    ) : (
                      <span className={theme.textColor}>{getInitials(company.name)}</span>
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

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/5 px-2.5 py-1.5 rounded-lg border border-slate-200/60 dark:border-transparent">
                      <Users className={`w-3.5 h-3.5 ${theme.textColor}`} />
                      <div>
                        <div className="text-[10px] text-slate-500 dark:text-gray-400 leading-none mb-0.5 font-bold uppercase tracking-wider">Staff</div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs leading-none">{company.count}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(company)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => setDeletingCompany(company)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete Company"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
                  <tr key={company.id || company.name} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border-2 ${theme.borderColor} flex items-center justify-center text-xs font-black ${theme.textColor} overflow-hidden shrink-0 shadow-sm p-1`}>
                          {hasValidCustomLogo(company.logoUrl) ? (
                            <img 
                              src={company.logoUrl} 
                              alt={company.name} 
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.currentTarget.parentElement as HTMLElement).innerHTML = `<span class="${theme.textColor}">${getInitials(company.name)}</span>`;
                              }}
                            />
                          ) : (
                            <span className={theme.textColor}>{getInitials(company.name)}</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{company.name}</div>
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
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(company)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={() => setDeletingCompany(company)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Delete Company"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* Delete Confirmation Modal */}
      {deletingCompany && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl max-w-md w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-200 dark:border-red-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Company Entity?</h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">
              Are you sure you want to permanently delete <strong className="text-slate-900 dark:text-white">{deletingCompany.name}</strong>? This action will remove the company entity and its configuration.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingCompany(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCompany}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete Company'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
