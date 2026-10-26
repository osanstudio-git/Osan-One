-- =====================================================================
-- OSAN ONE HR & ATTENDANCE APP - SUPABASE DATABASE MIGRATION SCHEMA
-- Sultanate of Oman Labor Law Compliant Enterprise Architecture
-- Idempotent SQL script (Safe to run multiple times without errors)
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- 1. ENUMS & DOMAINS (Safely created if not already existing)
-- ---------------------------------------------------------------------
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('HR', 'CEO', 'Accountant', 'Employee');
  END IF;
  
  -- Ensure 'HR' value is present if user_role enum already existed
  BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'HR';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nationality_type') THEN
    CREATE TYPE nationality_type AS ENUM ('Omani', 'Expat');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('Active', 'Inactive');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auth_policy_type') THEN
    CREATE TYPE auth_policy_type AS ENUM ('email', 'phone', 'both');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_type') THEN
    CREATE TYPE gender_type AS ENUM ('Male', 'Female');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'religion_type') THEN
    CREATE TYPE religion_type AS ENUM ('Muslim', 'Non-Muslim');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_type') THEN
    CREATE TYPE attendance_status_type AS ENUM ('Present', 'Late', 'On-Time', 'Overtime', 'Absent');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status_type') THEN
    CREATE TYPE leave_status_type AS ENUM ('Pending', 'Approved', 'Rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_type_enum') THEN
    CREATE TYPE leave_type_enum AS ENUM (
      'Yearly', 
      'Sick', 
      'Maternity', 
      'Paternity', 
      'Marriage', 
      'Bereavement_Immediate', 
      'Bereavement_Extended', 
      'Bereavement_Spouse',
      'Mourning_Muslim', 
      'Mourning_NonMuslim', 
      'Hajj', 
      'Exam', 
      'Unpaid'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'housing_status_type') THEN
    CREATE TYPE housing_status_type AS ENUM ('Lives with Family', 'Company Accommodation', 'Private Rental');
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. COMPANIES TABLE (Multi-Tenant Organization Settings)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  auth_policy auth_policy_type NOT NULL DEFAULT 'both',
  omani_shift_start TIME NOT NULL DEFAULT '08:30:00',
  omani_shift_end TIME NOT NULL DEFAULT '17:00:00',
  expat_shift_start TIME NOT NULL DEFAULT '08:00:00',
  expat_shift_end TIME NOT NULL DEFAULT '18:00:00',
  logo_url TEXT,
  location VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on companies table if table pre-existed
ALTER TABLE companies ADD COLUMN IF NOT EXISTS auth_policy auth_policy_type NOT NULL DEFAULT 'both';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS omani_shift_start TIME NOT NULL DEFAULT '08:30:00';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS omani_shift_end TIME NOT NULL DEFAULT '17:00:00';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expat_shift_start TIME NOT NULL DEFAULT '08:00:00';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expat_shift_end TIME NOT NULL DEFAULT '18:00:00';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_check;

-- ---------------------------------------------------------------------
-- 3. USERS / EMPLOYEES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(50),
  pin VARCHAR(10), -- 6-digit security PIN for phone authentication
  role user_role NOT NULL DEFAULT 'Employee',
  company_id VARCHAR(255) NOT NULL DEFAULT 'Company',
  nationality nationality_type NOT NULL DEFAULT 'Omani',
  gender gender_type NOT NULL DEFAULT 'Male',
  religion religion_type DEFAULT 'Muslim',
  status user_status NOT NULL DEFAULT 'Active',
  
  -- Electronic File Properties
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  job_title VARCHAR(150) NOT NULL DEFAULT 'Officer',
  department VARCHAR(150) NOT NULL DEFAULT 'Operations',
  supervisor_name VARCHAR(255),
  base_salary NUMERIC(10,3) NOT NULL DEFAULT 800.000, -- OMR precision
  allowances NUMERIC(10,3) NOT NULL DEFAULT 150.000,
  
  -- Leave Balances
  leave_balance_yearly INT NOT NULL DEFAULT 30,
  leave_balance_sick INT NOT NULL DEFAULT 14,
  leave_balance_maternity INT NOT NULL DEFAULT 98,
  
  -- Housing & Accommodation
  housing_status housing_status_type NOT NULL DEFAULT 'Lives with Family',
  accommodation_details JSONB DEFAULT '{}'::jsonb, -- building_name, building_address, room_number, occupancy_count
  
  -- Array Structures stored as JSONB for high flexibility
  qualifications JSONB DEFAULT '[]'::jsonb,
  experience JSONB DEFAULT '[]'::jsonb,
  family_members JSONB DEFAULT '[]'::jsonb,
  emergency_contacts JSONB DEFAULT '[]'::jsonb,
  promotions JSONB DEFAULT '[]'::jsonb,
  disciplinary JSONB DEFAULT '[]'::jsonb,
  bonuses JSONB DEFAULT '[]'::jsonb,
  transfers JSONB DEFAULT '[]'::jsonb,
  
  -- Exit Deactivation Audit Logs
  exit_date DATE,
  exit_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on users table if table pre-existed
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pin VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'Employee';
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id VARCHAR(255) NOT NULL DEFAULT 'Company';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nationality nationality_type NOT NULL DEFAULT 'Omani';
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender gender_type NOT NULL DEFAULT 'Male';
ALTER TABLE users ADD COLUMN IF NOT EXISTS religion religion_type DEFAULT 'Muslim';
ALTER TABLE users ADD COLUMN IF NOT EXISTS status user_status NOT NULL DEFAULT 'Active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS join_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title VARCHAR(150) NOT NULL DEFAULT 'Officer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(150) NOT NULL DEFAULT 'Operations';
ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS base_salary NUMERIC(10,3) NOT NULL DEFAULT 800.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowances NUMERIC(10,3) NOT NULL DEFAULT 150.000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_balance_yearly INT NOT NULL DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_balance_sick INT NOT NULL DEFAULT 14;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leave_balance_maternity INT NOT NULL DEFAULT 98;
ALTER TABLE users ADD COLUMN IF NOT EXISTS housing_status housing_status_type NOT NULL DEFAULT 'Lives with Family';
ALTER TABLE users ADD COLUMN IF NOT EXISTS accommodation_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS qualifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS experience JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS family_members JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS promotions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disciplinary JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonuses JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS transfers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS exit_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS exit_reason TEXT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_name_check;

