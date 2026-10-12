import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, UserCircle2, Users, MessageSquare, LayoutGrid, List, ArrowRight } from 'lucide-react';
import { AddEmployeeModal } from '../../components/hr/AddEmployeeModal';
import type { UserStatus, User } from '../../types';
import { getEmployees, createEmployeeInDb, getCompanies } from '../../lib/databaseService';
import { sendEmployeeWhatsAppInvite } from '../../lib/whatsappService';

export function HrDirectory() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [companiesList, setCompaniesList] = useState<string[]>([]);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('All');
  const [genderFilter, setGenderFilter] = useState<string>('All');
  const [nationalityFilter, setNationalityFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024 ? 'grid' : 'table';
    }
    return 'table';
  });

  const loadData = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);

      const comps = await getCompanies();
      setCompaniesList(comps.map(c => c.name));
    } catch (err) {
      console.error('Failed to load directory:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddEmployee = async (data: any) => {
    const newEmp: Partial<User> = {
      ...data,
      company_id: data.company || 'Company',
      status: 'Active' as UserStatus,
      leave_balances: {
        yearly: 30,
        sick: 14,
        pregnancy: 98
      }
    };
    await createEmployeeInDb(newEmp);
    await loadData();
  };

  const filteredEmployees = employees.filter(emp => {
    const empComp = emp.company || emp.company_id || '';
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empComp.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCompany = companyFilter === 'All' || empComp === companyFilter;
    const matchesGender = genderFilter === 'All' || emp.gender === genderFilter;
    const matchesNationality = nationalityFilter === 'All' || emp.nationality === nationalityFilter;

    return matchesSearch && matchesCompany && matchesGender && matchesNationality;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">

      {/* Header & Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-0.5">Employee Directory</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">Manage all personnel across the organization.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 p-0.5 rounded-xl shadow-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Table View"
              >
                <List className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Cards View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <button className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white shadow-xs cursor-pointer">
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-gray-400" />
              <span className="hidden xs:inline">Export</span>
            </button>

            <button
              onClick={() => setIsAddEmployeeOpen(true)}
              className="bg-primary hover:bg-emerald-600 px-3.5 sm:px-5 py-2 rounded-xl text-xs font-bold transition-colors text-white shadow-lg shadow-primary/20 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <UserCircle2 className="w-4 h-4" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2.5 sm:gap-3">
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1 lg:flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary w-full shadow-xs transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Companies</option>
              {companiesList.map(name => (
                <option key={name} value={name} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Genders</option>
              <option value="Male" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Male</option>
              <option value="Female" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Female</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Nationalities</option>
              <option value="Omani" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Omani</option>
              <option value="Expat" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Expat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content: Table or Cards View */}
      {viewMode === 'table' ? (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[11px] sm:text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  <th className="py-3 px-3 sm:py-3.5 sm:px-5">Employee</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Company</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">System Role</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Shift Category</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4">Status</th>
                  <th className="py-3 px-3 sm:py-3.5 sm:px-5 text-right min-w-[130px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredEmployees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-3 sm:py-3.5 sm:px-5">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-[11px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                          {getInitials(emp.name)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{emp.name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-gray-500 sm:hidden">{emp.company}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4 text-slate-700 dark:text-gray-300 font-medium text-xs">
                      {emp.company}
                    </td>
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                      <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 shadow-xs">
                        {emp.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                      <span className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-bold border shadow-xs ${emp.nationality === 'Omani' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                        {emp.nationality}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:py-3.5 sm:px-4">
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {emp.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:py-3.5 sm:px-5 text-right min-w-[130px]">
                      <div className="inline-flex items-center justify-end gap-1.5 sm:gap-2">
                        <button
                          onClick={() => sendEmployeeWhatsAppInvite({
                            name: emp.name,
                            phone: emp.phone,
                            email: emp.email,
                            company: emp.company || 'Osan Group',
                            pin: emp.pin || '123456'
                          })}
                          className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Send Login Credentials via WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        <button
                          onClick={() => navigate(`/hr/employee/${emp.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-500 dark:text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Users className="w-10 h-10 text-slate-400 dark:text-gray-500 opacity-40" />
                        <p className="text-base font-bold text-slate-900 dark:text-white">No employees registered yet</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm">
                          Your database is empty. Click the button below to onboard your first employee.
                        </p>
                        <button
                          onClick={() => setIsAddEmployeeOpen(true)}
                          className="mt-2 px-4 py-2 bg-primary hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20 cursor-pointer"
                        >
                          + Add First Employee
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cards View for Mobile & Tablet */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {filteredEmployees.map(emp => (
            <div
              key={emp.id}
              className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/40 flex flex-col justify-between gap-3 group"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400 shrink-0">
                    {getInitials(emp.name)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate group-hover:text-primary transition-colors">
                      {emp.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 truncate">
                      {emp.company || 'Osan Group'}
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  {emp.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300">
                  {emp.role.replace('_', ' ')}
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${emp.nationality === 'Omani' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                  {emp.nationality || 'General'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => sendEmployeeWhatsAppInvite({
                    name: emp.name,
                    phone: emp.phone,
                    email: emp.email,
                    company: emp.company || 'Osan Group',
                    pin: emp.pin || '123456'
                  })}
                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl border border-emerald-500/20 transition-colors cursor-pointer shrink-0"
                  title="Send Login Credentials via WhatsApp"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate(`/hr/employee/${emp.id}`)}
                  className="flex-1 py-2 px-3 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>Manage Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          {filteredEmployees.length === 0 && (
            <div className="col-span-full bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/10 p-12 text-center text-slate-500 dark:text-gray-400">
              <div className="flex flex-col items-center justify-center gap-3">
                <Users className="w-10 h-10 text-slate-400 dark:text-gray-500 opacity-40" />
                <p className="text-base font-bold text-slate-900 dark:text-white">No employees registered yet</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 max-w-sm">
                  Your database is empty. Click the button below to onboard your first employee.
                </p>
                <button
                  onClick={() => setIsAddEmployeeOpen(true)}
                  className="mt-2 px-4 py-2 bg-primary hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20 cursor-pointer"
                >
                  + Add First Employee
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        companies={companiesList.length > 0 ? companiesList.map(name => ({ name } as any)) : [{ name: 'Default Company' } as any]}
        onAdd={handleAddEmployee}
      />
    </div>
  );
}
