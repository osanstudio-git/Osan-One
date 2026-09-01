import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download, UserCircle2, Users, MessageSquare } from 'lucide-react';
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
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Employee Directory</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400">Manage all personnel across the organization.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary w-full md:w-60 shadow-xs transition-all placeholder:text-slate-400 dark:placeholder:text-gray-500"
            />
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Companies</option>
              {companiesList.map(name => (
                <option key={name} value={name} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">{name}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Genders</option>
              <option value="Male" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Male</option>
              <option value="Female" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Female</option>
            </select>
          </div>

          <div className="relative">
            <Filter className="w-4 h-4 text-slate-400 dark:text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={nationalityFilter}
              onChange={(e) => setNationalityFilter(e.target.value)}
              className="pl-9 pr-8 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-primary appearance-none cursor-pointer shadow-xs transition-all hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <option value="All" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">All Nationalities</option>
              <option value="Omani" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Omani</option>
              <option value="Expat" className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">Expat</option>
            </select>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-300 dark:border-white/10 rounded-xl text-xs font-bold transition-colors text-slate-700 dark:text-white shadow-xs">
            <Download className="w-4 h-4 text-slate-500 dark:text-gray-400" />
            Export CSV
          </button>

          <button
            onClick={() => setIsAddEmployeeOpen(true)}
            className="bg-primary hover:bg-emerald-600 px-5 py-2 rounded-xl text-xs font-bold transition-colors text-white shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <UserCircle2 className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-200/80 dark:border-white/5 shadow-sm dark:shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                <th className="p-4 pl-6">Employee</th>
                <th className="p-4">Company</th>
                <th className="p-4">System Role</th>
                <th className="p-4">Shift Category</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredEmployees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <td className="p-4 pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                        {getInitials(emp.name)}
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{emp.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-700 dark:text-gray-300 font-medium">{emp.company}</td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300 shadow-xs">
                      {emp.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold border shadow-xs ${emp.nationality === 'Omani' ? 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'}`}>
                      {emp.nationality}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                      {emp.status}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => sendEmployeeWhatsAppInvite({
                          name: emp.name,
                          phone: emp.phone,
                          email: emp.email,
                          company: emp.company || 'Osan Group',
                          pin: emp.pin || '123456'
                        })}
                        className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer"
                        title="Send Login Credentials via WhatsApp"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => navigate(`/hr/employee/${emp.id}`)}
                        className="text-xs font-bold text-primary hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                      >
                        Manage
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
                        className="mt-2 px-4 py-2 bg-primary hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-primary/20"
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

      <AddEmployeeModal
        isOpen={isAddEmployeeOpen}
        onClose={() => setIsAddEmployeeOpen(false)}
        companies={companiesList.length > 0 ? companiesList.map(name => ({ name } as any)) : [{ name: 'Default Company' } as any]}
        onAdd={handleAddEmployee}
      />
    </div>
  );
}
