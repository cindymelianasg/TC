import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";

import LoginPage from "@/pages/LoginPage";
import LineAreaPage from "@/pages/LineAreaPage";
import DashboardLinePage from "@/pages/DashboardLinePage";
import SparePartDetailPage from "@/pages/SparePartDetailPage";
import SparePartFormPage from "@/pages/SparePartFormPage";
import UserManagementPage from "@/pages/UserManagementPage";
import MonthlyReportPage from "@/pages/MonthlyReportPage";
import SettingsPage from "@/pages/SettingsPage";
import OverviewDashboardPage from "@/pages/OverviewDashboardPage";
import MasterDataPage from "@/pages/MasterDataPage";
import MasterImportPage from "@/pages/MasterImportPage";
import MasterMovementHistoryPage from "@/pages/MasterMovementHistoryPage";
import MovementHistoryPage from "@/pages/MovementHistoryPage";

function App() {
  return (
    <div className="App">
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors closeButton />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={<ProtectedRoute><OverviewDashboardPage /></ProtectedRoute>} />
              <Route path="/area" element={<ProtectedRoute><LineAreaPage /></ProtectedRoute>} />
              <Route path="/line/:slug" element={<ProtectedRoute><DashboardLinePage /></ProtectedRoute>} />
              <Route path="/parts/new" element={<ProtectedRoute><SparePartFormPage /></ProtectedRoute>} />
              <Route path="/parts/:id" element={<ProtectedRoute><SparePartDetailPage /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute><UserManagementPage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><MonthlyReportPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/master" element={<ProtectedRoute><MasterDataPage /></ProtectedRoute>} />
              <Route path="/master/import" element={<ProtectedRoute><MasterImportPage /></ProtectedRoute>} />
              <Route path="/master/:id/movements" element={<ProtectedRoute><MasterMovementHistoryPage /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><MovementHistoryPage /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/area" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </div>
  );
}

export default App;
