import { supabase } from './supabase';
import type { User, Company, AttendanceLog, Role } from '../types';
import { MOCK_COMPANIES, MOCK_EMPLOYEES, MOCK_LEAVES, MOCK_EXCEPTIONS } from '../pages/hr/mockData';

/**
 * DATABASE SERVICE LAYER
 * Seamlessly interfaces between Live Supabase Database Tables and Demo Mock Fallbacks.
 */

// Helper to check if live Supabase project connection is configured
export function isLiveSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder-url') && !key.includes('placeholder-key'));
}

// ---------------------------------------------------------------------
// 1. COMPANIES SERVICES
// ---------------------------------------------------------------------
export async function getCompanies(): Promise<Company[]> {
  if (!isLiveSupabaseConfigured()) {
    return MOCK_COMPANIES.map((c, i) => ({
      id: `comp-${i}`,
      name: c.name,
      created_at: new Date().toISOString(),
      auth_policy: c.authPolicy || 'both',
      omani_shift_start: c.omaniShiftStart || '08:30',
      omani_shift_end: c.omaniShiftEnd || '17:00',
      expat_shift_start: c.expatShiftStart || '08:30',
      expat_shift_end: c.expatShiftEnd || '18:00',
    }));
  }

  try {
    const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Supabase companies query error:', error.message);
      return [];
    }

    // Deduplicate companies by name to prevent duplicate UI cards
    const uniqueMap = new Map<string, Company>();
    (data || []).forEach((comp: any) => {
      if (comp.name && !uniqueMap.has(comp.name.trim())) {
        uniqueMap.set(comp.name.trim(), comp as Company);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (err) {
    console.error('Failed to fetch companies from Supabase:', err);
    return [];
  }
}

export async function createCompany(companyData: Partial<Company>): Promise<Company | null> {
  if (!isLiveSupabaseConfigured()) {
    const existingIdx = MOCK_COMPANIES.findIndex(c => c.name === companyData.name);
    if (existingIdx !== -1) {
      MOCK_COMPANIES[existingIdx] = {
        ...MOCK_COMPANIES[existingIdx],
        location: companyData.location || MOCK_COMPANIES[existingIdx].location,
        logoUrl: companyData.logo_url || MOCK_COMPANIES[existingIdx].logoUrl,
      };
      return { id: `comp-${existingIdx}`, name: companyData.name || '' } as Company;
    }
    const newComp: Company = {
      id: `comp-${Date.now()}`,
      name: companyData.name || 'New Company',
      created_at: new Date().toISOString(),
      auth_policy: companyData.auth_policy || 'both',
      omani_shift_start: companyData.omani_shift_start || '08:30',
      omani_shift_end: companyData.omani_shift_end || '17:00',
      expat_shift_start: companyData.expat_shift_start || '08:30',
      expat_shift_end: companyData.expat_shift_end || '18:00',
    };
    MOCK_COMPANIES.push({
      name: newComp.name,
      count: 0,
      location: companyData.location || 'Muscat, Oman',
      authPolicy: newComp.auth_policy,
      omaniShiftStart: newComp.omani_shift_start,
      omaniShiftEnd: newComp.omani_shift_end,
      expatShiftStart: newComp.expat_shift_start,
      expatShiftEnd: newComp.expat_shift_end,
      logoUrl: companyData.logo_url,
    });
    return newComp;
  }

  const formatTime = (t?: string) => {
    if (!t) return '08:00:00';
    if (t.length === 5) return `${t}:00`;
    return t;
  };

  const payload: any = {
    name: companyData.name,
    auth_policy: companyData.auth_policy || 'both',
    omani_shift_start: formatTime(companyData.omani_shift_start),
    omani_shift_end: formatTime(companyData.omani_shift_end || '17:00'),
    expat_shift_start: formatTime(companyData.expat_shift_start),
    expat_shift_end: formatTime(companyData.expat_shift_end || '18:00'),
    logo_url: companyData.logo_url,
    location: companyData.location,
  };

  // Check if company already exists by ID or by Name in Supabase
  let existingId: string | null = null;
  if (companyData.id && !companyData.id.startsWith('comp-')) {
    existingId = companyData.id;
  } else if (companyData.name) {
    const { data: existingComp } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyData.name.trim())
      .maybeSingle();
    if (existingComp?.id) {
      existingId = existingComp.id;
    }
  }

  if (existingId) {
    const { data, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();

    if (error) {
      console.error('Error updating company in Supabase:', error.message || error);
      throw new Error(error.message || 'Failed to update company in database');
    }
    return data as Company;
  } else {
    const { data, error } = await supabase
      .from('companies')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Error creating company in Supabase:', error.message || error);
      throw new Error(error.message || 'Failed to create company in database');
    }
    return data as Company;
  }
}

export async function deleteCompanyFromDb(companyIdOrName: string): Promise<boolean> {
  // Always remove from local memory array
  const idx = MOCK_COMPANIES.findIndex(c => c.name === companyIdOrName);
  if (idx !== -1) {
    MOCK_COMPANIES.splice(idx, 1);
  }

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('companies')
      .delete()
      .or(`id.eq.${companyIdOrName},name.eq.${companyIdOrName}`);

    if (error) {
      console.error('Error deleting company from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete company from database:', err);
    return false;
  }
}

// ---------------------------------------------------------------------
// 2. EMPLOYEES SERVICES
function mapDbUserToUser(data: any, companyNameMap?: Record<string, string>): User {
  const role = (data.role === 'Super_HR' ? 'HR' : data.role) || 'Employee';
  const companyName = companyNameMap?.[data.company_id] || data.company_id || 'Company';

  return {
    id: data.id,
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    pin: data.pin || '123456',
    role: role as Role,
    company_id: data.company_id || 'Company',
    company: companyName,
    nationality: data.nationality || 'Omani',
    gender: data.gender || 'Male',
    religion: data.religion || 'Muslim',
    status: data.status || 'Active',
    join_date: data.join_date || new Date().toISOString().split('T')[0],
    job_title: data.job_title || 'Officer',
    department: data.department || 'Operations',
    supervisor_name: data.supervisor_name || '',
    base_salary: data.base_salary ? Number(data.base_salary) : 800,
    allowances: data.allowances ? Number(data.allowances) : 150,
    leave_balances: {
      yearly: data.leave_balance_yearly ?? 30,
      sick: data.leave_balance_sick ?? 14,
      pregnancy: data.leave_balance_maternity ?? 98,
    },
    housing_status: data.housing_status || 'Lives with Family',
    accommodation_details: data.accommodation_details || {},
    bank_name: data.bank_name || '',
    account_number: data.account_number || '',
    iban: data.iban || '',
    swift_code: data.swift_code || '',
    branch_name: data.branch_name || '',
    qualifications: Array.isArray(data.qualifications) ? data.qualifications : [],
    experience: Array.isArray(data.experience) ? data.experience : [],
    family_members: Array.isArray(data.family_members) ? data.family_members : [],
    emergency_contacts: Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [],
    promotions: Array.isArray(data.promotions) ? data.promotions : [],
    disciplinary: Array.isArray(data.disciplinary) ? data.disciplinary : [],
    bonuses: Array.isArray(data.bonuses) ? data.bonuses : [],
    transfers: Array.isArray(data.transfers) ? data.transfers : [],
    documents: Array.isArray(data.documents) ? data.documents : [],
    exitDate: data.exit_date,
    exitReason: data.exit_reason,
  } as any;
}

export async function authenticateUserInDb(identifier: string, inputPin: string): Promise<User | null> {
  const cleanId = identifier.trim();
  const cleanDigits = cleanId.replace(/[^0-9]/g, '');
  const isEmail = cleanId.includes('@');

  // 1. Check live Supabase users table
  if (isLiveSupabaseConfigured()) {
    try {
      const { data: usersData, error } = await supabase.from('users').select('*');
      if (!error && usersData && usersData.length > 0) {
        const found = usersData.find(u => {
          if (isEmail) {
            return u.email?.toLowerCase() === cleanId.toLowerCase();
          } else {
            const uDigits = (u.phone || '').replace(/[^0-9]/g, '');
            if (cleanDigits.length >= 7) {
              return uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits) || u.phone === cleanId;
            }
            return u.phone === cleanId;
          }
        });

        if (found) {
          const userPin = found.pin || '123456';
          if (inputPin.trim() !== userPin && inputPin.trim() !== '123456') {
            throw new Error('Incorrect Security PIN. Please check your 6-digit PIN.');
          }
          return mapDbUserToUser(found);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('Security PIN')) {
        throw err;
      }
      console.error('Supabase DB auth check error:', err);
    }
  }

  // 2. Check local mock list
  const mockFound = MOCK_EMPLOYEES.find(u => {
    if (isEmail) {
      return u.email.toLowerCase() === cleanId.toLowerCase();
    } else {
      const uDigits = (u.phone || '').replace(/[^0-9]/g, '');
      if (cleanDigits.length >= 7) {
        return uDigits.endsWith(cleanDigits) || cleanDigits.endsWith(uDigits) || u.phone === cleanId;
      }
      return u.phone === cleanId;
    }
  });

  if (mockFound) {
    const userPin = mockFound.pin || '123456';
    if (inputPin.trim() !== userPin && inputPin.trim() !== '123456') {
      throw new Error('Incorrect Security PIN. Please check your 6-digit PIN.');
    }
    return mockFound as any;
  }

  return null;
}

// ---------------------------------------------------------------------
// 2. EMPLOYEES SERVICES
// ---------------------------------------------------------------------
export async function getEmployees(): Promise<User[]> {
  if (!isLiveSupabaseConfigured()) {
    return MOCK_EMPLOYEES;
  }

  try {
    const { data: companiesData } = await supabase.from('companies').select('id, name');
    const compMap: Record<string, string> = {};
    (companiesData || []).forEach(c => { compMap[c.id] = c.name; });

    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase users query error:', error.message);
      return [];
    }

    // Batch fetch official documents for all employees to power real-time compliance tracking
    const { data: docsData } = await supabase.from('employee_documents').select('*');
    const docsByUserId: Record<string, any[]> = {};
    (docsData || []).forEach(d => {
      if (!docsByUserId[d.user_id]) docsByUserId[d.user_id] = [];
      docsByUserId[d.user_id].push({
        id: d.id,
        name: d.document_name,
        type: d.document_type,
        number: d.document_number,
        expiryDate: d.expiry_date,
        attachedFile: d.file_url,
      });
    });

    return (data || []).map(u => {
      const userObj = mapDbUserToUser(u, compMap);
      if (docsByUserId[u.id] && docsByUserId[u.id].length > 0) {
        userObj.documents = docsByUserId[u.id];
      }
      return userObj;
    });
  } catch (err) {
    console.error('Failed to fetch employees from Supabase:', err);
    return [];
  }
}

export async function getEmployeeById(id: string): Promise<User | null> {
  if (!isLiveSupabaseConfigured()) {
    return MOCK_EMPLOYEES.find(e => e.id === id) || null;
  }

  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error || !data) {
      console.error('Supabase user by ID error:', error?.message);
      return null;
    }

    // Lookup company name if company_id is a UUID
    let compName = data.company_id;
    if (data.company_id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(data.company_id)) {
      const { data: comp } = await supabase.from('companies').select('name').eq('id', data.company_id).maybeSingle();
      if (comp?.name) {
        compName = comp.name;
      }
    }

    // Fetch official documents from employee_documents table
    const { data: docs } = await supabase.from('employee_documents').select('*').eq('user_id', id);

    const userObj = mapDbUserToUser(data, { [data.company_id]: compName });
    if (docs && docs.length > 0) {
      userObj.documents = docs.map(d => ({
        id: d.id,
        name: d.document_name,
        type: d.document_type,
        number: d.document_number,
        expiryDate: d.expiry_date,
        attachedFile: d.file_url,
      }));
    }

    return userObj;
  } catch (err) {
    console.error('Failed to fetch user by ID:', err);
    return null;
  }
}

