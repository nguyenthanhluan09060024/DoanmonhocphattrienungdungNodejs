import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { useAuth } from './useAuth';
import { getUserPreferences, saveUserPreference } from '../lib/api';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_KEY = 'fimory-theme';
const THEME_EVENT = 'theme-updated';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setStoredTheme] = useLocalStorage<Theme>(THEME_KEY, 'dark');
  const [mounted, setMounted] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
  }, [theme, mounted]);

  // Keep theme synced if localStorage is changed elsewhere.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue) as Theme;
        if (next === 'dark' || next === 'light') {
          setStoredTheme(next);
        }
      } catch {
        // ignore malformed value
      }
    };
    const onThemeEvent = () => {
      try {
        const raw = window.localStorage.getItem(THEME_KEY);
        if (!raw) return;
        const next = JSON.parse(raw) as Theme;
        if (next === 'dark' || next === 'light') {
          setStoredTheme(next);
        }
      } catch {
        // ignore malformed value
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(THEME_EVENT, onThemeEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(THEME_EVENT, onThemeEvent);
    };
  }, [setStoredTheme]);

  // Sync with server preferences for logged-in users.
  // Local value wins to keep UI consistent across route changes.
  useEffect(() => {
    const email = user?.email as string | undefined;
    if (!mounted || !email) return;

    let cancelled = false;
    (async () => {
      try {
        const prefs = await getUserPreferences(email);
        const serverTheme = prefs['theme'] as Theme | undefined;

        if (cancelled) return;

        if (serverTheme !== 'dark' && serverTheme !== 'light') {
          await saveUserPreference(email, 'theme', theme);
          return;
        }

        if (serverTheme !== theme) {
          await saveUserPreference(email, 'theme', theme);
        }
      } catch {
        // noop
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.email, mounted, theme]);

  const persistTheme = (next: Theme) => {
    setStoredTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));

    const email = user?.email as string | undefined;
    if (email) {
      saveUserPreference(email, 'theme', next).catch(() => {});
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    persistTheme(nextTheme);
  };

  const setTheme = (newTheme: Theme) => {
    persistTheme(newTheme);
  };

  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
