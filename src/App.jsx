import React        from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider }          from './context/AuthContext';
import ProtectedRoute            from './components/ProtectedRoute';

import LoginPage                 from './pages/LoginPage';
import DashboardPage             from './pages/DashboardPage';
import SampleRegistrationPage    from './pages/SampleRegistrationPage';
import AnalysisPage              from './pages/AnalysisPage';
import DeptDashboardPage         from './pages/DeptDashboardPage';
import AdminPage                 from './pages/AdminPage';
import ReportsPage               from './pages/ReportsPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* QC staff dashboard */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={[
              'QC Head','QC Assistant',
              'Shift Supervisor','Analyst','Sampler',
            ]}>
              <DashboardPage />
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

          {/* Department live dashboard */}
          <Route path="/dashboard/dept" element={
            <ProtectedRoute roles={[
              'Department Head','Department Assistant',
            ]}>
              <DeptDashboardPage />
            </ProtectedRoute>
          } />

           <Route path="/reports" element={
    <ProtectedRoute roles={['QC Head','QC Assistant']}>
      <ReportsPage />
    </ProtectedRoute>
  } />

          {/* Admin panel */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['QC Head','QC Assistant']}>
              <AdminPage />
            </ProtectedRoute>
          } />

          {/* Redirect root to dashboard */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/login"     replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}