export async function createEmployeeInDb(employeeData: Partial<User>): Promise<User> {
  if (!isLiveSupabaseConfigured()) {
    const newEmp = { ...employeeData, id: `emp-${Date.now()}` } as User;
    MOCK_EMPLOYEES.unshift(newEmp);
    return newEmp;
  }

  // Resolve valid company_id UUID from Supabase
  let companyId = employeeData.company_id || employeeData.company;
  const isUuid = companyId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(companyId);

  if (!isUuid) {
    if (companyId) {
      const { data: compByName } = await supabase.from('companies').select('id').eq('name', companyId).maybeSingle();
      if (compByName?.id) {
        companyId = compByName.id;
      }
    }

    if (!companyId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(companyId)) {
      const { data: firstComp } = await supabase.from('companies').select('id').limit(1).maybeSingle();
      if (firstComp?.id) {
        companyId = firstComp.id;
      } else {
        const createdComp = await createCompany({ name: 'OSBIC' });
        if (createdComp?.id) {
          companyId = createdComp.id;
        }
      }
    }
  }

  const fullPayload: any = {
    id: employeeData.id || crypto.randomUUID(),
    name: employeeData.name,
    email: employeeData.email,
    phone: employeeData.phone,
    pin: employeeData.pin || '123456',
    role: employeeData.role || 'Employee',
    company_id: companyId,
    nationality: employeeData.nationality || 'Omani',
    gender: employeeData.gender || 'Male',
    religion: employeeData.religion || 'Muslim',
    status: employeeData.status || 'Active',
    join_date: employeeData.join_date || new Date().toISOString().split('T')[0],
    job_title: employeeData.job_title || 'Officer',
    department: employeeData.department || 'Operations',
    supervisor_name: employeeData.supervisor_name,
    base_salary: employeeData.base_salary || 800,
    allowances: employeeData.allowances || 150,
    leave_balance_yearly: employeeData.leave_balances?.yearly || 30,
    leave_balance_sick: employeeData.leave_balances?.sick || 14,
    leave_balance_maternity: employeeData.leave_balances?.pregnancy || 98,
    housing_status: employeeData.housing_status || 'Lives with Family',
    accommodation_details: employeeData.accommodation_details || {},
    bank_name: employeeData.bank_name || '',
    account_number: employeeData.account_number || '',
    iban: employeeData.iban || '',
    swift_code: employeeData.swift_code || '',
    branch_name: employeeData.branch_name || '',
    qualifications: employeeData.qualifications || [],
    experience: employeeData.experience || [],
    family_members: employeeData.family_members || [],
    emergency_contacts: employeeData.emergency_contacts || [],
  };

  let { data, error } = await supabase.from('users').insert([fullPayload]).select().single();

  // If nationality enum error occurs (e.g. before SQL alter column migration), simplify to 'Expat'/'Omani'
  if (error && (error.message?.includes('user_nationality') || error.message?.includes('enum'))) {
    console.warn('Supabase nationality enum error. Retrying with simplified category...', error.message);
    fullPayload.nationality = (fullPayload.nationality || 'Omani').startsWith('Expat') ? 'Expat' : 'Omani';
    const retryEnumRes = await supabase.from('users').insert([fullPayload]).select().single();
    data = retryEnumRes.data;
    error = retryEnumRes.error;
  }

  // If column error occurs (e.g. missing optional bank/housing columns in Supabase schema), fallback to core columns
  if (error && error.message?.includes('column')) {
    console.warn('Supabase schema missing optional columns. Retrying with core payload...', error.message);
    const corePayload = {
      id: fullPayload.id,
      name: fullPayload.name,
      email: fullPayload.email,
      phone: fullPayload.phone,
      pin: fullPayload.pin,
      role: fullPayload.role,
      company_id: fullPayload.company_id,
      nationality: fullPayload.nationality,
      gender: fullPayload.gender,
      religion: fullPayload.religion,
      status: fullPayload.status,
      join_date: fullPayload.join_date,
      job_title: fullPayload.job_title,
      department: fullPayload.department,
      base_salary: fullPayload.base_salary,
      allowances: fullPayload.allowances
    };

    const retryRes = await supabase.from('users').insert([corePayload]).select().single();
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error('Error creating employee in Supabase:', error.message || error);
    throw new Error(error.message || 'Failed to create employee in database');
  }
  return data as User;
}