-- Drop auth.users Foreign Key constraint if present (allows direct HR employee file insertion)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- ---------------------------------------------------------------------
-- 4. ATTENDANCE LOGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  company_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in_time TIMESTAMPTZ,
  clock_out_time TIMESTAMPTZ,
  break_start_time TIMESTAMPTZ,
  break_end_time TIMESTAMPTZ,
  ip_address VARCHAR(45),
  status attendance_status_type NOT NULL DEFAULT 'On-Time',
  exceptions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 5. LEAVE REQUESTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  leave_type leave_type_enum NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status leave_status_type NOT NULL DEFAULT 'Pending',
  document_url TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 6. OFFICIAL DOCUMENTS LOCKER TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  document_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(100) NOT NULL, -- Passport, ID, Residency, Visa
  document_number VARCHAR(100),
  expiry_date DATE,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 7. INDEXES FOR HIGH PERFORMANCE QUERYING
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_company_date ON attendance_logs(company_id, date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_id ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_documents_expiry ON employee_documents(expiry_date);

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Grant full read/write management permissions on all tables
-- ---------------------------------------------------------------------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Companies Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to companies') THEN
    CREATE POLICY "Allow full manage access to companies" ON companies FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Users Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to users') THEN
    CREATE POLICY "Allow full manage access to users" ON users FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Attendance Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to attendance') THEN
    CREATE POLICY "Allow full manage access to attendance" ON attendance_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Leave Requests Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to leaves') THEN
    CREATE POLICY "Allow full manage access to leaves" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
  END IF;

  -- Employee Documents Policy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to documents') THEN
    CREATE POLICY "Allow full manage access to documents" ON employee_documents FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- 9. COMPANY OFFICE SETTINGS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id VARCHAR(255) NOT NULL UNIQUE,
  office_latitude NUMERIC(10,8),
  office_longitude NUMERIC(11,8),
  office_ip VARCHAR(50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to company_settings') THEN
    CREATE POLICY "Allow full manage access to company_settings" ON company_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 10. PAYROLL TRANSACTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payroll_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  month VARCHAR(50) NOT NULL,
  year VARCHAR(10) NOT NULL,
  amount NUMERIC(10,3) NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payroll_transactions ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to payroll_transactions') THEN
    CREATE POLICY "Allow full manage access to payroll_transactions" ON payroll_transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 11. PAYSLIP RECORDS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payslip_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id VARCHAR(255) NOT NULL,
  month VARCHAR(50) NOT NULL,
  year VARCHAR(10) NOT NULL,
  basic_salary NUMERIC(10,3),
  other_allowance NUMERIC(10,3),
  transportation NUMERIC(10,3),
  advance_salary NUMERIC(10,3),
  deduction_not_came NUMERIC(10,3),
  probation_first_month NUMERIC(10,3),
  deduction_annual_leave NUMERIC(10,3),
  overtime_amount NUMERIC(10,3),
  incentive_amount NUMERIC(10,3),
  total_balance NUMERIC(10,3),
  paid_days NUMERIC(10,2),
  leave_days NUMERIC(10,2),
  hours_worked VARCHAR(50),
  account_number VARCHAR(100),
  mobile_number VARCHAR(50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE payslip_records ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to payslip_records') THEN
    CREATE POLICY "Allow full manage access to payslip_records" ON payslip_records FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 12. PUBLIC HOLIDAYS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public_holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  holiday_date VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'National',
  is_paid_off BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow full manage access to public_holidays') THEN
    CREATE POLICY "Allow full manage access to public_holidays" ON public_holidays FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';

