import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { AlertCircle, Users, CalendarX, MapPin, Building2, LayoutDashboard, FileSpreadsheet, Loader2 } from 'lucide-react';

// Lazy load page components for dynamic bundle chunking
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const EmployeeDashboard = lazy(() => import('./pages/EmployeeDashboard').then(m => ({ default: m.EmployeeDashboard })));
const CeoDashboard = lazy(() => import('./pages/CeoDashboard').then(m => ({ default: m.CeoDashboard })));
const AccountantDashboard = lazy(() => import('./pages/AccountantDashboard').then(m => ({ default: m.AccountantDashboard })));
const HrOverview = lazy(() => import('./pages/hr/HrOverview').then(m => ({ default: m.HrOverview })));
const HrExceptions = lazy(() => import('./pages/hr/HrExceptions').then(m => ({ default: m.HrExceptions })));
const HrCompanies = lazy(() => import('./pages/hr/HrCompanies').then(m => ({ default: m.HrCompanies })));
const HrDirectory = lazy(() => import('./pages/hr/HrDirectory').then(m => ({ default: m.HrDirectory })));
const HrEmployeeProfile = lazy(() => import('./pages/hr/HrEmployeeProfile').then(m => ({ default: m.HrEmployeeProfile })));
const HrLeaves = lazy(() => import('./pages/hr/HrLeaves').then(m => ({ default: m.HrLeaves })));
const HrOffice = lazy(() => import('./pages/hr/HrOffice').then(m => ({ default: m.HrOffice })));
const HrReports = lazy(() => import('./pages/hr/HrReports').then(m => ({ default: m.HrReports })));

const NotFound = () => <div className="p-8 text-center text-gray-400 font-medium">404 - Page Not Found</div>;

// Sleek fallback spinner
const PageLoader = () => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-3">
    <Loader2 className="w-8 h-8 text-primary animate-spin" />
    <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Loading Workspace Module...</span>
  </div>
);

const hrLinks = [
  { label: 'Overview', path: '/hr/overview', icon: LayoutDashboard },
  { label: 'Exceptions', path: '/hr/exceptions', icon: AlertCircle },
  { label: 'Companies', path: '/hr/companies', icon: Building2 },
  { label: 'Directory', path: '/hr/directory', icon: Users },
  { label: 'Leaves', path: '/hr/leaves', icon: CalendarX },
  { label: 'Reports', path: '/hr/reports', icon: FileSpreadsheet },
  { label: 'Office Setup', path: '/hr/office', icon: MapPin },
];

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<Login />} />

                {/* Employee Routes */}
                <Route element={<ProtectedRoute allowedRoles={['Employee']} />}>
                  <Route path="/dashboard" element={<EmployeeDashboard />} />
                </Route>

                {/* HR Routes */}
                <Route element={<ProtectedRoute allowedRoles={['HR']} />}>
                  <Route path="/hr" element={<DashboardLayout title="HR Portal" links={hrLinks} />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<HrOverview />} />
                    <Route path="exceptions" element={<HrExceptions />} />
                    <Route path="companies" element={<HrCompanies />} />
                    <Route path="directory" element={<HrDirectory />} />
                    <Route path="employee/:id" element={<HrEmployeeProfile />} />
                    <Route path="leaves" element={<HrLeaves />} />
                    <Route path="reports" element={<HrReports />} />
                    <Route path="office" element={<HrOffice />} />
                  </Route>
                </Route>

                {/* CEO Routes */}
                <Route element={<ProtectedRoute allowedRoles={['CEO']} />}>
                  <Route path="/ceo" element={<CeoDashboard />} />
                </Route>

                {/* Accountant Routes */}
                <Route element={<ProtectedRoute allowedRoles={['Accountant']} />}>
                  <Route path="/accountant" element={<AccountantDashboard />} />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>

            <InstallPrompt />
            <OfflineBanner />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