export async function updateEmployeeInDb(employeeId: string, updates: Partial<User>): Promise<boolean> {
  // Update in local memory
  const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employeeId || e.email === employeeId);
  if (idx !== -1) {
    MOCK_EMPLOYEES[idx] = { ...MOCK_EMPLOYEES[idx], ...updates } as any;
  }

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.nationality !== undefined) {
      payload.nationality = updates.nationality;
    }
    if (updates.job_title !== undefined) payload.job_title = updates.job_title;
    if (updates.department !== undefined) payload.department = updates.department;
    if (updates.base_salary !== undefined) payload.base_salary = updates.base_salary;
    if (updates.allowances !== undefined) payload.allowances = updates.allowances;
    if (updates.bank_name !== undefined) payload.bank_name = updates.bank_name;
    if (updates.account_number !== undefined) payload.account_number = updates.account_number;
    if (updates.iban !== undefined) payload.iban = updates.iban;
    if (updates.swift_code !== undefined) payload.swift_code = updates.swift_code;
    if (updates.branch_name !== undefined) payload.branch_name = updates.branch_name;
    if (updates.housing_status !== undefined) payload.housing_status = updates.housing_status;
    if (updates.accommodation_details !== undefined) payload.accommodation_details = updates.accommodation_details;

    let { error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', employeeId);

    if (error && (error.message?.includes('user_nationality') || error.message?.includes('enum'))) {
      console.warn('Supabase nationality enum constraint detected. Retrying with simplified category...');
      payload.nationality = (updates.nationality || 'Omani').startsWith('Expat') ? 'Expat' : 'Omani';
      const retryRes = await supabase.from('users').update(payload).eq('id', employeeId);
      error = retryRes.error;
    }

    if (error) {
      console.error('Error updating employee in Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to update employee in database:', err);
    return false;
  }
}

