export type Role = 'HR' | 'CEO' | 'Accountant' | 'Employee';
export type Nationality = 'Omani' | 'Expat';
export type UserStatus = 'Active' | 'Inactive';
export type AttendanceStatus = 'Present' | 'Late' | 'On-Time' | 'Overtime' | 'Absent';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';
export type LeaveType = 
  | 'Yearly' 
  | 'Sick' 
  | 'Maternity' 
  | 'Paternity' 
  | 'Marriage' 
  | 'Bereavement_Immediate' 
  | 'Bereavement_Extended' 
  | 'Bereavement_Spouse'
  | 'Mourning_Muslim' 
  | 'Mourning_NonMuslim' 
  | 'Hajj' 
  | 'Exam' 
  | 'Unpaid';

export type CompanyName = string;
export type AuthPolicy = 'email' | 'phone' | 'both';

export interface Company {
  id: string;
  name: CompanyName;
  created_at: string;
  auth_policy: AuthPolicy;
  omani_shift_start: string;
  omani_shift_end: string;
  expat_shift_start: string;
  expat_shift_end: string;
  logo_url?: string;
  location?: string;
}

export interface LeaveBalances {
  yearly: number;
  sick: number;
  pregnancy: number; // maternity balance
}

export interface User {
  id: string; // matches auth.users.id
  name: string;
  email: string;
  phone?: string;
  role: Role;
  company_id: string;
  company?: string;
  nationality: Nationality;
  gender: 'Male' | 'Female';
  religion?: 'Muslim' | 'Non-Muslim';
  status: UserStatus;
  leave_balances: LeaveBalances;
  
  pin?: string;
  job_title?: string;
  department?: string;
  join_date: string; // YYYY-MM-DD
  supervisor_name?: string;
  base_salary: number;
  allowances: number;
  qualifications: Array<{ degree: string; school: string; year: string }>;
  experience: Array<{ company: string; role: string; period: string }>;
  family_members: Array<{ name: string; relation: string; dob: string }>;
  emergency_contacts: Array<{ name: string; relation: string; phone: string }>;
  promotions: Array<{ date: string; from: string; to: string }>;
  disciplinary: Array<{ date: string; violation: string; action: string }>;
  bonuses: Array<{ date: string; amount: number; reason: string }>;
  transfers: Array<{ date: string; from_dept: string; to_dept: string }>;
  housing_status?: 'Lives with Family' | 'Company Accommodation' | 'Private Rental';
  accommodation_details?: {
    building_name?: string;
    building_address?: string;
    room_number?: string;
    occupancy_count?: number;
  };
  documents: Array<{ id: string; name: string; type: string; expiryDate?: string; number?: string; visaType?: 'Work Visa' | 'Visit Visa'; attachedFile?: string }>;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  company_id: string;
  date: string; // YYYY-MM-DD
  clock_in_time: string | null;
  clock_out_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  exceptions: any[];
  ip_address: string | null;
  status: AttendanceStatus;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  status: LeaveStatus;
  document_url?: string;
}
