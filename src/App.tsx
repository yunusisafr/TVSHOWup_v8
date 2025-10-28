import React, { useEffect } from 'react';
import Cookies from 'js-cookie';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { AuthPromptProvider } from './contexts/AuthPromptContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { isAdminRoute, getLanguageFromPath, isRTLLanguage, detectBrowserLanguage } from './lib/utils';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ContentDetailPage from './pages/ContentDetailPage';
import WatchlistPage from './pages/WatchlistPage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import ShareListPage from './pages/ShareListPage';
import PublicWatchlistPage from './pages/PublicWatchlistPage';
import StaticPage from './pages/StaticPage';
import PersonDetailPage from './pages/PersonDetailPage';
import MyListsPage from './pages/MyListsPage';
import UserPublicShareListsPage from './pages/UserPublicShareListsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminRoute from './components/AdminRoute';
import DiscoverListsPage from './pages/DiscoverListsPage';
import ScrollToTop from './components/ScrollToTop';
import AuthPromptModal from './components/AuthPromptModal';
import CookieConsentBanner from './components/CookieConsentBanner';
import LanguageRouter from './components/LanguageRouter';
import SEOWrapper from './components/SEOWrapper';
import AdminSidebar from './components/AdminSidebar';

function RootRedirect() {
  // Get language from cookies immediately, no loading needed
  const savedLanguage = Cookies.get('user_language');
  const targetLanguage = savedLanguage || detectBrowserLanguage();

  console.log(`🏠 Root redirect: redirecting to /${targetLanguage}`);
  return <Navigate to={`/${targetLanguage}`} replace />;
}

function LegacyRouteRedirect() {
  const location = useLocation();

  // Get language from cookies immediately, no loading needed
  const savedLanguage = Cookies.get('user_language');
  const targetLanguage = savedLanguage || detectBrowserLanguage();

  const newPath = `/${targetLanguage}${location.pathname}${location.search}${location.hash}`;
  console.log(`🔄 Legacy route redirect: ${location.pathname} -> ${newPath}`);
  return <Navigate to={newPath} replace />;
}

function ResetPasswordWrapper() {
  return <ResetPasswordPage />;
}

function RecoveryFlowRedirect() {
  const location = useLocation();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');

      if (type === 'recovery' && accessToken) {
        const currentPath = location.pathname;
        const isAlreadyOnResetPage = currentPath.includes('/reset-password');

        console.log('🔐 Recovery Flow Handler');
        console.log('   - Current path:', currentPath);
        console.log('   - Access token present:', !!accessToken);

        if (!isAlreadyOnResetPage) {
          const redirectPath = `/reset-password${hash}`;
          console.log('   - Redirecting to:', redirectPath);
          window.location.href = redirectPath;
        } else {
          console.log('   - Already on correct page, no redirect needed');
        }
      }
    }
  }, [location.pathname]);

  return null;
}

function RTLWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    const lang = getLanguageFromPath(location.pathname);
    const isRTL = lang && isRTLLanguage(lang);

    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang || 'en');
  }, [location.pathname]);

  return <>{children}</>;
}