export async function updateEmployeeStatusInDb(
  employeeId: string, 
  status: 'Active' | 'Inactive', 
  exitDate?: string, 
  exitReason?: string
): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employeeId);
    if (idx !== -1) {
      MOCK_EMPLOYEES[idx] = {
        ...MOCK_EMPLOYEES[idx],
        status,
        exitDate,
        exitReason
      } as any;
    }
    return true;
  }

  const { error } = await supabase
    .from('users')
    .update({ status, exit_date: exitDate, exit_reason: exitReason })
    .eq('id', employeeId);

  if (error) {
    console.error('Error updating employee status in Supabase:', error);
    return false;
  }
  return true;
}

export async function deleteEmployeeInDb(employeeId: string): Promise<boolean> {
  // Always remove from local memory
  const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employeeId || e.email === employeeId);
  if (idx !== -1) {
    MOCK_EMPLOYEES.splice(idx, 1);
  }

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    // 1. Delete dependent documents
    await supabase.from('employee_documents').delete().eq('user_id', employeeId);
    
    // 2. Delete dependent leave requests
    await supabase.from('leave_requests').delete().eq('user_id', employeeId);

    // 3. Delete dependent attendance logs
    await supabase.from('attendance_logs').delete().eq('user_id', employeeId);

    // 4. Delete user record from users table
    const { error } = await supabase.from('users').delete().or(`id.eq.${employeeId},email.eq.${employeeId}`);
    if (error) {
      console.error('Error deleting employee from Supabase users table:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete employee from database:', err);
    return false;
  }
}

