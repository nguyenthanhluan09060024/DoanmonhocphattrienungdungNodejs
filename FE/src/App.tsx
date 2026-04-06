import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import Chatbot from './components/chatbot/Chatbot';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import FavoritesPage from './pages/FavoritesPage';
import NotificationsPage from './pages/NotificationsPage';
import WatchPage from './pages/WatchPage';
import HistoryPage from './pages/HistoryPage';
import AdminMoviesPage from './pages/AdminMoviesPage';
import AdminStoriesPage from './pages/AdminStoriesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminCommentsPage from './pages/AdminCommentsPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminMovieStatsPage from './pages/AdminMovieStatsPage';
import RoleUpgradePage from './pages/RoleUpgradePage';
import StoryUploadPage from './pages/StoryUploadPage';
import UserUploadPage from './pages/UserUploadPage';
import { MoviesPage } from './pages/MoviesPage';
import StoriesPage from './pages/StoriesPage';
import StoryPage from './pages/StoryPage';
import CategoriesPage from './pages/CategoriesPage';
import CategoryDetailPage from './pages/CategoryDetailPage';

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <div className="min-h-screen bg-white dark:bg-gray-900">
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'dark:bg-gray-800 dark:text-white',
                duration: 4000,
              }}
            />
            
            <Routes>
              {/* Auth routes without header/footer */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
              
              {/* Main app routes with header/footer */}
              <Route
                path="*"
                element={
                  <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-1">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/favorites" element={<FavoritesPage />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/notifications" element={<NotificationsPage />} />
                        <Route path="/watch/:slug" element={<WatchPage />} />
                        <Route path="/movies" element={<MoviesPage />} />
                        <Route path="/stories" element={<StoriesPage />} />
                        <Route path="/stories/:slug" element={<StoryPage />} />
                        <Route path="/categories" element={<CategoriesPage />} />
                        <Route path="/categories/:slug" element={<CategoryDetailPage />} />
                        {/* Admin */}
                        <Route path="/admin/movies" element={<AdminMoviesPage />} />
                        <Route path="/admin/stories" element={<AdminStoriesPage />} />
                        <Route path="/admin/categories" element={<AdminCategoriesPage />} />
                        <Route path="/admin/movies-stats" element={<AdminMovieStatsPage />} />
                        <Route path="/admin/users" element={<AdminUsersPage />} />
                        <Route path="/admin/comments" element={<AdminCommentsPage />} />
                        {/* User Upload */}
                        <Route path="/upload" element={<UserUploadPage />} />
                        <Route path="/upload/stories" element={<StoryUploadPage />} />
                        <Route path="/upload/movies" element={<UserUploadPage />} />
                        <Route path="/role-upgrade" element={<RoleUpgradePage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </main>
                    <Footer />
                    <Chatbot />
                  </div>
                }
              />
            </Routes>
          </div>
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;