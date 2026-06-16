import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from './auth/AuthContext.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite.jsx'));
const AdminPortal = lazy(() => import('./pages/AdminPortal.jsx'));
const RecruiterPortal = lazy(() => import('./pages/RecruiterPortal.jsx'));
const ContractorPortal = lazy(() => import('./pages/ContractorPortal.jsx'));
const ApplicantPortal = lazy(() => import('./pages/ApplicantPortal.jsx'));
const ApplicationForm = lazy(() => import('./pages/ApplicationForm.jsx'));
const EmploymentAdmin = lazy(() => import('./pages/EmploymentAdmin.jsx'));
const CandidateSchedule = lazy(() => import('./pages/CandidateSchedule.jsx'));

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="boot-screen">Loading secure session...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.force_password_change && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) return <Navigate to={homeForRole(user.role)} replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Suspense fallback={<div className="boot-screen">Loading portal...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to={user ? homeForRole(user.role) : '/login'} replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ProtectedRoute roles={['admin', 'recruiter', 'contractor', 'applicant']}><ChangePassword /></ProtectedRoute>} />
        <Route path="/register" element={<Register />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/apply/:roleSlug" element={<ProtectedRoute roles={['applicant']}><ApplicationForm /></ProtectedRoute>} />
        <Route path="/schedule/:token" element={<ProtectedRoute roles={['applicant']}><CandidateSchedule /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin', 'recruiter']}><EmploymentAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/*" element={<ProtectedRoute roles={['admin']}><AdminPortal /></ProtectedRoute>} />
        <Route path="/portal/recruiter/*" element={<ProtectedRoute roles={['recruiter']}><RecruiterPortal /></ProtectedRoute>} />
        <Route path="/portal/contractor/*" element={<ProtectedRoute roles={['contractor']}><ContractorPortal /></ProtectedRoute>} />
        <Route path="/portal/applicant/*" element={<ProtectedRoute roles={['applicant']}><ApplicantPortal /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