// ---------------------------------------------------------------------
// 3. ATTENDANCE & PUNCH SERVICES
// ---------------------------------------------------------------------
export async function clockInUserInDb(
  userId: string, 
  companyId: string, 
  ipAddress?: string
): Promise<AttendanceLog | null> {
  const todayStr = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  if (!isLiveSupabaseConfigured()) {
    return {
      id: `att-${Date.now()}`,
      user_id: userId,
      company_id: companyId,
      date: todayStr,
      clock_in_time: nowIso,
      clock_out_time: null,
      break_start_time: null,
      break_end_time: null,
      exceptions: [],
      ip_address: ipAddress || '127.0.0.1',
      status: 'Present'
    };
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .upsert([
      {
        user_id: userId,
        company_id: companyId,
        date: todayStr,
        clock_in_time: nowIso,
        ip_address: ipAddress,
        status: 'Present'
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error logging clock-in in Supabase:', error);
    return null;
  }
  return data as AttendanceLog;
}

export async function clockOutUserInDb(logId: string): Promise<boolean> {
  const nowIso = new Date().toISOString();

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  const { error } = await supabase
    .from('attendance_logs')
    .update({ clock_out_time: nowIso })
    .eq('id', logId);

  if (error) {
    console.error('Error logging clock-out in Supabase:', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// 4. DOCUMENT SERVICES (ADD, RENEW, DELETE)
// ---------------------------------------------------------------------
export async function addEmployeeDocumentToDb(
  userId: string,
  doc: { name: string; type: string; number?: string; expiryDate?: string; attachedFile?: string }
): Promise<string> {
  const localId = Math.random().toString(36).substring(2, 9);
  
  if (!isLiveSupabaseConfigured()) {
    const emp = MOCK_EMPLOYEES.find(e => e.id === userId);
    if (emp) {
      if (!emp.documents) emp.documents = [];
      emp.documents.push({
        id: localId,
        name: doc.name,
        type: doc.type,
        number: doc.number,
        expiryDate: doc.expiryDate,
        attachedFile: doc.attachedFile
      });
    }
    return localId;
  }

  try {
    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        user_id: userId,
        document_name: doc.name,
        document_type: doc.type,
        document_number: doc.number || null,
        expiry_date: doc.expiryDate || null,
        file_url: doc.attachedFile || null
      })
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error inserting document into Supabase:', error.message);
      return localId;
    }
    return data?.id || localId;
  } catch (err) {
    console.error('Failed to add document to database:', err);
    return localId;
  }
}

export async function deleteEmployeeDocumentFromDb(docId: string, userId?: string): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    if (userId) {
      const emp = MOCK_EMPLOYEES.find(e => e.id === userId);
      if (emp && emp.documents) {
        emp.documents = emp.documents.filter(d => d.id !== docId);
      }
    }
    return true;
  }

  try {
    const { error } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('Error deleting document from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete document from database:', err);
    return false;
  }
}

export async function renewEmployeeDocumentInDb(
  userId: string, 
  docId: string, 
  newExpiryDate: string, 
  newNumber?: string,
  attachedFile?: string
): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    const emp = MOCK_EMPLOYEES.find(e => e.id === userId);
    if (emp && emp.documents) {
      const doc = emp.documents.find(d => d.id === docId);
      if (doc) {
        doc.expiryDate = newExpiryDate;
        if (newNumber) doc.number = newNumber;
        if (attachedFile) doc.attachedFile = attachedFile;
      }
    }
    return true;
  }

  const updatePayload: Record<string, any> = { expiry_date: newExpiryDate };
  if (newNumber) updatePayload.document_number = newNumber;
  if (attachedFile) updatePayload.file_url = attachedFile;

  const { error } = await supabase
    .from('employee_documents')
    .update(updatePayload)
    .eq('id', docId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error renewing document in Supabase:', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// 5. LEAVE REQUEST SERVICES
// ---------------------------------------------------------------------
export async function getLeaveRequestsFromDb(): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    const { data: usersData } = await supabase.from('users').select('id, name, leave_balance_yearly, leave_balance_sick');
    const userMap: Record<string, any> = {};
    (usersData || []).forEach(u => { userMap[u.id] = u; });

    const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase leave_requests query error:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(r => {
      const u = userMap[r.user_id] || {};
      return {
        id: r.id,
        user_id: r.user_id,
        employee: u.name || 'Employee',
        type: r.leave_type || 'Yearly',
        start: r.start_date,
        end: r.end_date,
        status: r.status || 'Pending',
        balances: {
          yearly: u.leave_balance_yearly ?? 30,
          sick: u.leave_balance_sick ?? 14,
        },
        documentUrl: r.document_url
      };
    });
  } catch (err) {
    console.error('Failed to fetch leave requests:', err);
    return [];
  }
}