function AppRoutes() {
  const isAdmin = isAdminRoute();

  console.log('🔍 Admin route check:', {
    isAdmin,
    hostname: window.location.hostname,
    pathname: window.location.pathname,
  });

  return (
    <>
      <RecoveryFlowRedirect />
      <ScrollToTop />
      <SEOWrapper />

      {/* ADMIN ROUTES */}
      {isAdmin ? (
        <Routes>
          <Route path="*" element={
            <div className="flex min-h-screen bg-gray-900">
              <AdminSidebar />
              <main className="flex-1">
                <Routes>
                  <Route path="/admin" element={<AdminRoute><div className="p-8"><h1 className="text-2xl text-white">Admin Dashboard - Coming Soon</h1></div></AdminRoute>} />
                  <Route path="/" element={<AdminRoute><div className="p-8"><h1 className="text-2xl text-white">Admin Dashboard - Coming Soon</h1></div></AdminRoute>} />
                  <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
              </main>
            </div>
          } />
        </Routes>
      ) : (
        <div className="min-h-screen bg-gray-900">
          <Routes>
            {/* Special routes without language prefix and without header/footer */}
            <Route path="/reset-password" element={<ResetPasswordWrapper />} />

            {/* Static files - these should never be handled by React Router */}
            <Route path="/sitemap.xml" element={null} />
            <Route path="/robots.txt" element={null} />
            <Route path="/ads.txt" element={null} />

            {/* Block /admin routes on main domain - redirect to admin subdomain */}
            <Route path="/admin/*" element={<Navigate to="https://admin.tvshowup.com" replace />} />

            {/* All other routes with LanguageRouter wrapper */}
            <Route path="*" element={
              <LanguageRouter>
                <Header />
                <main className="relative pt-[120px] md:pt-16">
                  <Routes>
                    {/* Language-aware Public Routes */}
                    <Route path="/:lang" element={<HomePage />} />
                    <Route path="/:lang/search" element={<SearchPage />} />
                    <Route path="/:lang/movie/:id" element={<ContentDetailPage contentType="movie" />} />
                    <Route path="/:lang/tv_show/:id" element={<ContentDetailPage contentType="tv_show" />} />
                    <Route path="/:lang/movie/:id/:slug" element={<ContentDetailPage contentType="movie" />} />
                    <Route path="/:lang/tv_show/:id/:slug" element={<ContentDetailPage contentType="tv_show" />} />
                    <Route path="/:lang/watchlist" element={<WatchlistPage />} />
                    <Route path="/:lang/login" element={<LoginPage />} />
                    <Route path="/:lang/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/:lang/settings" element={<SettingsPage />} />
                    <Route path="/:lang/person/:id" element={<PersonDetailPage />} />
                    <Route path="/:lang/person/:id/:slug" element={<PersonDetailPage />} />
                    <Route path="/:lang/share/:listId" element={<ShareListPage />} />
                    <Route path="/:lang/public-watchlist/:listId" element={<PublicWatchlistPage />} />
                    <Route path="/:lang/my-lists" element={<MyListsPage />} />
                    <Route path="/:lang/pages/:slug" element={<StaticPage />} />
                    <Route path="/:lang/discover-lists" element={<DiscoverListsPage />} />
                    <Route path="/:lang/u/:username/mylist" element={<PublicWatchlistPage />} />
                    <Route path="/:lang/u/:username/my-suggestion-lists" element={<UserPublicShareListsPage />} />

                    {/* Legacy routes without language prefix - redirect to user's browser language */}
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/search" element={<LegacyRouteRedirect />} />
                    <Route path="/movie/:id" element={<LegacyRouteRedirect />} />
                    <Route path="/tv_show/:id" element={<LegacyRouteRedirect />} />
                    <Route path="/movie/:id/:slug" element={<LegacyRouteRedirect />} />
                    <Route path="/tv_show/:id/:slug" element={<LegacyRouteRedirect />} />
                    <Route path="/watchlist" element={<LegacyRouteRedirect />} />
                    <Route path="/login" element={<LegacyRouteRedirect />} />
                    <Route path="/settings" element={<LegacyRouteRedirect />} />
                    <Route path="/person/:id" element={<LegacyRouteRedirect />} />
                    <Route path="/person/:id/:slug" element={<LegacyRouteRedirect />} />
                    <Route path="/share/:listId" element={<LegacyRouteRedirect />} />
                    <Route path="/public-watchlist/:listId" element={<LegacyRouteRedirect />} />
                    <Route path="/my-lists" element={<LegacyRouteRedirect />} />
                    <Route path="/pages/:slug" element={<LegacyRouteRedirect />} />
                    <Route path="/discover-lists" element={<LegacyRouteRedirect />} />
                    <Route path="/u/:username/mylist" element={<LegacyRouteRedirect />} />
                    <Route path="/u/:username/my-suggestion-lists" element={<LegacyRouteRedirect />} />
                  </Routes>
                </main>
                <Footer />
              </LanguageRouter>
            } />
          </Routes>
          <AuthPromptModal />
          <CookieConsentBanner />
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AdminProvider>
        <Router>
          <UserPreferencesProvider>
            <AuthPromptProvider>
              <RTLWrapper>
                <AppRoutes />
              </RTLWrapper>
            </AuthPromptProvider>
          </UserPreferencesProvider>
        </Router>
      </AdminProvider>
    </AuthProvider>
  );
}

export default App;