import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/ui/Button';
import { getUserPreferences, saveUserPreference } from '../lib/api';

type DisplayMode = 'all' | 'movies' | 'series';

const TabNav: React.FC = () => {
  const location = useLocation();
  const isProfile = location.pathname === '/profile';
  const isSettings = location.pathname === '/settings';
  return (
    <div className="flex items-center gap-2 mb-6">
      <Link to="/profile">
        <Button variant={isProfile ? 'primary' : 'secondary'} size="sm">Profile</Button>
      </Link>
      <Link to="/settings">
        <Button variant={isSettings ? 'primary' : 'secondary'} size="sm">Settings</Button>
      </Link>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('all');
  const email = useMemo(() => (user?.email as string | undefined) || '', [user]);

  useEffect(() => {
    const load = async () => {
      try {
        if (email) {
          const prefs = await getUserPreferences(email);
          const mode = (prefs['display_mode'] as DisplayMode | undefined) || 'all';
          setDisplayMode(mode);
        } else {
          const local = window.localStorage.getItem('fimory-display-mode');
          setDisplayMode((local ? JSON.parse(local) : 'all') as DisplayMode);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [email]);

  const handleSetDisplay = async (mode: DisplayMode) => {
    setDisplayMode(mode);
    if (email) {
      saveUserPreference(email, 'display_mode', mode).catch(() => {});
    } else {
      window.localStorage.setItem('fimory-display-mode', JSON.stringify(mode));
    }
  };

  const handleSetTheme = async (t: 'light' | 'dark') => {
    setTheme(t);
    if (!email) {
      window.localStorage.setItem('fimory-theme', JSON.stringify(t));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Cài đặt</h1>

      <TabNav />

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Giao diện</h2>
          <div className="flex items-center gap-2">
            <Button variant={theme === 'light' ? 'primary' : 'secondary'} onClick={() => handleSetTheme('light')}>Light</Button>
            <Button variant={theme === 'dark' ? 'primary' : 'secondary'} onClick={() => handleSetTheme('dark')}>Dark</Button>
          </div>
        </section>

        <section className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Chế độ hiển thị</h2>
          <div className="flex items-center gap-2">
            <Button variant={displayMode === 'all' ? 'primary' : 'secondary'} onClick={() => handleSetDisplay('all')}>Tất cả</Button>
            <Button variant={displayMode === 'movies' ? 'primary' : 'secondary'} onClick={() => handleSetDisplay('movies')}>Chỉ phim</Button>
            <Button variant={displayMode === 'series' ? 'primary' : 'secondary'} onClick={() => handleSetDisplay('series')}>Chỉ truyện</Button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Tùy chọn này sẽ ẩn bớt các mục không phù hợp trên trang chủ.</p>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;