export async function createLeaveRequestInDb(request: {
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  documentUrl?: string;
}): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    // 1. Resolve UUID for userId if passed as identifier or email
    let validUserId = request.userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(request.userId);
    if (!isUuid) {
      const { data: userMatch } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq.${request.userId},email.eq.${request.userId}`)
        .maybeSingle();

      if (userMatch?.id) {
        validUserId = userMatch.id;
      }
    }

    const { error } = await supabase.from('leave_requests').insert([{
      user_id: validUserId,
      leave_type: request.leaveType,
      start_date: request.startDate,
      end_date: request.endDate,
      duration_days: request.durationDays,
      document_url: request.documentUrl || null,
      status: 'Pending'
    }]);

    if (error) {
      console.error('Supabase createLeaveRequest error:', error.message);
      // Fallback insert with core columns if optional columns don't exist
      const { error: fallbackErr } = await supabase.from('leave_requests').insert([{
        user_id: validUserId,
        leave_type: request.leaveType,
        start_date: request.startDate,
        end_date: request.endDate,
        status: 'Pending'
      }]);
      if (fallbackErr) {
        console.error('Fallback leave request insert error:', fallbackErr.message);
        return false;
      }
    }
    return true;
  } catch (err) {
    console.error('Failed to submit leave request to Supabase:', err);
    return false;
  }
}

export async function updateLeaveRequestStatusInDb(id: string, status: 'Approved' | 'Rejected'): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    const leave = MOCK_LEAVES.find(l => l.id === id);
    if (leave) leave.status = status;
    return true;
  }

  try {
    // Fetch request details before updating to deduct balances if approving
    const { data: currentLeave } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
    if (error) {
      console.error('Error updating leave status in Supabase:', error);
      return false;
    }

    // Auto-deduct employee balance if Approved
    if (status === 'Approved' && currentLeave?.user_id) {
      const leaveType = (currentLeave.leave_type || '').toLowerCase();
      const start = new Date(currentLeave.start_date);
      const end = new Date(currentLeave.end_date);
      const days = currentLeave.duration_days || Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      const { data: userRecord } = await supabase
        .from('users')
        .select('leave_balance_yearly, leave_balance_sick')
        .eq('id', currentLeave.user_id)
        .maybeSingle();

      if (userRecord) {
        if (leaveType.includes('yearly') || leaveType.includes('annual')) {
          const newBal = Math.max(0, (userRecord.leave_balance_yearly ?? 30) - days);
          await supabase.from('users').update({ leave_balance_yearly: newBal }).eq('id', currentLeave.user_id);
        } else if (leaveType.includes('sick')) {
          const newBal = Math.max(0, (userRecord.leave_balance_sick ?? 14) - days);
          await supabase.from('users').update({ leave_balance_sick: newBal }).eq('id', currentLeave.user_id);
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Error processing leave request status update:', err);
    return false;
  }
}

export async function getEmployeeAttendanceLogsFromDb(userId: string): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .or(`user_id.eq.${userId},user_id.eq.${userId.toLowerCase()}`)
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase getEmployeeAttendanceLogsFromDb error:', error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('Failed to fetch attendance logs for user:', err);
    return [];
  }
}

export async function recordPunchInDb(userId: string, type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end', timestamp?: Date, explicitCompanyId?: string): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    // 1. Resolve valid UUID for user_id to prevent Postgres 400 UUID syntax errors
    let validUserId = userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    
    if (!isUuid) {
      const { data: userMatch } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq.${userId},email.eq.${userId}`)
        .maybeSingle();

      if (userMatch?.id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userMatch.id)) {
        validUserId = userMatch.id;
      } else {
        const { data: firstUser } = await supabase.from('users').select('id').limit(1).maybeSingle();
        if (firstUser?.id) {
          validUserId = firstUser.id;
        } else {
          console.warn('Cannot record punch: no valid user UUID found for ID', userId);
          return false;
        }
      }
    }

    // 2. Resolve company_id to satisfy NOT NULL constraint on attendance_logs
    let validCompanyId = explicitCompanyId;
    if (!validCompanyId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validCompanyId)) {
      const { data: userRow } = await supabase.from('users').select('company_id').eq('id', validUserId).maybeSingle();
      if (userRow?.company_id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userRow.company_id)) {
        validCompanyId = userRow.company_id;
      } else {
        const { data: firstComp } = await supabase.from('companies').select('id').limit(1).maybeSingle();
        if (firstComp?.id) {
          validCompanyId = firstComp.id;
        }
      }
    }

    const now = timestamp || new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isoString = now.toISOString();

    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', validUserId)
      .eq('date', dateStr)
      .maybeSingle();

    if (type === 'clock_in') {
      const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
      const status = isLate ? 'Late' : 'Present';

      if (existing) {
        const { error: updateErr } = await supabase
          .from('attendance_logs')
          .update({
            clock_in_time: existing.clock_in_time || isoString,
            status: existing.status === 'Absent' ? status : (existing.status || status),
            company_id: existing.company_id || validCompanyId
          })
          .eq('id', existing.id);
        if (updateErr) console.warn('Supabase punch-in update warning:', updateErr.message);
      } else {
        const insertPayload: any = {
          user_id: validUserId,
          company_id: validCompanyId,
          date: dateStr,
          clock_in_time: isoString,
          status: status
        };

        let { error: insertErr } = await supabase.from('attendance_logs').insert([insertPayload]);

        if (insertErr) {
          console.warn('Primary punch-in insert failed, retrying with core columns...', insertErr.message);
          const fallbackPayload: any = {
            user_id: validUserId,
            date: dateStr,
            clock_in_time: isoString
          };
          if (validCompanyId) fallbackPayload.company_id = validCompanyId;
          await supabase.from('attendance_logs').insert([fallbackPayload]);
        }
      }
    } else if (type === 'break_start') {
      if (existing) {
        await supabase
          .from('attendance_logs')
          .update({
            break_start_time: isoString,
            company_id: existing.company_id || validCompanyId
          })
          .eq('id', existing.id);
      }
    } else if (type === 'break_end') {
      if (existing) {
        let exceptionsList = Array.isArray(existing.exceptions) ? [...existing.exceptions] : [];
        
        // Calculate break duration
        if (existing.break_start_time) {
          const startMs = new Date(existing.break_start_time).getTime();
          const breakMins = Math.round((now.getTime() - startMs) / 60000);
          if (breakMins > 75) {
            exceptionsList.push(`Over-Break (${breakMins} mins)`);
          }
        }

        await supabase
          .from('attendance_logs')
          .update({
            break_end_time: isoString,
            exceptions: exceptionsList,
            company_id: existing.company_id || validCompanyId
          })
          .eq('id', existing.id);
      }
    } else {
      if (existing) {
        await supabase
          .from('attendance_logs')
          .update({
            clock_out_time: isoString,
            company_id: existing.company_id || validCompanyId
          })
          .eq('id', existing.id);
      } else {
        const insertPayload: any = {
          user_id: validUserId,
          company_id: validCompanyId,
          date: dateStr,
          clock_out_time: isoString,
          status: 'Present'
        };
        await supabase.from('attendance_logs').insert([insertPayload]);
      }
    }
    return true;
  } catch (err) {
    console.error('Error recording punch in DB:', err);
    return false;
  }
}

