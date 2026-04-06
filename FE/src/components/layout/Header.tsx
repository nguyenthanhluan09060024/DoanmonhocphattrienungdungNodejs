import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  User, 
  Bell, 
  Settings, 
  LogOut, 
  Moon, 
  Sun,
  Menu,
  X,
  Film,
  BookOpen,
  Crown,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { SearchBox } from '../ui/SearchBox';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { fetchCurrentRole, fetchUnreadNotificationCount } from '../../lib/api';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Debug: Log unreadCount whenever it changes
  useEffect(() => {
    console.log('🔔 Header unreadCount state:', unreadCount, 'Should show badge:', unreadCount > 0);
  }, [unreadCount]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (user?.email) {
          const { role } = await fetchCurrentRole(user.email);
          if (!cancelled) {
            setUserRole(role);
            setIsAdmin(role === 'Admin');
          }
        } else {
          setUserRole('');
          setIsAdmin(false);
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  // Fetch unread notification count
  useEffect(() => {
    if (!user?.email) {
      setUnreadCount(0);
      return;
    }
    
    let cancelled = false;
    const loadCount = async () => {
      try {
        const count = await fetchUnreadNotificationCount(user.email as string);
        if (!cancelled) {
          setUnreadCount(count);
          console.log('📬 Notification count updated:', count, 'for email:', user.email);
        }
      } catch (error) {
        if (!cancelled) {
          setUnreadCount(0);
          console.error('Failed to fetch notification count:', error);
        }
      }
    };
    
    loadCount();
    
    // Poll every 30 seconds for new notifications
    const interval = setInterval(() => {
      if (!cancelled) loadCount();
    }, 30000);
    
    // Listen for notification updates
    const handleNotificationUpdate = () => {
      if (!cancelled) loadCount();
    };
    window.addEventListener('notifications-updated', handleNotificationUpdate);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleNotificationUpdate);
    };
  }, [user?.email]);

  // Đóng dropdown khi route thay đổi
  useEffect(() => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
    navigate('/');
  };

  // Handler để đóng menu khi click vào link
  const handleMenuLinkClick = () => {
    setIsUserMenuOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Film className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Fimory
              </span>
            </motion.div>
          </Link>

          {/* Navigation Links - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/movies" 
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1"
            >
              <Film className="w-4 h-4" />
              <span>Movies</span>
            </Link>
            <Link 
              to="/stories" 
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1"
            >
              <BookOpen className="w-4 h-4" />
              <span>Series</span>
            </Link>
            <Link 
              to="/categories" 
              className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Categories
            </Link>
            {user && !isAdmin && (
              <Link 
                to="/favorites" 
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Favorites
              </Link>
            )}
            {user && !isAdmin && (
              <Link 
                to="/history" 
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                History
              </Link>
            )}
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex items-center flex-1 mx-8">
            <SearchBox />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <Button variant="ghost" size="sm" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {user ? (
              <div className="flex items-center space-x-4">
                {/* Notifications */}
                <Link to="/notifications" className="relative inline-block">
                  <div className="relative">
                    <Button variant="ghost" size="sm">
                      <Bell className="w-4 h-4" />
                    </Button>
                    {unreadCount > 0 ? (
                      <span 
                        className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-md shadow-lg border-2 border-white dark:border-gray-900 z-50 pointer-events-none"
                        style={{ display: 'flex' }}
                      >
                        {unreadCount > 99 ? '99+' : String(unreadCount)}
                      </span>
                    ) : null}
                  </div>
                </Link>

                {/* VIP Status */}
                {user.user_metadata?.is_vip && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full text-xs font-medium text-white">
                    <Crown className="w-3 h-3" />
                    <span>VIP</span>
                  </div>
                )}

                {/* User Menu */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <span className="hidden md:block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {user.user_metadata?.username || user.email}
                    </span>
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
                      >
                        {/* Nhóm Cá nhân */}
                        <div className="px-2 py-1">
                          <Link
                            to="/profile"
                            onClick={handleMenuLinkClick}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          >
                            <User className="w-4 h-4" />
                            <span>Profile</span>
                          </Link>
                          <Link
                            to="/settings"
                            onClick={handleMenuLinkClick}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            <span>Settings</span>
                          </Link>
                          {!isAdmin && (
                            <Link
                              to="/favorites"
                              onClick={handleMenuLinkClick}
                              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            >
                              <Film className="w-4 h-4" />
                              <span>Favorites</span>
                            </Link>
                          )}
                          {!isAdmin && (
                            <Link
                              to="/history"
                              onClick={handleMenuLinkClick}
                              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            >
                              <Film className="w-4 h-4" />
                              <span>History</span>
                            </Link>
                          )}
                          {!isAdmin && (
                            <Link
                              to="/role-upgrade"
                              onClick={handleMenuLinkClick}
                              className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                            >
                              <Crown className="w-4 h-4" />
                              <span>Upgrade Role</span>
                            </Link>
                          )}
                        </div>

                        {/* Nhóm Upload - Chỉ hiện khi có quyền upload (phân biệt với user View) */}
                        {user && (isAdmin || userRole === 'Uploader' || userRole === 'Author' || userRole === 'Translator' || userRole === 'Reup') && (
                          <>
                            <hr className="my-1 border-gray-200 dark:border-gray-700" />
                            <div className="px-2 py-1">
                              {!isAdmin && (
                                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  Content Creation
                                </div>
                              )}
                              <Link
                                to={isAdmin ? "/admin/movies" : "/upload"}
                                onClick={handleMenuLinkClick}
                                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <Film className="w-4 h-4" />
                                <span>Upload Movies</span>
                              </Link>
                              <Link
                                to={isAdmin ? "/admin/stories" : "/upload/stories"}
                                onClick={handleMenuLinkClick}
                                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <BookOpen className="w-4 h-4" />
                                <span>Upload Stories</span>
                              </Link>
                            </div>
                          </>
                        )}

                        {/* Nhóm Quản trị - Chỉ cho Admin */}
                        {isAdmin && (
                          <>
                            <hr className="my-1 border-gray-200 dark:border-gray-700" />
                            <div className="px-2 py-1">
                              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Administration
                              </div>
                              <Link
                                to="/admin/categories"
                                onClick={handleMenuLinkClick}
                                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <Film className="w-4 h-4" />
                                <span>Category Management</span>
                              </Link>
                              <Link
                                to="/admin/movies-stats"
                                onClick={handleMenuLinkClick}
                                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <Film className="w-4 h-4" />
                                <span>Movie Stats</span>
                              </Link>
                              <Link
                                to="/admin/users"
                                onClick={handleMenuLinkClick}
                                className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                              >
                                <Users className="w-4 h-4" />
                                <span>User Management</span>
                              </Link>
                            </div>
                          </>
                        )}

                        {/* Sign Out */}
                        <hr className="my-1 border-gray-200 dark:border-gray-700" />
                        <div className="px-2 py-1">
                          <button
                            onClick={handleSignOut}
                            className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md w-full text-left transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-gray-200 dark:border-gray-700 py-4"
            >
              <nav className="space-y-4">
                <div className="mb-4">
                  <SearchBox />
                </div>
                <Link
                  to="/movies"
                  onClick={handleMenuLinkClick}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <Film className="w-4 h-4" />
                  <span>Movies</span>
                </Link>
                <Link
                  to="/stories"
                  onClick={handleMenuLinkClick}
                  className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Series</span>
                </Link>
                <Link
                  to="/categories"
                  onClick={handleMenuLinkClick}
                  className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Categories
                </Link>
                {user && !isAdmin && (
                  <Link
                    to="/favorites"
                    onClick={handleMenuLinkClick}
                    className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    Favorites
                  </Link>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};