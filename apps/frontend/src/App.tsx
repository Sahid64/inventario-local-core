import React from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { MainLayout } from './layouts/MainLayout';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MovementsPage } from './pages/MovementsPage';
import { PartnersPage } from './pages/PartnersPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WarehousesPage } from './pages/WarehousesPage';
import { useAuthStore } from './store/useAuthStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RouterWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isFileProtocol =
    typeof window !== 'undefined' && window.location.protocol === 'file:';
  return isFileProtocol ? (
    <HashRouter>{children}</HashRouter>
  ) : (
    <BrowserRouter>{children}</BrowserRouter>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <RouterWrapper>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="movements" element={<MovementsPage />} />
            <Route path="warehouses" element={<WarehousesPage />} />
            <Route path="partners" element={<PartnersPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RouterWrapper>
    </ThemeProvider>
  );
};

export default App;