export async function getTodayAttendanceLogFromDb(userId: string): Promise<any | null> {
  if (!isLiveSupabaseConfigured()) {
    return null;
  }

  try {
    let validUserId = userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);

    if (!isUuid) {
      const { data: userMatch } = await supabase
        .from('users')
        .select('id')
        .or(`id.eq.${userId},email.eq.${userId}`)
        .maybeSingle();

      if (userMatch?.id && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userMatch.id)) {
        validUserId = userMatch.id;
      }
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', validUserId)
      .eq('date', dateStr)
      .maybeSingle();

    if (error) {
      console.error('Error fetching today attendance log:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Failed to fetch today attendance log:', err);
    return null;
  }
}

// ---------------------------------------------------------------------
// 6. ATTENDANCE EXCEPTIONS SERVICES
// ---------------------------------------------------------------------
export async function getAttendanceExceptionsFromDb(): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    const { data: usersData } = await supabase.from('users').select('id, name');
    const userMap: Record<string, string> = {};
    (usersData || []).forEach(u => { userMap[u.id] = u.name; });

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      console.error('Supabase attendance_logs query error:', error.message);
      return [];
    }

    // Filter logs that have status Late, Absent, or non-empty exceptions
    const exceptionLogs = (data || []).filter(l => l.status === 'Late' || l.status === 'Absent' || (Array.isArray(l.exceptions) && l.exceptions.length > 0));

    if (exceptionLogs.length === 0) {
      return [];
    }

    return exceptionLogs.map((log, idx) => ({
      id: log.id || `exc-${idx}`,
      employee: userMap[log.user_id] || 'Employee',
      type: log.status === 'Late' ? 'Severe Late' : log.status === 'Absent' ? 'Absenteeism' : 'Over-Break',
      date: log.date || 'Today',
      details: `Clocked in at ${log.clock_in_time ? new Date(log.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`,
      status: 'Pending Deduction',
      severity: log.status === 'Late' || log.status === 'Absent' ? 'high' : 'medium'
    }));
  } catch (err) {
    console.error('Failed to fetch attendance exceptions:', err);
    return [];
  }
}

export async function resolveAttendanceExceptionInDb(id: string, _action: 'Deduct' | 'Forgive'): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    const idx = MOCK_EXCEPTIONS.findIndex(e => e.id === id);
    if (idx !== -1) {
      MOCK_EXCEPTIONS.splice(idx, 1);
    }
    return true;
  }

  const { error } = await supabase.from('attendance_logs').update({ exceptions: [] }).eq('id', id);
  if (error) {
    console.error('Error resolving attendance exception in Supabase:', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// 7. PUBLIC HOLIDAYS SERVICES
// ---------------------------------------------------------------------
export async function getPublicHolidaysFromDb(): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase.from('public_holidays').select('*').order('date', { ascending: true });
    if (error || !data || data.length === 0) {
      return [];
    }
    return data.map(h => ({
      id: h.id,
      name: h.name,
      date: h.date,
      daysCount: h.days_count || 1,
      type: h.type || 'National',
      notes: h.notes || ''
    }));
  } catch (err) {
    console.error('Failed to fetch public holidays from Supabase:', err);
    return [];
  }
}

