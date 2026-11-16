import { useCallback, useState } from 'react';
import { BackendStatusBanner } from './components/BackendStatusBanner';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { useBackendHealth } from './hooks/useBackendHealth';
import { useTheme } from './hooks/useTheme';
import { AppLayout } from './layouts/AppLayout';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';
import { ReviewAnalysisPage } from './pages/ReviewAnalysisPage';
import { ReviewHistoryPage } from './pages/ReviewHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import type { PageId } from './types/api';

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const { theme, setTheme, toggleTheme } = useTheme();
  const { health, error, backendUnreachable, refreshHealth } = useBackendHealth();

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <>
      <AppLayout
        activePage={activePage}
        onNavigate={setActivePage}
        theme={theme}
        onToggleTheme={toggleTheme}
        activeModel={health?.active_model ?? null}
        backendConnected={!backendUnreachable && health?.status === 'ok'}
      >
        {backendUnreachable && error && (
          <BackendStatusBanner
            error={error}
            onRetry={refreshHealth}
            onOpenSettings={() => setActivePage('settings')}
          />
        )}

        {activePage === 'dashboard' && (
          <DashboardPage onNavigate={setActivePage} onNotify={notify} />
        )}
        {activePage === 'analyze' && (
          <ReviewAnalysisPage
            activeModel={health?.active_model ?? null}
            onNavigate={setActivePage}
            onNotify={notify}
          />
        )}
        {activePage === 'models' && (
          <ModelPerformancePage
            onModelUpdated={refreshHealth}
            onNotify={notify}
          />
        )}
        {activePage === 'history' && (
          <ReviewHistoryPage onNavigate={setActivePage} onNotify={notify} />
        )}
        {activePage === 'analytics' && <AnalyticsPage onNotify={notify} />}
        {activePage === 'settings' && (
          <SettingsPage
            health={health}
            backendUnreachable={backendUnreachable}
            onRefreshHealth={refreshHealth}
            theme={theme}
            onSetTheme={setTheme}
            onNotify={notify}
          />
        )}
      </AppLayout>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
