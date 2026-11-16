import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  Cpu,
  History,
  LayoutDashboard,
  Menu,
  Moon,
  SearchCheck,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import type { ThemeMode } from '../hooks/useTheme';
import type { PageId } from '../types/api';

interface AppLayoutProps {
  activePage: PageId;
  onNavigate: (page: PageId) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  activeModel: string | null;
  backendConnected: boolean;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ id: PageId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'analyze', label: 'Review Analysis', icon: SearchCheck },
  { id: 'models', label: 'Model Performance', icon: Cpu },
  { id: 'history', label: 'Review History', icon: History },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<PageId, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Overview Dashboard',
    subtitle: 'Real-time classification metrics and recent predictions from SQLite',
  },
  analyze: {
    title: 'Review Analysis',
    subtitle: 'Preprocess text, compute TF-IDF features, and inspect model output',
  },
  models: {
    title: 'Model Performance',
    subtitle: 'Evaluate, compare, and train four Scikit-learn classification pipelines',
  },
  history: {
    title: 'Review History',
    subtitle: 'Search, filter, inspect, and export stored SQLite prediction records',
  },
  analytics: {
    title: 'Analytics & Trends',
    subtitle: 'Time-series detection volume and comparative classifier insights',
  },
  settings: {
    title: 'System Settings',
    subtitle: 'Backend connectivity, dataset management, and display preferences',
  },
};

export function AppLayout({
  activePage,
  onNavigate,
  theme,
  onToggleTheme,
  activeModel,
  backendConnected,
  children,
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentMeta = PAGE_TITLES[activePage];

  const handleSelectPage = (page: PageId) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070B14] dark:text-slate-100">
      {/* Mobile Sidebar Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800/90 dark:bg-[#0B1120] lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800/90">
          <button
            type="button"
            onClick={() => handleSelectPage('dashboard')}
            className="flex items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-cyan-500 rounded-lg"
          >
            <Logo className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <div className="sg-glitch-hover text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                SpamGuard AI
              </div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                Detect Fake Reviews
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectPage(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-500 ${
                  isActive
                    ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/12 dark:text-cyan-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive
                      ? 'text-cyan-600 dark:text-cyan-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 px-4 py-4 text-xs dark:border-slate-800/90">
          <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
            <div className="flex items-center justify-between gap-2">
              <span>Backend API</span>
              <span
                className={`font-mono font-medium ${
                  backendConnected
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {backendConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0">Active Model</span>
              <span
                className="truncate font-mono text-slate-900 dark:text-slate-200"
                title={activeModel || 'Not trained'}
              >
                {activeModel || 'Pending'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur-sm dark:border-slate-800/90 dark:bg-[#070B14]/95 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                {currentMeta.title}
              </h1>
              <p className="hidden truncate text-xs text-slate-500 dark:text-slate-400 sm:block">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-slate-800 dark:bg-[#0B1120] dark:text-slate-300 dark:hover:bg-slate-800 shrink-0"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {activePage !== 'analyze' && (
              <button
                type="button"
                onClick={() => handleSelectPage('analyze')}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-700 focus-visible:outline-2 focus-visible:outline-cyan-400 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 whitespace-nowrap shrink-0"
              >
                <SearchCheck className="h-4 w-4 shrink-0" />
                Analyze Review
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