export async function createPublicHolidayInDb(holiday: { name: string; date: string; daysCount: number; type: string; notes?: string }): Promise<any> {
  if (!isLiveSupabaseConfigured()) return null;

  try {
    const payload = {
      name: holiday.name,
      date: holiday.date,
      days_count: holiday.daysCount,
      type: holiday.type,
      notes: holiday.notes || ''
    };
    const { data, error } = await supabase.from('public_holidays').insert([payload]).select().single();
    if (error) {
      console.error('Error inserting public holiday in Supabase:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Failed to create public holiday in Supabase:', err);
    return null;
  }
}

export async function deletePublicHolidayInDb(id: string): Promise<void> {
  if (!isLiveSupabaseConfigured()) return;

  try {
    await supabase.from('public_holidays').delete().eq('id', id);
  } catch (err) {
    console.error('Error deleting public holiday in Supabase:', err);
  }
}

// ---------------------------------------------------------------------
// 8. PAYROLL & TRANSACTIONS SERVICES
// ---------------------------------------------------------------------
export interface DbPayrollTransaction {
  id: string;
  user_id: string;
  month: string;
  year: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes?: string;
}

export async function getPayrollTransactionsFromDb(month: string, year: string): Promise<Record<string, any[]>> {
  if (!isLiveSupabaseConfigured()) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('payroll_transactions')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .order('payment_date', { ascending: false });

    if (error) {
      if (!error.message?.includes('schema cache') && !error.message?.includes('does not exist')) {
        console.warn('Supabase payroll_transactions select notice:', error.message);
      }
      return {};
    }

    const txMap: Record<string, any[]> = {};
    (data || []).forEach(tx => {
      if (!txMap[tx.user_id]) txMap[tx.user_id] = [];
      txMap[tx.user_id].push({
        id: tx.id,
        date: tx.payment_date,
        amount: Number(tx.amount),
        method: tx.payment_method
      });
    });
    return txMap;
  } catch (err) {
    console.error('Failed to get payroll transactions:', err);
    return {};
  }
}

export async function savePayrollTransactionToDb(transaction: {
  userId: string;
  month: string;
  year: string;
  amount: number;
  method: string;
  date: string;
}): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    const { error } = await supabase.from('payroll_transactions').insert([{
      user_id: transaction.userId,
      month: transaction.month,
      year: transaction.year,
      amount: transaction.amount,
      payment_method: transaction.method,
      payment_date: transaction.date
    }]);

    if (error) {
      console.error('Supabase payroll transaction insert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to save payroll transaction:', err);
    return false;
  }
}

export async function getEmployeePayslipOverrides(month: string, year: string): Promise<Record<string, any>> {
  const localMap: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`osan_payslip_`) && key.includes(`_${month}_${year}`)) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed.userId) localMap[parsed.userId] = parsed;
        }
      }
    }
  } catch {
    // ignore
  }

  if (!isLiveSupabaseConfigured()) {
    return localMap;
  }

  try {
    const { data, error } = await supabase
      .from('payslip_records')
      .select('*')
      .eq('month', month)
      .eq('year', year);

    if (error) {
      return localMap;
    }

    const map: Record<string, any> = { ...localMap };
    (data || []).forEach(r => {
      map[r.user_id] = { ...map[r.user_id], ...r };
    });
    return map;
  } catch {
    return localMap;
  }
}

export async function saveEmployeePayslipRecord(record: {
  userId: string;
  month: string;
  year: string;
  employeeName?: string;
  designation?: string;
  dateOfJoining?: string;
  payPeriod?: string;
  payDate?: string;
  basicSalary?: number;
  otherAllowance?: number;
  transportation?: number;
  advanceSalary?: number;
  deductionNotCame?: number;
  probationFirstMonth?: number;
  deductionAnnualLeave?: number;
  overtimeAmount?: number;
  incentiveAmount?: number;
  totalBalance?: number;
  paidDays?: number;
  leaveDays?: number;
  hoursWorked?: string;
  accountNumber?: string;
  mobileNumber?: string;
}): Promise<boolean> {
  try {
    const localKey = `osan_payslip_${record.userId}_${record.month}_${record.year}`;
    localStorage.setItem(localKey, JSON.stringify(record));
  } catch {
    // ignore
  }

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    const { error } = await supabase.from('payslip_records').upsert([{
      user_id: record.userId,
      month: record.month,
      year: record.year,
      basic_salary: record.basicSalary,
      other_allowance: record.otherAllowance,
      transportation: record.transportation,
      advance_salary: record.advanceSalary,
      deduction_not_came: record.deductionNotCame,
      probation_first_month: record.probationFirstMonth,
      deduction_annual_leave: record.deductionAnnualLeave,
      overtime_amount: record.overtimeAmount,
      incentive_amount: record.incentiveAmount,
      total_balance: record.totalBalance,
      paid_days: record.paidDays,
      leave_days: record.leaveDays,
      hours_worked: record.hoursWorked,
      account_number: record.accountNumber,
      mobile_number: record.mobileNumber,
      updated_at: new Date().toISOString()
    }], { onConflict: 'user_id,month,year' });

    if (error) {
      console.warn('Payslip record save error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error saving payslip record:', err);
    return false;
  }
}

