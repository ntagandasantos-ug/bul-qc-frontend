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
import SoapLinePage              from './pages/SoapLinePage';
import DetergentLinePage         from './pages/DetergentLinePage';
import PlasticsLinePage          from './pages/PlasticsLinePage';
import OilLinePage               from './pages/OilLinePage';
import FatsLinePage              from './pages/FatsLinePage';
import DailySummaryPage          from './pages/DailySummaryPage';
import MobileHomePage            from './pages/MobileHomePage';
import BottomNavBar              from './components/BottomNavBar';

// ── New QC Head admin & analytics pages ──────────────────────
import UserManagementPage        from './pages/UserManagementPage';
import TestSpecificationsPage    from './pages/TestSpecificationsPage';
import DeptSampleConfigPage      from './pages/DeptSampleConfigPage';
import SystemSettingsPage        from './pages/SystemSettingsPage';
import SPCControlChartsPage      from './pages/SPCControlChartsPage';
import TrendAnalysisPage         from './pages/TrendAnalysisPage';

// ── Role-based dashboard selector ────────────────────────────
// QC Head and QC Assistant → QC Head Dashboard
// Everyone else            → Sample Tracking Dashboard
function RoleBasedDashboard() {
  const { user } = useAuth();
  const role = user?.roles?.name || '';
  if (role === 'QC Head' || role === 'QC Assistant') {
    return <QCHeadDashboardPage />;
  }
  return <DashboardPage />;
}

// ── Shorthand for QC Head / Assistant only routes ────────────
const QCOnly = ['QC Head', 'QC Assistant'];

// ── All staff roles ───────────────────────────────────────────
const AllStaff = [
  'QC Head', 'QC Assistant',
  'Shift Supervisor', 'Analyst', 'Sampler',
];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public ── */}
          <Route path="/login" element={<LoginPage />} />

          {/* ── Main dashboard — role decides which page shows ── */}
          <Route path="/dashboard" element={
            <ProtectedRoute roles={AllStaff}>
              <RoleBasedDashboard />
            </ProtectedRoute>
          } />

          {/* ── Register sample ── */}
          <Route path="/register-sample" element={
            <ProtectedRoute roles={AllStaff}>
              <SampleRegistrationPage />
            </ProtectedRoute>
          } />

          {/* ── Analysis — enter results ── */}
          <Route path="/analysis/:id" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <AnalysisPage />
            </ProtectedRoute>
          } />

          {/* ── Department live dashboards ── */}
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

          {/* ── Line Inspection ── */}
          <Route path="/inspection/soap" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <SoapLinePage />
            </ProtectedRoute>
          } />
          <Route path="/inspection/detergent" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <DetergentLinePage />
            </ProtectedRoute>
          } />
          <Route path="/inspection/plastics" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <PlasticsLinePage />
            </ProtectedRoute>
          } />
          <Route path="/inspection/oil" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <OilLinePage />
            </ProtectedRoute>
          } />
          <Route path="/inspection/fats" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <FatsLinePage />
            </ProtectedRoute>
          } />
          <Route path="/inspection/summary" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <DailySummaryPage />
            </ProtectedRoute>
          } />

          {/* ── Mobile home ── */}
          <Route path="/home" element={
            <ProtectedRoute roles={AllStaff}>
              <MobileHomePage />
            </ProtectedRoute>
          } />

          {/* ── Inventory ── */}
          <Route path="/inventory" element={
            <ProtectedRoute roles={['QC Head','QC Assistant','Shift Supervisor','Analyst']}>
              <InventoryPage />
            </ProtectedRoute>
          } />

          {/* ── Reports ── */}
          <Route path="/report-books" element={
            <ProtectedRoute roles={QCOnly}>
              <ReportBooksPage />
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute roles={QCOnly}>
              <ReportsPage />
            </ProtectedRoute>
          } />

          {/* ── Analytics (new) ── */}
          <Route path="/spc-charts" element={
            <ProtectedRoute roles={QCOnly}>
              <SPCControlChartsPage />
            </ProtectedRoute>
          } />
          <Route path="/trend-analysis" element={
            <ProtectedRoute roles={QCOnly}>
              <TrendAnalysisPage />
            </ProtectedRoute>
          } />

          {/* ── Admin (legacy) ── */}
          <Route path="/admin" element={
            <ProtectedRoute roles={QCOnly}>
              <AdminPage />
            </ProtectedRoute>
          } />

          {/* ── Admin sub-pages (new) ── */}
          <Route path="/admin/users" element={
            <ProtectedRoute roles={QCOnly}>
              <UserManagementPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/test-specs" element={
            <ProtectedRoute roles={QCOnly}>
              <TestSpecificationsPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/dept-config" element={
            <ProtectedRoute roles={QCOnly}>
              <DeptSampleConfigPage />
            </ProtectedRoute>
          } />
          <Route path="/admin/settings" element={
            <ProtectedRoute roles={QCOnly}>
              <SystemSettingsPage />
            </ProtectedRoute>
          } />

          {/* ── Placeholder routes for items not yet built ──
               These prevent 404s when navigating from dropdowns  ── */}
          <Route path="/admin/calibration" element={
            <ProtectedRoute roles={QCOnly}>
              <PlaceholderPage title="Instrument Calibration" icon="🔬" />
            </ProtectedRoute>
          } />
          <Route path="/admin/methods" element={
            <ProtectedRoute roles={QCOnly}>
              <PlaceholderPage title="Method Validation Records" icon="📋" />
            </ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute roles={QCOnly}>
              <PlaceholderPage title="Full Audit Trail" icon="🔒" />
            </ProtectedRoute>
          } />
          <Route path="/admin/notifications" element={
            <ProtectedRoute roles={QCOnly}>
              <PlaceholderPage title="Notification Rules" icon="🔔" />
            </ProtectedRoute>
          } />
          <Route path="/reports/oos" element={
            <ProtectedRoute roles={QCOnly}>
              <ReportsPage />
            </ProtectedRoute>
          } />

          {/* ── Redirects ── */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/login"     replace />} />

        </Routes>
        <BottomNavBar />
      </BrowserRouter>
    </AuthProvider>
  );
}

// ── Placeholder page for items not yet built ─────────────────
// Shows a clean "coming soon" screen instead of a blank 404
function PlaceholderPage({ title, icon }) {
  const navigate = require('react-router-dom').useNavigate();
  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex',
      flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'20px', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ fontSize:'56px', marginBottom:'16px' }}>{icon}</div>
      <h1 style={{ fontSize:'22px', fontWeight:'900', color:'#0F172A', margin:'0 0 8px', textAlign:'center' }}>
        {title}
      </h1>
      <p style={{ fontSize:'13px', color:'#94A3B8', marginBottom:'24px', textAlign:'center' }}>
        This module is coming soon. It will be available in the next update.
      </p>
      <button onClick={() => navigate(-1)}
        style={{ padding:'11px 24px', background:'linear-gradient(135deg,#6B21A8,#7C3AED)',
          color:'#fff', border:'none', borderRadius:'10px', fontSize:'14px',
          fontWeight:'700', cursor:'pointer' }}>
        ← Go Back
      </button>
    </div>
  );
}
