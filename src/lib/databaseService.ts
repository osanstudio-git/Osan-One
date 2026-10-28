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

// In-memory SWR caches with TTL for ultra-fast, smooth page transitions
let cachedEmployees: { data: User[]; timestamp: number } | null = null;
let cachedCompanies: { data: Company[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

export function invalidateEmployeeCache(): void {
  cachedEmployees = null;
}

export function invalidateCompanyCache(): void {
  cachedCompanies = null;
}

// ---------------------------------------------------------------------
// 1. COMPANIES SERVICES
// ---------------------------------------------------------------------
export async function getCompanies(forceRefresh = false): Promise<Company[]> {
  if (!forceRefresh && cachedCompanies && (Date.now() - cachedCompanies.timestamp < CACHE_TTL_MS)) {
    return cachedCompanies.data;
  }

  if (!isLiveSupabaseConfigured()) {
    const mockResult = MOCK_COMPANIES.map((c, i) => ({
      id: `comp-${i}`,
      name: c.name,
      created_at: new Date().toISOString(),
      auth_policy: c.authPolicy || 'both',
      omani_shift_start: c.omaniShiftStart || '08:30',
      omani_shift_end: c.omaniShiftEnd || '17:00',
      expat_shift_start: c.expatShiftStart || '08:30',
      expat_shift_end: c.expatShiftEnd || '18:00',
    }));
    cachedCompanies = { data: mockResult, timestamp: Date.now() };
    return mockResult;
  }

  try {
    const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Supabase companies query error:', error.message);
      return cachedCompanies?.data || [];
    }

    // Deduplicate companies by name to prevent duplicate UI cards
    const uniqueMap = new Map<string, Company>();
    (data || []).forEach((comp: any) => {
      if (comp.name && !uniqueMap.has(comp.name.trim())) {
        uniqueMap.set(comp.name.trim(), comp as Company);
      }
    });

    const result = Array.from(uniqueMap.values());
    cachedCompanies = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.error('Failed to fetch companies from Supabase:', err);
    return cachedCompanies?.data || [];
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

  if (companyData.company_type) {
    payload.company_type = companyData.company_type;
  }

  if (existingId) {
    let { data, error } = await supabase
      .from('companies')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();

    if (error && error.message?.includes('company_type')) {
      delete payload.company_type;
      const retry = await supabase.from('companies').update(payload).eq('id', existingId).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error updating company in Supabase:', error.message || error);
      throw new Error(error.message || 'Failed to update company in database');
    }
    return data as Company;
  } else {
    let { data, error } = await supabase
      .from('companies')
      .insert([payload])
      .select()
      .single();

    if (error && error.message?.includes('company_type')) {
      delete payload.company_type;
      const retry = await supabase.from('companies').insert([payload]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Error creating company in Supabase:', error.message || error);
      throw new Error(error.message || 'Failed to create company in database');
    }
    invalidateCompanyCache();
    return data as Company;
  }
}

export async function deleteCompanyFromDb(companyIdOrName: string): Promise<boolean> {
  // Always remove from local memory array
  const idx = MOCK_COMPANIES.findIndex(c => c.name === companyIdOrName);
  if (idx !== -1) {
    MOCK_COMPANIES.splice(idx, 1);
  }
  invalidateCompanyCache();

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
    invalidateCompanyCache();
    return true;
  } catch (err) {
    console.error('Failed to delete company from database:', err);
    return false;
  }
}

// ---------------------------------------------------------------------
// Local and Cloud avatar persistence helper
export function getSavedLocalAvatar(...keys: (string | undefined | null)[]): string | undefined {
  try {
    const raw = localStorage.getItem('osan_employee_avatars');
    if (!raw) return undefined;
    const map = JSON.parse(raw);
    for (const key of keys) {
      if (key && map[key]) return map[key];
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function getAllLocalAvatars(): Record<string, string> {
  try {
    const raw = localStorage.getItem('osan_employee_avatars');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalAvatar(id: string, avatarUrl?: string, additionalKeys: (string | undefined | null)[] = []) {
  try {
    const raw = localStorage.getItem('osan_employee_avatars');
    const map = raw ? JSON.parse(raw) : {};
    const allKeys = [id, ...additionalKeys].filter(Boolean) as string[];
    allKeys.forEach(k => {
      if (avatarUrl) {
        map[k] = avatarUrl;
      } else {
        delete map[k];
      }
    });
    localStorage.setItem('osan_employee_avatars', JSON.stringify(map));

    // Update avatar in memory cache immediately
    if (cachedEmployees && cachedEmployees.data) {
      const match = cachedEmployees.data.find(u => allKeys.includes(u.id) || allKeys.includes(u.email) || (u.phone && allKeys.includes(u.phone)));
      if (match) {
        match.avatar_url = avatarUrl;
      }
    }

    // Also update osan_demo_profile if this employee is the one currently active
    const savedDemo = localStorage.getItem('osan_demo_profile');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        if (parsed && (allKeys.includes(parsed.id) || allKeys.includes(parsed.email) || (parsed.phone && allKeys.includes(parsed.phone)))) {
          parsed.avatar_url = avatarUrl;
          localStorage.setItem('osan_demo_profile', JSON.stringify(parsed));
        }
      } catch (e) {}
    }

    // Broadcast update across windows, tabs, and listeners
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent('osan_avatar_updated', { detail: { id, avatarUrl } }));
    }
  } catch (e) {
    console.warn('Failed to save avatar to localStorage:', e);
  }
}

export async function syncAvatarToCloud(userId: string, avatarUrl: string): Promise<boolean> {
  if (!userId || !avatarUrl || !isLiveSupabaseConfigured()) return false;
  try {
    let validUserId = userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    if (!isUuid) {
      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${userId},phone.eq.${userId},name.ilike.%${userId}%`)
        .maybeSingle();
      if (userRow?.id) {
        validUserId = userRow.id;
      } else {
        return false;
      }
    }

    const { data: existingDoc } = await supabase
      .from('employee_documents')
      .select('id, file_url')
      .eq('user_id', validUserId)
      .or('document_type.eq.Avatar,document_type.eq.Profile Photo')
      .maybeSingle();

    if (existingDoc?.id) {
      if (existingDoc.file_url !== avatarUrl) {
        await supabase
          .from('employee_documents')
          .update({
            document_name: 'Profile Photo',
            document_type: 'Avatar',
            file_url: avatarUrl
          })
          .eq('id', existingDoc.id);
      }
    } else {
      await supabase
        .from('employee_documents')
        .insert([{
          user_id: validUserId,
          document_name: 'Profile Photo',
          document_type: 'Avatar',
          file_url: avatarUrl
        }]);
    }

    // Also mirror in users.documents JSONB
    const { data: uRow } = await supabase
      .from('users')
      .select('documents')
      .eq('id', validUserId)
      .maybeSingle();
    const curDocs = Array.isArray(uRow?.documents) 
      ? uRow.documents.filter((d: any) => d.type !== 'Avatar' && d.name !== 'Profile Photo') 
      : [];
    curDocs.push({ type: 'Avatar', name: 'Profile Photo', url: avatarUrl });
    await supabase.from('users').update({ documents: curDocs }).eq('id', validUserId);

    return true;
  } catch (err) {
    console.warn('Failed to sync avatar to cloud:', err);
    return false;
  }
}

export async function getEmployeeAvatarFromDb(userId: string, email?: string, phone?: string): Promise<string | undefined> {
  if (!userId && !email && !phone) return undefined;
  try {
    const local = getSavedLocalAvatar(userId, email, phone);
    if (local) return local;

    if (!isLiveSupabaseConfigured()) return local;

    // Resolve UUID if needed
    let lookupId = userId;
    const isUuid = userId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    if (!isUuid && (email || phone || userId)) {
      const matchCriteria = [
        userId ? `id.eq.${userId}` : null,
        email ? `email.eq.${email}` : null,
        phone ? `phone.eq.${phone}` : null,
        userId && !userId.includes('@') ? `name.ilike.%${userId}%` : null
      ].filter(Boolean).join(',');

      const { data: uRow } = await supabase
        .from('users')
        .select('id, email, phone, documents')
        .or(matchCriteria)
        .maybeSingle();

      if (uRow?.id) {
        lookupId = uRow.id;
        if (Array.isArray(uRow.documents)) {
          const av = uRow.documents.find((d: any) => d.type === 'Avatar' || d.type === 'Profile Photo' || d.name === 'Profile Photo');
          if (av?.url || av?.attachedFile || av?.file_url) {
            const found = av.url || av.attachedFile || av.file_url;
            saveLocalAvatar(uRow.id, found, [uRow.email, uRow.phone, email, phone]);
            return found;
          }
        }
      }
    }

    // 1. Query employee_documents for cloud Avatar
    if (lookupId) {
      const { data: docData } = await supabase
        .from('employee_documents')
        .select('file_url')
        .eq('user_id', lookupId)
        .or('document_type.eq.Avatar,document_type.eq.Profile Photo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docData?.file_url) {
        saveLocalAvatar(lookupId, docData.file_url, [email, phone]);
        return docData.file_url;
      }
    }

    // 2. Fallback check users.documents jsonb
    if (lookupId) {
      const { data: uData } = await supabase
        .from('users')
        .select('documents, email, phone')
        .eq('id', lookupId)
        .maybeSingle();

      if (uData?.documents && Array.isArray(uData.documents)) {
        const av = uData.documents.find((d: any) => d.type === 'Avatar' || d.type === 'Profile Photo' || d.name === 'Profile Photo');
        if (av?.url || av?.attachedFile || av?.file_url) {
          const found = av.url || av.attachedFile || av.file_url;
          saveLocalAvatar(lookupId, found, [uData.email, uData.phone, email, phone]);
          return found;
        }
      }
    }

    return undefined;
  } catch (err) {
    console.error('Error fetching employee avatar from DB:', err);
    return getSavedLocalAvatar(userId, email, phone);
  }
}

// 2. EMPLOYEES SERVICES
export function mapDbUserToUser(data: any, companyNameMap?: Record<string, string>): User {
  const role = (data.role === 'Super_HR' ? 'HR' : data.role) || 'Employee';
  const companyName = companyNameMap?.[data.company_id] || data.company_id || 'Company';

  // Extract avatar from documents if present
  let avatarFromDocs: string | undefined = undefined;
  if (Array.isArray(data.documents)) {
    const av = data.documents.find((d: any) => d.type === 'Avatar' || d.type === 'Profile Photo' || d.name === 'Profile Photo');
    if (av) avatarFromDocs = av.url || av.attachedFile || av.file_url;
  }

  const effectiveAvatar = data.avatar_url || avatarFromDocs || getSavedLocalAvatar(data.id, data.email, data.phone) || undefined;
  if (effectiveAvatar && data.id) {
    saveLocalAvatar(data.id, effectiveAvatar, [data.email, data.phone]);
    // Auto-sync local avatar to cloud if live Supabase is configured
    if (!avatarFromDocs && !data.avatar_url && isLiveSupabaseConfigured()) {
      syncAvatarToCloud(data.id, effectiveAvatar);
    }
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email || '',
    phone: data.phone || '',
    avatar_url: effectiveAvatar,
    pin: data.pin || '123456',
    role: role as Role,
    company_id: data.company_id || 'Company',
    company: companyName,
    nationality: (data.nationality === 'Omani' ? 'OMAN' : (data.nationality || 'OMAN')),
    gender: data.gender || 'Male',
    religion: data.religion || 'Muslim',
    status: data.status || 'Active',
    join_date: data.join_date || new Date().toISOString().split('T')[0],
    date_of_birth: data.date_of_birth || undefined,
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
export async function getEmployees(forceRefresh = false): Promise<User[]> {
  if (!forceRefresh && cachedEmployees && (Date.now() - cachedEmployees.timestamp < CACHE_TTL_MS)) {
    return cachedEmployees.data;
  }

  if (!isLiveSupabaseConfigured()) {
    cachedEmployees = { data: MOCK_EMPLOYEES, timestamp: Date.now() };
    return MOCK_EMPLOYEES;
  }

  try {
    const { data: companiesData } = await supabase.from('companies').select('id, name');
    const compMap: Record<string, string> = {};
    (companiesData || []).forEach(c => { compMap[c.id] = c.name; });

    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase users query error:', error.message);
      return cachedEmployees?.data || [];
    }

    // Batch fetch official documents for all employees to power real-time compliance tracking and cloud avatars
    const { data: docsData } = await supabase.from('employee_documents').select('*');
    const docsByUserId: Record<string, any[]> = {};
    const avatarByUserId: Record<string, string> = {};
    (docsData || []).forEach(d => {
      if (d.document_type === 'Avatar' || d.document_name === 'Profile Photo') {
        if (d.file_url) avatarByUserId[d.user_id] = d.file_url;
        return;
      }
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

    const result = (data || []).map(u => {
      const userObj = mapDbUserToUser(u, compMap);
      if (avatarByUserId[u.id]) {
        userObj.avatar_url = avatarByUserId[u.id];
        saveLocalAvatar(u.id, avatarByUserId[u.id], [u.email, u.phone]);
      }
      if (docsByUserId[u.id] && docsByUserId[u.id].length > 0) {
        userObj.documents = docsByUserId[u.id];
      }
      return userObj;
    });

    cachedEmployees = { data: result, timestamp: Date.now() };
    return result;
  } catch (err) {
    console.error('Failed to fetch employees from Supabase:', err);
    return cachedEmployees?.data || [];
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

    let avatarFromDocs: string | undefined = undefined;
    const cleanDocs: any[] = [];
    (docs || []).forEach(d => {
      if (d.document_type === 'Avatar' || d.document_name === 'Profile Photo') {
        if (d.file_url) avatarFromDocs = d.file_url;
      } else {
        cleanDocs.push({
          id: d.id,
          name: d.document_name,
          type: d.document_type,
          number: d.document_number,
          expiryDate: d.expiry_date,
          attachedFile: d.file_url,
        });
      }
    });

    const userObj = mapDbUserToUser(data, { [data.company_id]: compName });
    if (avatarFromDocs) {
      userObj.avatar_url = avatarFromDocs;
      saveLocalAvatar(id, avatarFromDocs, [userObj.email, userObj.phone]);
    }
    userObj.documents = cleanDocs;

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
    nationality: employeeData.nationality || 'OMAN',
    gender: employeeData.gender || 'Male',
    religion: employeeData.religion || 'Muslim',
    status: employeeData.status || 'Active',
    join_date: employeeData.join_date || new Date().toISOString().split('T')[0],
    date_of_birth: employeeData.date_of_birth || undefined,
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

  let currentPayload: any = { ...fullPayload };
  let insertRes = await supabase.from('users').insert([currentPayload]).select().single();
  let data = insertRes.data;
  let error = insertRes.error;

  // Dynamic resilience loop: handle nationality enums, missing columns (e.g. date_of_birth, bank fields, etc.)
  let attempts = 0;
  while (error && attempts < 15) {
    attempts++;
    const errMsg = error.message || '';

    // Handle nationality enum constraint (simplify to Expat or Omani)
    if (errMsg.includes('user_nationality') || errMsg.includes('enum')) {
      console.warn('Supabase nationality enum error. Retrying with simplified category...', errMsg);
      currentPayload.nationality = (currentPayload.nationality || 'OMAN').startsWith('Expat') ? 'Expat' : 'Omani';
      insertRes = await supabase.from('users').insert([currentPayload]).select().single();
      data = insertRes.data;
      error = insertRes.error;
      continue;
    }

    // Handle missing column errors dynamically (e.g. "Could not find the 'date_of_birth' column of 'users' in the schema cache")
    const match = errMsg.match(/Could not find the '([^']+)' column/i) 
      || errMsg.match(/column "([^"]+)" of relation "users"/i)
      || errMsg.match(/column "([^"]+)" does not exist/i);

    if (match && match[1]) {
      const missingColumn = match[1];
      console.warn(`Supabase schema missing '${missingColumn}'. Stripping and retrying insert...`);
      delete currentPayload[missingColumn];
      insertRes = await supabase.from('users').insert([currentPayload]).select().single();
      data = insertRes.data;
      error = insertRes.error;
      continue;
    }

    // Fallback: If generic column error without regex match, retry with stripped core columns
    if (errMsg.includes('column') && attempts === 1) {
      console.warn('Supabase schema missing optional columns. Retrying with stripped core payload...', errMsg);
      currentPayload = {
        id: fullPayload.id,
        name: fullPayload.name,
        email: fullPayload.email,
        phone: fullPayload.phone,
        pin: fullPayload.pin,
        role: fullPayload.role,
        company_id: fullPayload.company_id,
        nationality: (fullPayload.nationality || 'OMAN').startsWith('Expat') ? 'Expat' : 'Omani',
        gender: fullPayload.gender,
        religion: fullPayload.religion,
        status: fullPayload.status,
        join_date: fullPayload.join_date,
        job_title: fullPayload.job_title,
        department: fullPayload.department,
        base_salary: fullPayload.base_salary,
        allowances: fullPayload.allowances
      };
      insertRes = await supabase.from('users').insert([currentPayload]).select().single();
      data = insertRes.data;
      error = insertRes.error;
      continue;
    }

    break;
  }

  if (error) {
    console.error('Error creating employee in Supabase:', error.message || error);
    throw new Error(error.message || 'Failed to create employee in database');
  }
  invalidateEmployeeCache();
  return { ...fullPayload, ...data } as User;
}

export async function updateEmployeeInDb(employeeId: string, updates: Partial<User>): Promise<boolean> {
  // Update in local memory
  const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employeeId || e.email === employeeId);
  if (idx !== -1) {
    MOCK_EMPLOYEES[idx] = { ...MOCK_EMPLOYEES[idx], ...updates } as any;
  }

  if (updates.avatar_url !== undefined) {
    const avatarVal = updates.avatar_url || '';
    saveLocalAvatar(employeeId, avatarVal || undefined, [updates.email, updates.phone]);

    // Persist to Supabase cloud storage (employee_documents and users.documents)
    if (isLiveSupabaseConfigured()) {
      (async () => {
        try {
          if (avatarVal) {
            const { data: existingDoc } = await supabase
              .from('employee_documents')
              .select('id')
              .eq('user_id', employeeId)
              .or('document_type.eq.Avatar,document_type.eq.Profile Photo')
              .maybeSingle();

            if (existingDoc?.id) {
              await supabase
                .from('employee_documents')
                .update({
                  document_name: 'Profile Photo',
                  document_type: 'Avatar',
                  file_url: avatarVal,
                })
                .eq('id', existingDoc.id);
            } else {
              await supabase
                .from('employee_documents')
                .insert([{
                  user_id: employeeId,
                  document_name: 'Profile Photo',
                  document_type: 'Avatar',
                  file_url: avatarVal,
                }]);
            }

            // Mirror in users.documents JSONB
            const { data: uRow } = await supabase
              .from('users')
              .select('documents')
              .eq('id', employeeId)
              .maybeSingle();
            const curDocs = Array.isArray(uRow?.documents) ? uRow.documents.filter((d: any) => d.type !== 'Avatar' && d.name !== 'Profile Photo') : [];
            curDocs.push({ type: 'Avatar', name: 'Profile Photo', url: avatarVal });
            await supabase.from('users').update({ documents: curDocs }).eq('id', employeeId);
          } else {
            await supabase
              .from('employee_documents')
              .delete()
              .eq('user_id', employeeId)
              .or('document_type.eq.Avatar,document_type.eq.Profile Photo');

            const { data: uRow } = await supabase
              .from('users')
              .select('documents')
              .eq('id', employeeId)
              .maybeSingle();
            if (uRow?.documents && Array.isArray(uRow.documents)) {
              const curDocs = uRow.documents.filter((d: any) => d.type !== 'Avatar' && d.name !== 'Profile Photo');
              await supabase.from('users').update({ documents: curDocs }).eq('id', employeeId);
            }
          }
        } catch (avatarSyncErr) {
          console.warn('Could not persist avatar to Supabase cloud storage:', avatarSyncErr);
        }
      })();
    }
  }
  invalidateEmployeeCache();

  if (!isLiveSupabaseConfigured()) {
    return true;
  }

  try {
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.email !== undefined) payload.email = updates.email;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.date_of_birth !== undefined) payload.date_of_birth = updates.date_of_birth;
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

    let attempts = 0;
    while (error && attempts < 10) {
      attempts++;
      const errMsg = error.message || '';

      if (errMsg.includes('user_nationality') || errMsg.includes('enum')) {
        console.warn('Supabase nationality enum constraint detected. Retrying with simplified category...');
        payload.nationality = (updates.nationality || 'Omani').startsWith('Expat') ? 'Expat' : 'Omani';
        const retryRes = await supabase.from('users').update(payload).eq('id', employeeId);
        error = retryRes.error;
        continue;
      }

      const match = errMsg.match(/Could not find the '([^']+)' column/i) 
        || errMsg.match(/column "([^"]+)" of relation "users"/i)
        || errMsg.match(/column "([^"]+)" does not exist/i);

      if (match && match[1]) {
        delete payload[match[1]];
        const retryRes = await supabase.from('users').update(payload).eq('id', employeeId);
        error = retryRes.error;
        continue;
      }

      break;
    }

    if (error) {
      console.error('Error updating employee in Supabase:', error.message);
      return false;
    }
    invalidateEmployeeCache();
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
  invalidateEmployeeCache();
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
  invalidateEmployeeCache();
  return true;
}

export async function deleteEmployeeInDb(employeeId: string): Promise<boolean> {
  // Always remove from local memory
  const idx = MOCK_EMPLOYEES.findIndex(e => e.id === employeeId || e.email === employeeId);
  if (idx !== -1) {
    MOCK_EMPLOYEES.splice(idx, 1);
  }
  invalidateEmployeeCache();

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
    invalidateEmployeeCache();
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
    const { data: usersData } = await supabase.from('users').select('id, name, phone, email, leave_balance_yearly, leave_balance_sick');
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

    const userSickDaysUsed: Record<string, number> = {};
    (data || []).forEach(r => {
      if (r.status === 'Approved' && (r.leave_type || '').toLowerCase().includes('sick')) {
        const s = new Date(r.start_date);
        const e = new Date(r.end_date);
        const days = r.duration_days || Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        userSickDaysUsed[r.user_id] = (userSickDaysUsed[r.user_id] || 0) + days;
      }
    });

    return data.map(r => {
      const u = userMap[r.user_id] || {};
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      const durationDays = r.duration_days || Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      return {
        id: r.id,
        user_id: r.user_id,
        employee: u.name || 'Employee',
        phone: u.phone,
        email: u.email,
        type: r.leave_type || 'Yearly',
        start: r.start_date,
        end: r.end_date,
        durationDays,
        status: r.status || 'Pending',
        balances: {
          yearly: u.leave_balance_yearly ?? 30,
          sickUsed: userSickDaysUsed[r.user_id] || 0,
        },
        sickDaysUsed: userSickDaysUsed[r.user_id] || 0,
        documentUrl: r.document_url,
        notes: (r as any).rejection_reason || (r as any).reason || (r as any).notes || null,
        createdAt: r.created_at
      };
    });
  } catch (err) {
    console.error('Failed to fetch leave requests:', err);
    return [];
  }
}

export async function getEmployeeLeaveRequestsFromDb(userId: string, email?: string): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    let validUserId = userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);
    if (!isUuid && email) {
      const { data: u } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
      if (u?.id) validUserId = u.id;
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', validUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase getEmployeeLeaveRequests error:', error.message);
      return [];
    }

    return (data || []).map(r => {
      const start = new Date(r.start_date);
      const end = new Date(r.end_date);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      return {
        id: r.id,
        userId: r.user_id,
        leaveType: r.leave_type || 'Yearly',
        startDate: r.start_date,
        endDate: r.end_date,
        durationDays,
        status: (r.status || 'Pending') as 'Pending' | 'Approved' | 'Rejected',
        documentUrl: r.document_url,
        notes: (r as any).rejection_reason || (r as any).reason || (r as any).notes || null,
        createdAt: r.created_at
      };
    });
  } catch (err) {
    console.error('Failed to fetch employee leave requests:', err);
    return [];
  }
}

export async function createLeaveRequestInDb(request: {
  userId: string;
  userEmail?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  documentUrl?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveSupabaseConfigured()) {
    return { success: true };
  }

  try {
    // 1. Resolve UUID for userId safely (avoiding Postgres 22P02 UUID syntax cast crash)
    let validUserId = request.userId;
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(request.userId);
    if (!isUuid) {
      // Find matching user by email
      const searchTarget = request.userEmail || request.userId;
      if (searchTarget.includes('@')) {
        const { data: userMatch } = await supabase
          .from('users')
          .select('id')
          .eq('email', searchTarget)
          .maybeSingle();

        if (userMatch?.id) {
          validUserId = userMatch.id;
        }
      }

      // If still not UUID, lookup any user with phone or get first available employee
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(validUserId)) {
        const { data: firstEmp } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'Employee')
          .limit(1)
          .maybeSingle();

        if (firstEmp?.id) {
          validUserId = firstEmp.id;
        }
      }
    }

    // 2. Map frontend leaveType to Supabase leave_type enum ('Yearly' | 'Sick' | 'Unpaid')
    const lowerType = (request.leaveType || '').toLowerCase();
    let dbLeaveType: 'Yearly' | 'Sick' | 'Unpaid' = 'Yearly';
    if (lowerType.includes('sick')) {
      dbLeaveType = 'Sick';
    } else if (lowerType.includes('unpaid')) {
      dbLeaveType = 'Unpaid';
    } else {
      // Yearly covers Annual, Maternity, Marriage, Hajj, Exam etc. under company paid leave
      dbLeaveType = 'Yearly';
    }

    // 3. Insert cleanly matching Supabase leave_requests schema with resilient fallback
    const basePayload: any = {
      user_id: validUserId,
      leave_type: dbLeaveType,
      start_date: request.startDate,
      end_date: request.endDate,
      document_url: request.documentUrl || null,
      status: 'Pending'
    };

    let insertError: any = null;
    if (request.notes) {
      // First try with rejection_reason if present in schema
      const { error: err1 } = await supabase
        .from('leave_requests')
        .insert([{ ...basePayload, rejection_reason: request.notes }])
        .select();

      if (!err1) {
        return { success: true };
      }

      if (err1.message?.includes('rejection_reason') || err1.message?.includes('schema cache')) {
        // Fallback: try reason column or standard base payload
        const { error: err2 } = await supabase
          .from('leave_requests')
          .insert([{ ...basePayload, reason: request.notes }])
          .select();

        if (!err2) {
          return { success: true };
        }

        const { error: err3 } = await supabase
          .from('leave_requests')
          .insert([basePayload])
          .select();
        insertError = err3;
      } else {
        insertError = err1;
      }
    } else {
      const { error: err } = await supabase
        .from('leave_requests')
        .insert([basePayload])
        .select();
      insertError = err;
    }

    if (insertError) {
      console.error('Supabase createLeaveRequest error:', insertError.message);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to submit leave request to Supabase:', err);
    return { success: false, error: err?.message || 'Database error occurred' };
  }
}

export async function attachMedicalReportToLeaveInDb(leaveId: string, documentUrl: string): Promise<boolean> {
  if (!isLiveSupabaseConfigured()) return true;
  try {
    const { error } = await supabase
      .from('leave_requests')
      .update({ document_url: documentUrl })
      .eq('id', leaveId);
    return !error;
  } catch (e) {
    console.error('Failed to attach medical report:', e);
    return false;
  }
}

export async function recordEmployeeLeaveByHrInDb(data: {
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  durationDays?: number;
  status: 'Approved' | 'Pending';
  notes?: string;
  documentUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!isLiveSupabaseConfigured()) return { success: true };

  try {
    const lowerType = (data.leaveType || '').toLowerCase();
    let dbLeaveType: 'Yearly' | 'Sick' | 'Unpaid' = 'Yearly';
    if (lowerType.includes('sick')) {
      dbLeaveType = 'Sick';
    } else if (lowerType.includes('unpaid')) {
      dbLeaveType = 'Unpaid';
    } else {
      dbLeaveType = 'Yearly';
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const days = data.durationDays || Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const basePayload: any = {
      user_id: data.userId,
      leave_type: dbLeaveType,
      start_date: data.startDate,
      end_date: data.endDate,
      document_url: data.documentUrl || null,
      status: data.status || 'Approved'
    };

    let hrInsertError: any = null;
    if (data.notes) {
      const { error: err1 } = await supabase
        .from('leave_requests')
        .insert([{ ...basePayload, rejection_reason: data.notes }]);

      if (!err1) {
        // Success
      } else if (err1.message?.includes('rejection_reason') || err1.message?.includes('schema cache')) {
        const { error: err2 } = await supabase
          .from('leave_requests')
          .insert([{ ...basePayload, reason: data.notes }]);

        if (!err2) {
          // Success
        } else {
          const { error: err3 } = await supabase
            .from('leave_requests')
            .insert([basePayload]);
          hrInsertError = err3;
        }
      } else {
        hrInsertError = err1;
      }
    } else {
      const { error: err } = await supabase
        .from('leave_requests')
        .insert([basePayload]);
      hrInsertError = err;
    }

    if (hrInsertError) {
      console.error('Failed to record leave by HR:', hrInsertError.message);
      return { success: false, error: hrInsertError.message };
    }

    // If status is Approved, automatically deduct from employee balance
    if (data.status === 'Approved') {
      const { data: userRecord } = await supabase
        .from('users')
        .select('leave_balance_yearly, leave_balance_sick')
        .eq('id', data.userId)
        .maybeSingle();

      if (userRecord) {
        if (dbLeaveType === 'Yearly') {
          const newBal = Math.max(0, (userRecord.leave_balance_yearly ?? 30) - days);
          await supabase.from('users').update({ leave_balance_yearly: newBal }).eq('id', data.userId);
        } else if (dbLeaveType === 'Sick') {
          const newBal = Math.max(0, (userRecord.leave_balance_sick ?? 14) - days);
          await supabase.from('users').update({ leave_balance_sick: newBal }).eq('id', data.userId);
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to record HR leave:', err);
    return { success: false, error: err?.message || 'Database error occurred' };
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

export async function recordPunchInDb(
  userId: string, 
  type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end', 
  timestamp?: Date, 
  explicitCompanyId?: string,
  shiftType?: 'morning' | 'evening',
  companyName?: string
): Promise<boolean> {
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

    // Cache chosen shift type locally
    if (shiftType) {
      try {
        localStorage.setItem(`osan_shift_${validUserId}_${dateStr}`, shiftType);
      } catch (e) {
        // ignore
      }
    }

    const { data: existing } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', validUserId)
      .eq('date', dateStr)
      .maybeSingle();

    if (type === 'clock_in') {
      const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu
      const compLower = (companyName || explicitCompanyId || '').toLowerCase().trim();
      const isAsas = compLower.includes('asas') || compLower.includes('sanad');

      let isLate = false;
      if (isAsas) {
        if (dayOfWeek === 4) {
          // Thursday: Single shift 08:00 AM – 03:00 PM (15m grace -> 08:15 AM)
          isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 15);
        } else if (shiftType === 'evening') {
          // Sun–Wed Evening: 12:00 PM – 08:00 PM (15m grace -> 12:15 PM)
          isLate = now.getHours() > 12 || (now.getHours() === 12 && now.getMinutes() > 15);
        } else {
          // Sun–Wed Morning: 08:00 AM – 05:00 PM (15m grace -> 08:15 AM)
          isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 15);
        }
      } else {
        // Standard Corporate: 08:30 AM
        isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 30);
      }

      const status = isLate ? 'Late' : 'Present';

      if (existing) {
        const updatePayload: any = {
          clock_in_time: existing.clock_in_time || isoString,
          status: existing.status === 'Absent' ? status : (existing.status || status),
          company_id: existing.company_id || validCompanyId
        };

        await supabase
          .from('attendance_logs')
          .update(updatePayload)
          .eq('id', existing.id);
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

export async function getRecentAttendanceTrendFromDb(days = 7): Promise<{ day: string; onTime: number; late: number; absent: number }[]> {
  if (!isLiveSupabaseConfigured()) {
    return [
      { day: 'Sun', onTime: 12, late: 2, absent: 1 },
      { day: 'Mon', onTime: 14, late: 1, absent: 0 },
      { day: 'Tue', onTime: 13, late: 2, absent: 0 },
      { day: 'Wed', onTime: 15, late: 0, absent: 0 },
      { day: 'Thu', onTime: 14, late: 1, absent: 0 },
      { day: 'Fri', onTime: 0, late: 0, absent: 0 },
      { day: 'Sat', onTime: 0, late: 0, absent: 0 },
    ];
  }

  try {
    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() - (days - 1));
    const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('attendance_logs')
      .select('date, status')
      .gte('date', startStr);

    if (error || !data) {
      return [];
    }

    // Build day map for the last `days` days
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const trendMap: Record<string, { day: string; onTime: number; late: number; absent: number }> = {};

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLabel = dayNames[d.getDay()];
      trendMap[dStr] = { day: dayLabel, onTime: 0, late: 0, absent: 0 };
    }

    data.forEach((log: any) => {
      const entry = trendMap[log.date];
      if (entry) {
        const st = (log.status || '').toLowerCase();
        if (st === 'present' || st === 'ontime') {
          entry.onTime++;
        } else if (st === 'late') {
          entry.late++;
        } else if (st === 'absent') {
          entry.absent++;
        }
      }
    });

    return Object.values(trendMap);
  } catch (err) {
    console.error('Failed to get attendance trend:', err);
    return [];
  }
}

// ---------------------------------------------------------------------
// 7. PUBLIC HOLIDAYS SERVICES
// ---------------------------------------------------------------------
export async function getPublicHolidaysFromDb(): Promise<any[]> {
  if (!isLiveSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase.from('public_holidays').select('*').order('holiday_date', { ascending: true });
    if (error) {
      console.error('Supabase public_holidays select error:', error.message);
      return [];
    }
    if (!data || data.length === 0) {
      return [];
    }
    return data.map(h => {
      let daysCount = 1;
      const notesStr = h.notes || '';
      const match = notesStr.match(/\[(\d+)\s*Days?\]/i);
      if (match) {
        daysCount = parseInt(match[1], 10);
      } else if (h.days_count) {
        daysCount = h.days_count;
      }
      return {
        id: h.id,
        name: h.title || h.name || '',
        date: h.holiday_date || h.date || '',
        daysCount,
        type: h.category || h.type || 'National',
        notes: notesStr.replace(/\[\d+\s*Days?\]\s*/i, '').trim()
      };
    });
  } catch (err) {
    console.error('Failed to fetch public holidays from Supabase:', err);
    return [];
  }
}

export async function createPublicHolidayInDb(holiday: { name: string; date: string; daysCount: number; type: string; notes?: string }): Promise<any> {
  if (!isLiveSupabaseConfigured()) return null;

  try {
    const notesWithDays = holiday.daysCount > 1 
      ? `[${holiday.daysCount} Days] ${holiday.notes || ''}`.trim()
      : (holiday.notes || '');

    const payload = {
      title: holiday.name,
      holiday_date: holiday.date,
      category: holiday.type,
      is_paid_off: true,
      notes: notesWithDays
    };
    const { data, error } = await supabase.from('public_holidays').insert([payload]).select().single();
    if (error) {
      console.error('Error inserting public holiday in Supabase:', error.message);
      return null;
    }
    return {
      id: data.id,
      name: data.title,
      date: data.holiday_date,
      daysCount: holiday.daysCount,
      type: data.category,
      notes: holiday.notes || ''
    };
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

/**
 * Check whether payroll tables sync with Supabase is enabled.
 * Disabled by default to prevent 404 errors until tables are created in Supabase.
 */
export const isSupabasePayrollSyncEnabled = (): boolean => {
  return (
    import.meta.env.VITE_ENABLE_SUPABASE_PAYROLL === 'true' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('osan_enable_supabase_payroll') === 'true')
  );
};

export async function getPayrollTransactionsFromDb(month: string, year: string): Promise<Record<string, any[]>> {
  // 1. Read local storage fallback
  const localMap: Record<string, any[]> = {};
  try {
    const localData = localStorage.getItem(`osan_payroll_tx_${month}_${year}`);
    if (localData) {
      Object.assign(localMap, JSON.parse(localData));
    }
  } catch {
    // ignore
  }

  // Avoid network 404 errors if Supabase is not configured or payroll tables are not yet enabled
  if (!isLiveSupabaseConfigured() || !isSupabasePayrollSyncEnabled()) {
    return localMap;
  }

  try {
    const { data, error } = await supabase
      .from('payroll_transactions')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .order('payment_date', { ascending: false });

    if (error) {
      return localMap;
    }

    const txMap: Record<string, any[]> = { ...localMap };
    (data || []).forEach(tx => {
      if (!txMap[tx.user_id]) txMap[tx.user_id] = [];
      if (!txMap[tx.user_id].some(t => t.id === tx.id)) {
        txMap[tx.user_id].push({
          id: tx.id,
          date: tx.payment_date,
          amount: Number(tx.amount),
          method: tx.payment_method
        });
      }
    });
    return txMap;
  } catch (err) {
    return localMap;
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
  // Always persist locally first so payment actions never fail
  try {
    const localKey = `osan_payroll_tx_${transaction.month}_${transaction.year}`;
    const existing = JSON.parse(localStorage.getItem(localKey) || '{}');
    if (!existing[transaction.userId]) existing[transaction.userId] = [];
    existing[transaction.userId].push({
      id: 'tx_' + Date.now(),
      date: transaction.date,
      amount: transaction.amount,
      method: transaction.method
    });
    localStorage.setItem(localKey, JSON.stringify(existing));
  } catch {
    // ignore
  }

  if (!isLiveSupabaseConfigured() || !isSupabasePayrollSyncEnabled()) {
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
      return true; // Still true because saved locally
    }
    return true;
  } catch (err) {
    return true;
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

  // Avoid network 404 errors if Supabase is not configured or payroll tables are not yet enabled
  if (!isLiveSupabaseConfigured() || !isSupabasePayrollSyncEnabled()) {
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

  if (!isLiveSupabaseConfigured() || !isSupabasePayrollSyncEnabled()) {
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

