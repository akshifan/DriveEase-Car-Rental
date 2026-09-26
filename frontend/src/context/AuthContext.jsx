import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { configureAuthBridge, setAccessToken } from '../api/client.js';
import * as authApi from '../api/auth.js';
import { landingRouteFor } from '../utils/constants.js';

/**
 * Session state for the whole app.
 *
 * Only genuine cross-cutting state lives here: who is signed in and whether the
 * session is still being restored. Everything else (lists, forms, filters)
 * stays local to the component that owns it.
 */
const AuthContext = createContext(null);

/**
 * Every storage key that is user-specific.
 * On logout all of these must be cleared so the next authenticated user never
 * inherits the previous user's view. Non-user keys (theme, layout prefs) are
 * deliberately NOT in this list.
 */
const USER_SCOPED_KEYS = [
  'driveease.search-draft',
  'driveease.last-route',
  'driveease.last-path',
  'driveease.selected-vehicle',
  'driveease.booking-draft',
  'driveease.checkout-draft',
];

function clearUserScopedStorage() {
  try {
    for (const key of USER_SCOPED_KEYS) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    }
  } catch {
    /* private mode / quota - nothing else to do */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('restoring'); // restoring | anonymous | authenticated
  const mounted = useRef(true);
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
    if (payload?.user) {
      setUser(payload.user);
      setStatus('authenticated');
    } else if (!payload?.accessToken) {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('anonymous');
  }, []);

  const refreshInFlight = useRef(null);

  const refreshSession = useCallback(() => {
    if (refreshInFlight.current) {
      return refreshInFlight.current;
    }
    refreshInFlight.current = (async () => {
      try {
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
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, []);

  useEffect(() => {
    configureAuthBridge({ refresh: refreshSession, onLost: clearSession });
  }, [refreshSession, clearSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await refreshSession();
        if (!cancelled) applySession(payload);
      } catch {
        if (!cancelled) clearSession();
      }
    })();
    return () => {
      cancelled = true;
    };
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

  /**
   * Sign out.
   *
   * Order matters:
   *   1. Revoke the refresh token server-side (best effort).
   *   2. Clear the in-memory access token so no further API call carries it.
   *   3. Clear the user object and flip status to anonymous.
   *   4. Wipe every user-scoped storage key so a subsequent login on the same
   *      browser starts with a clean slate.
   *   5. Let the caller navigate; a hard reload is not required because
   *      RequireAuth bounces any authenticated-view access once status flips.
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A failed sign-out must never trap the user in a signed-in shell.
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('anonymous');
      clearUserScopedStorage();
    }
  }, []);

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
      landingRoute: landingRouteFor(user),
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
