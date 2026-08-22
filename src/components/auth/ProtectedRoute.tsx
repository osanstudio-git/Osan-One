import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Role } from '../../types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-12 w-12 animate-pulse-slow rounded-full bg-primary" />
      </div>
    );
  }

  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const effectiveRole = (profile.role as string) === 'Super_HR' ? 'HR' : profile.role;

  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    // If user is logged in but doesn't have the right role, redirect to their default dashboard
    switch (effectiveRole) {
      case 'HR':
        return <Navigate to="/hr/overview" replace />;
      case 'CEO':
        return <Navigate to="/ceo" replace />;
      case 'Accountant':
        return <Navigate to="/accountant" replace />;
      case 'Employee':
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
}
