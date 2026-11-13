import { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Database,
  BarChart3,
  Info,
  Menu,
  X,
  Upload,
} from 'lucide-react';
import {
  fetchAnalytics,
  fetchChatHistory,
  fetchDocuments,
  fetchHealth,
} from './api';
import type {
  AnalyticsSummary,
  ChatMessage,
  DocumentRecord,
  PageRoute,
  SystemHealth,
} from './types';
import { DashboardPage } from './components/DashboardPage';
import { AssistantPage } from './components/AssistantPage';
import { DocumentsPage } from './components/DocumentsPage';
import { RepositoryPage } from './components/RepositoryPage';
import { AnalyticsPage } from './components/AnalyticsPage';
import { AboutPage } from './components/AboutPage';

const NAV_ITEMS: Array<{ id: PageRoute; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'repository', label: 'Repository', icon: Database },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'about', label: 'About Project', icon: Info },
];

const PAGE_TITLES: Record<PageRoute, string> = {
  dashboard: 'Home Dashboard',
  assistant: 'AI Robotics Assistant',
  documents: 'Document Management',
  repository: 'Knowledge Repository',
  analytics: 'Knowledge Analytics',
  about: 'About Project',
};

export default function App() {
  const [activePage, setActivePage] = useState<PageRoute>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    try {
      setLoadError(null);
      const [h, docs, stats, history] = await Promise.all([
        fetchHealth(),
        fetchDocuments(),
        fetchAnalytics(),
        fetchChatHistory(),
      ]);
      setHealth(h);
      setDocuments(docs);
      setAnalytics(stats);
      setMessages(history);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to connect to repository backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStatsAndHealth = useCallback(async () => {
    try {
      const [h, stats] = await Promise.all([fetchHealth(), fetchAnalytics()]);
      setHealth(h);
      setAnalytics(stats);
    } catch {
      // Silent background refresh failure
    }
  }, []);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  function navigate(page: PageRoute) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }

  const domains = health?.domains ?? [
    'Robotics Fundamentals',
    'Sensors and Actuators',
    'Arduino & ESP32',
    'Motor Control',
    'Robotic Arms & Kinematics',
    'ROS and ROS2',
    'SLAM & Path Planning',
    'Safety & Troubleshooting',
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-white border-r border-slate-200">
        <div className="h-14 px-5 border-b border-slate-200 flex items-center">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
          >
            ROBO KNOWLEDGE AI
          </button>
        </div>

        <nav aria-label="Primary navigation" className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-700">Repository Summary</p>
          <p className="font-mono tabular-nums">
            {documents.length} docs · {analytics?.totalChunks ?? 0} chunks
          </p>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 bg-white h-full border-r border-slate-200 flex flex-col">
            <div className="h-14 px-5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
                ROBO KNOWLEDGE AI
              </span>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-600 hover:text-slate-900"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-current={active ? 'page' : undefined}
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <span className="lg:hidden text-sm font-bold text-slate-900 whitespace-nowrap">
              ROBO KNOWLEDGE AI
            </span>
            <span className="hidden lg:inline text-sm font-medium text-slate-600 truncate">
              {PAGE_TITLES[activePage]}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate(activePage === 'documents' ? 'assistant' : 'documents')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            {activePage === 'documents' ? (
              <>
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                Ask Assistant
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                Upload Document
              </>
            )}
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loadError && (
            <div
              role="alert"
              className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800"
            >
              {loadError}
            </div>
          )}

          {activePage === 'dashboard' && (
            <DashboardPage
              health={health}
              analytics={analytics}
              documents={documents}
              loading={loading}
              onNavigate={navigate}
            />
          )}

          {activePage === 'assistant' && (
            <AssistantPage
              messages={messages}
              domains={domains}
              health={health}
              onMessagesChange={setMessages}
              onQueryLogged={() => void refreshStatsAndHealth()}
            />
          )}

          {activePage === 'documents' && (
            <DocumentsPage
              documents={documents}
              domains={domains}
              onRefresh={refreshAll}
            />
          )}

          {activePage === 'repository' && (
            <RepositoryPage
              documents={documents}
              domains={domains}
              health={health}
              onSearchLogged={() => void refreshStatsAndHealth()}
            />
          )}

          {activePage === 'analytics' && (
            <AnalyticsPage analytics={analytics} loading={loading} />
          )}

          {activePage === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
