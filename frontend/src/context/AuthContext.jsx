import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureAuthBridge, setAccessToken } from '../api/client.js';
import * as authApi from '../api/auth.js';

/**
 * Session state for the whole app.
 *
 * Only genuine cross-cutting state lives here: who is signed in and whether the
 * session is still being restored. Everything else (lists, forms, filters)
 * stays local to the component that owns it.
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('restoring'); // restoring | anonymous | authenticated
  const mounted = useRef(true);
  // Mirrors `user` so the refresh callback never closes over a stale value.
  const userRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const applySession = useCallback((payload) => {
    setAccessToken(payload?.accessToken || null);
    setUser(payload?.user || null);
    setStatus(payload?.user ? 'authenticated' : 'anonymous');
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  /**
   * Called by the API client when an access token expired, and once on cold
   * start. The response carries a new access token only, so the profile comes
   * from GET /auth/session (skipped when we already hold it).
   */
  const refreshSession = useCallback(async () => {
    const payload = await authApi.refreshSession();
    setAccessToken(payload?.accessToken || null);

    let profile = userRef.current;
    if (!profile) {
      profile = await authApi.currentSession();
    }
    if (mounted.current) {
      setUser(profile);
      setStatus('authenticated');
    }
    return payload;
  }, []);

  useEffect(() => {
    configureAuthBridge({ refresh: refreshSession, onLost: clearSession });
  }, [refreshSession, clearSession]);

  /**
   * Cold start: an access token only lives in memory, so ask the API whether the
   * refresh cookie still represents a valid session.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await authApi.refreshSession();
        if (!cancelled) applySession(payload);
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (credentials) => {
      const payload = await authApi.login(credentials);
      applySession(payload);
      return payload;
    },
    [applySession],
  );

  const register = useCallback(
    async (payload) => {
      const session = await authApi.register(payload);
      applySession(session);
      return session;
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A failed sign-out must never trap the user in a signed-in shell.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const profile = await authApi.getProfile();
    if (mounted.current) setUser((current) => ({ ...current, ...profile }));
    return profile;
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      isRestoring: status === 'restoring',
      isStaff: Boolean(user) && user.role !== 'CUSTOMER',
      isAdmin: Boolean(user) && user.role === 'ADMIN',
      login,
      register,
      logout,
      refreshProfile,
      setUser,
    }),
    [user, status, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
