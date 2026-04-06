import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

// Graceful fallback so the app can render without configuring Supabase yet
const SESSION_KEY = 'mock_supabase_session';

type MockUser = { id: string; email?: string; user_metadata?: Record<string, unknown> } | null;
type MockSession = { user: MockUser } | null;

const readSession = (): MockSession => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (session: MockSession) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* no-op */
  }
};

type AuthCallback = (event: string, session: MockSession) => void;
const authListeners = new Set<AuthCallback>();
const emitAuth = (event: string, session: MockSession) => {
  authListeners.forEach((cb) => {
    try { cb(event, session); } catch { /* ignore */ }
  });
};

const mockAuth = {
  signUp: async ({ email, password, options }: any) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          username: options?.data?.username,
          fullName: options?.data?.full_name,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { data: null, error: { message: j.error || 'Registration failed' } };
      }
      // Do not auto-login on sign up to match current UI flow
      return { data: { user: null }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Registration failed' } };
    }
  },
  signInWithPassword: async ({ email, password }: any) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { data: null, error: { message: j.error || 'Login failed' } };
      }
      const user: MockUser = {
        id: `mock_${Date.now()}`,
        email,
        user_metadata: {},
      };
      const session: MockSession = { user };
      writeSession(session);
      emitAuth('SIGNED_IN', session);
      return { data: { user }, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Login failed' } };
    }
  },
  signOut: async () => {
    writeSession(null);
    emitAuth('SIGNED_OUT', null);
    return { error: null };
  },
  getUser: async () => {
    const session = readSession();
    return { data: { user: session?.user ?? null }, error: null };
  },
  getSession: async () => ({ data: { session: readSession() }, error: null }),
  onAuthStateChange: (cb: AuthCallback) => {
    authListeners.add(cb);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  }
};

export const supabase: any = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : { auth: mockAuth };

// Auth helpers
export const signUp = async (email: string, password: string, username: string, fullName?: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        full_name: fullName,
      }
    }
  });
  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
};

export const resetPassword = async (email: string) => {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email);
  return { data, error };
};