import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ReconciliationProvider } from './contexts/ReconciliationContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Reconciliation from './pages/Reconciliation';
import ReconRuns from './pages/ReconRuns';
import CreateReconciliation from './pages/CreateReconciliation';
import ReconRunDetail from './pages/ReconRunDetail';
import Exceptions from './pages/Exceptions';
import ExceptionDetail from './pages/ExceptionDetail';
import FinanceQA from './pages/FinanceQA';
import AuditLogs from './pages/AuditLogs';

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/reconciliation/runs" element={<ReconRuns />} />
        <Route path="/reconciliation/runs/new" element={<CreateReconciliation />} />
        <Route path="/reconciliation/runs/:runId" element={<ReconRunDetail />} />
        <Route path="/exceptions" element={<Exceptions />} />
        <Route path="/exceptions/:runId/:exceptionId" element={<ExceptionDetail />} />
        <Route path="/finance-qa" element={<FinanceQA />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ReconciliationProvider>
          <AppRoutes />
        </ReconciliationProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
