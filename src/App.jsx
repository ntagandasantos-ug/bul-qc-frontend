import React        from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider }          from './context/AuthContext';
import { useAuth }               from './context/AuthContext';
import ProtectedRoute            from './components/ProtectedRoute';

import LoginPage                 from './pages/LoginPage';
import DashboardPage             from './pages/DashboardPage';
import SampleRegistrationPage    from './pages/SampleRegistrationPage';
import AnalysisPage              from './pages/AnalysisPage';
import DeptDashboardPage         from './pages/DeptDashboardPage';
import RefDashboardPage          from './pages/RefDashboardPage';
import AdminPage                 from './pages/AdminPage';
import ReportsPage               from './pages/ReportsPage';
import FPDashboardPage           from './pages/FPDashboardPage';
import SoapDashboardPage         from './pages/SoapDashboardPage';
import QCHeadDashboardPage       from './pages/QCHeadDashboardPage';
import ReportBooksPage           from './pages/ReportBooksPage';
import InventoryPage             from './pages/InventoryPage';
import BoilerDashboardPage       from './pages/BoilerDashboardPage';

// ── Role-based dashboard selector ────────────────────────
// QC Head and QC Assistant → new QC Head Dashboard
// Everyone else           → old Sample Tracking Dashboard
function RoleBasedDashboard() {
  const { user } = useAuth();
  const role = user?.roles?.name || '';
  if (role === 'QC Head' || role === 'QC Assistant') {
    return <QCHeadDashboardPage />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Main dashboard — role decides which page shows */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={[
              'QC Head','QC Assistant',
              'Shift Supervisor','Analyst','Sampler',
            ]}>
              <RoleBasedDashboard />
            </ProtectedRoute>
          } />

          {/* Register sample */}
          <Route path="/register-sample" element={
            <ProtectedRoute roles={[
              'QC Head','QC Assistant',
              'Shift Supervisor','Analyst','Sampler',
            ]}>
              <SampleRegistrationPage />
            </ProtectedRoute>
          } />

          {/* Analysis — enter results */}
          <Route path="/analysis/:id" element={
            <ProtectedRoute roles={[
              'QC Head','QC Assistant',
              'Shift Supervisor','Analyst',
            ]}>
              <AnalysisPage />
            </ProtectedRoute>
          } />

          {/* Department live dashboards */}
          <Route path="/dashboard/dept" element={
            <ProtectedRoute roles={['Department Head','Department Assistant']}>
              <DeptDashboardPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/ref" element={
            <ProtectedRoute roles={['Department Head','Department Assistant']}>
              <RefDashboardPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/boiler" element={
            <ProtectedRoute roles={['Department Head','Department Assistant']}>
              <BoilerDashboardPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/fp" element={
            <ProtectedRoute roles={['Department Head','Department Assistant']}>
              <FPDashboardPage />
            </ProtectedRoute>
          } />

          <Route path="/dashboard/soap" element={
            <ProtectedRoute roles={['Department Head','Department Assistant']}>
              <SoapDashboardPage />
            </ProtectedRoute>
          } />

          {/* Report books */}
          <Route path="/report-books" element={
            <ProtectedRoute roles={['QC Head','QC Assistant']}>
              <ReportBooksPage />
            </ProtectedRoute>
          } />

          {/* Reports */}
          <Route path="/reports" element={
            <ProtectedRoute roles={['QC Head','QC Assistant']}>
              <ReportsPage />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['QC Head','QC Assistant']}>
              <AdminPage />
            </ProtectedRoute>
          } />

          <Route path="/inventory" element={
  <ProtectedRoute>
    <InventoryPage />
  </ProtectedRoute>
} />

          {/* Redirects */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/login"     replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}