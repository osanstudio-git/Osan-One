import type { Role, Nationality, UserStatus, AuthPolicy, User } from '../../types';

export interface CompanyData {
  id?: string;
  name: string;
  count: number;
  location?: string;
  contactEmail?: string;
  theme?: string;
  logoUrl?: string;
  authPolicy?: AuthPolicy;
  omaniShiftStart: string;
  omaniShiftEnd: string;
  expatShiftStart: string;
  expatShiftEnd: string;
}

export const MOCK_COMPANIES: CompanyData[] = [
  { name: 'Nameer', count: 12, location: 'Muscat, Oman', theme: 'emerald', authPolicy: 'both', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
  { name: 'Masar', count: 8, location: 'Dubai, UAE', theme: 'blue', authPolicy: 'phone', omaniShiftStart: '08:00', omaniShiftEnd: '16:30', expatShiftStart: '08:00', expatShiftEnd: '17:30' },
  { name: 'Osan Studio', count: 15, location: 'Muscat, Oman', theme: 'indigo', authPolicy: 'email', omaniShiftStart: '09:00', omaniShiftEnd: '17:30', expatShiftStart: '09:00', expatShiftEnd: '18:30' },
  { name: 'Amer', count: 5, location: 'Doha, Qatar', theme: 'amber', authPolicy: 'both', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
  { name: 'Asas', count: 9, location: 'Riyadh, KSA', theme: 'rose', authPolicy: 'phone', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
  { name: 'Musk', count: 4, location: 'Muscat, Oman', theme: 'emerald', authPolicy: 'email', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
  { name: 'Osbic', count: 6, location: 'Manama, Bahrain', theme: 'blue', authPolicy: 'both', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
  { name: 'Maisarah', count: 3, location: 'Kuwait City, Kuwait', theme: 'amber', authPolicy: 'phone', omaniShiftStart: '08:30', omaniShiftEnd: '17:00', expatShiftStart: '08:30', expatShiftEnd: '18:00' },
];

export const MOCK_EMPLOYEES: User[] = Array.from({ length: 12 }).map((_, i) => {
  const gender = i % 2 === 0 ? 'Male' : 'Female' as 'Male' | 'Female';
  const nationality = (i % 3 === 0 ? 'Expat' : 'Omani') as Nationality;
  const companyName = MOCK_COMPANIES[i % 8].name;
  const religion = i % 4 === 1 ? 'Non-Muslim' : 'Muslim' as 'Muslim' | 'Non-Muslim';
  
  // Set distinct join dates to test 6-month yearly leave guard
  // Emp-0: joined long ago (July 2023)
  // Emp-11: joined recently (June 2026 - less than 6 months from July 2026)
  const joinDate = i === 11 ? '2026-06-01' : `2024-0${(i % 9) + 1}-15`;

  return {
    id: `emp-${i}`,
    name: i === 0 ? 'HR Admin' : i === 1 ? 'CEO Executive' : i === 2 ? 'Senior Accountant' : i === 3 ? 'Employee Officer' : `Employee ${i + 1}`,
    email: i === 0 ? 'hr@osangroupoman.com' : i === 1 ? 'ceo@osangroupoman.com' : i === 2 ? 'accountant@osangroupoman.com' : i === 3 ? 'employee@osangroupoman.com' : `employee${i + 1}@${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    phone: i === 0 ? '96891000001' : i === 1 ? '96891000002' : i === 2 ? '96891000003' : `96891234${(10 + i).toString()}`,
    pin: '123456',
    role: (i === 0 ? 'HR' : i === 1 ? 'CEO' : i === 2 ? 'Accountant' : 'Employee') as Role,
    company_id: companyName,
    company: companyName,
    nationality,
    gender,
    religion,
    status: 'Active' as UserStatus,
    leave_balances: {
      yearly: 30,
      sick: 14,
      pregnancy: 98
    },
    join_date: joinDate,
    supervisor_name: i === 0 ? undefined : 'HR Supervisor',
    base_salary: 800 + (i * 120),
    allowances: 150 + (i * 35),
    qualifications: [
      { degree: i % 2 === 0 ? 'Bachelor of Science' : 'Bachelor of Arts', school: 'Sultan Qaboos University', year: '2020' },
      { degree: 'Secondary Certificate', school: 'Muscat High School', year: '2016' }
    ],
    experience: [
      { company: 'Previous Company LLC', role: 'Junior Officer', period: '2021-2023' }
    ],
    family_members: [
      { name: `Family Member A`, relation: 'Spouse', dob: '1995-04-12' },
      { name: `Family Member B`, relation: 'Son', dob: '2021-08-20' }
    ],
    emergency_contacts: [
      { name: `Emergency Contact`, relation: 'Parent', phone: `+968 998877${i.toString().padStart(2, '0')}` }
    ],
    housing_status: nationality === 'Expat' ? 'Company Accommodation' : 'Lives with Family',
    accommodation_details: nationality === 'Expat' ? {
      building_name: `Al Khuwair Staff Complex Block ${(i % 3) + 1}`,
      building_address: `Way 3512, Block 20${i % 4}, Al Khuwair, Muscat`,
      room_number: `Flat ${101 + (i % 6)}, Room ${(i % 4) + 1}`,
      occupancy_count: 4
    } : undefined,
    promotions: [
      { date: '2025-01-01', from: 'Junior Officer', to: 'Senior Officer' }
    ],
    disciplinary: i === 3 ? [
      { date: '2026-03-10', violation: 'Repeated Late Arrival', action: 'Written Warning' }
    ] : [],
    bonuses: [
      { date: '2025-12-15', amount: 350, reason: 'Annual Performance Reward' }
    ],
    transfers: [
      { date: '2024-08-01', from_dept: 'Operations', to_dept: 'Administration' }
    ],
    documents: [
      { id: '1', name: 'Passport', type: 'Official ID', number: `P${84920 + i}`, expiryDate: i === 5 ? '2026-08-01' : '2030-10-15' },
      { 
        id: '2', 
        name: nationality === 'Expat' ? (i % 2 === 0 ? 'Work Visa (2-Year)' : 'Visit Visa (Short-Term)') : 'National ID Card', 
        type: nationality === 'Expat' ? 'Visa' : 'Official ID', 
        visaType: nationality === 'Expat' ? (i % 2 === 0 ? 'Work Visa' : 'Visit Visa') : undefined, 
        number: `V${9930 + i}`, 
        expiryDate: i === 0 ? '2026-08-28' : i === 2 ? '2026-09-05' : i === 4 ? '2026-08-05' : '2028-04-20' 
      },
      { id: '3', name: 'Employment Contract', type: 'Agreement', number: `CTR-${2024 + i}`, expiryDate: '2027-02-15' }
    ]
  };
});

export interface MockLeave {
  id: string;
  employee: string;
  type: string;
  start: string;
  end: string;
  status: string;
  balances: { yearly: number; sick: number; };
  documentUrl?: string;
}

export const MOCK_LEAVES: MockLeave[] = [
  { id: '1', employee: 'Employee 4', type: 'Yearly', start: '2026-07-10', end: '2026-07-14', status: 'Pending', balances: { yearly: 15, sick: 14 } },
  { id: '2', employee: 'Employee 7', type: 'Sick', start: '2026-07-05', end: '2026-07-06', status: 'Pending', balances: { yearly: 30, sick: 12 } },
];

export const MOCK_EXCEPTIONS = [
  { id: '1', employee: 'Employee 3', type: 'Severe Late', date: 'Today', details: 'Arrived at 9:15 AM (45m late)', status: 'Pending Deduction', severity: 'high' },
  { id: '2', employee: 'Employee 5', type: 'Over-Break', date: 'Yesterday', details: 'Break lasted 1h 20m', status: 'Pending Deduction', severity: 'high' },
  { id: '3', employee: 'Employee 8', type: 'Late Warning', date: 'Today', details: 'Arrived at 8:50 AM', status: 'Warning Logged', severity: 'medium' },
  { id: '4', employee: 'Employee 11', type: 'Early Departure', date: 'Yesterday', details: 'Left at 4:15 PM', status: 'Pending Deduction', severity: 'high' },
];
