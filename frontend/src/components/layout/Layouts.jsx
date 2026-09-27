import { useEffect, useMemo } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Logo from './Logo.jsx';
import Icon from '../ui/Icon.jsx';
import { Button, Spinner } from '../ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { observeReveals } from '../../animations/revealAnimations.js';
import { scrollToTop } from '../../animations/smoothScroll.js';
import { ROLES, isRouteAllowedForRole, landingRouteFor } from '../../utils/constants.js';

export function PublicLayout() {
  const location = useLocation();
  useEffect(() => {
    const dispose = observeReveals(document);
    return dispose;
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <Navbar />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.location.hash) return;
    scrollToTop();
  }, [pathname]);
  return null;
}

export function RequireAuth({ roles, children }) {
  const { isAuthenticated, isRestoring, user } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-mist-400">
        <Spinner size={18} />
        <span className="text-[14px]">Restoring your session…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && roles.length && !roles.includes(user?.role)) {
    return <Navigate to={landingRouteFor(user)} replace state={null} />;
  }

  if (!isRouteAllowedForRole(location.pathname, user?.role)) {
    return <Navigate to={landingRouteFor(user)} replace state={null} />;
  }

  return children;
}

const CUSTOMER_NAV = [
  { to: '/dashboard', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/bookings', label: 'My bookings', icon: 'calendar' },
  { to: '/payments', label: 'Payments', icon: 'card' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

const FLEET_NAV = [
  { to: '/console', label: 'Fleet overview', icon: 'gauge', end: true },
  { to: '/console/bookings', label: 'Bookings', icon: 'calendar' },
  { to: '/console/vehicles', label: 'Vehicles', icon: 'car' },
  { to: '/console/payments', label: 'Payments', icon: 'card' },
  { to: '/console/maintenance', label: 'Maintenance', icon: 'wrench' },
  { to: '/console/damage', label: 'Damage log', icon: 'alert' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin overview', icon: 'shield', end: true },
  { to: '/admin/fleets', label: 'Fleet partners', icon: 'building' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/vehicles', label: 'All vehicles', icon: 'car' },
  { to: '/admin/bookings', label: 'All bookings', icon: 'calendar' },
  { to: '/admin/payments', label: 'All payments', icon: 'card' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart' },
];

const PROFILE_ITEM = { to: '/profile', label: 'Profile', icon: 'user' };

/**
 * Console shell. Each role sees exactly the sections its portal needs.
 *
 * - CUSTOMER: "My account"
 * - FLEET_MANAGER: "My fleet"
 * - ADMIN: "My account" + "My fleet" + "Administration"
 *   (admin is a customer, a fleet owner, and an administrator)
 */
export function DashboardLayout() {
  const { user } = useAuth();
  const location = useLocation();

  const sections = useMemo(() => {
    if (!user) return [];
    if (user.role === ROLES.ADMIN) {
      return [
        { title: 'My account', items: CUSTOMER_NAV },
        { title: 'My fleet', items: FLEET_NAV },
        { title: 'Administration', items: ADMIN_NAV },
      ];
    }
    if (user.role === ROLES.FLEET_MANAGER) {
      return [{ title: 'My fleet', items: FLEET_NAV }];
    }
    return [{ title: 'My account', items: CUSTOMER_NAV }];
  }, [user?.role]);

  useEffect(() => {
    const dispose = observeReveals(document);
    return dispose;
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:flex-row">
      <aside className="hidden w-[260px] shrink-0 border-r border-white/[0.06] bg-ink-900/60 lg:flex lg:flex-col">
        <div className="flex h-[76px] items-center px-6">
          <Logo to={landingRouteFor(user)} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-8">
          {sections.map((section) => (
            <div key={section.title} className="mb-6">
              <p className="px-3 pb-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-mist-500">
                {section.title}
              </p>
              <nav aria-label={section.title} className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    {...(item.end ? { end: true } : {})}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition ${
                        isActive
                          ? 'bg-lime/[0.12] text-lime'
                          : 'text-mist-300 hover:bg-white/[0.04] hover:text-white'
                      }`
                    }
                  >
                    <Icon name={item.icon} size={17} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.06] p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-mist-200">
              {(user?.firstName?.[0] || 'D') + (user?.lastName?.[0] || '')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-white">{user?.fullName || user?.firstName}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mist-500">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar variant="dashboard" />

        <main id="main" className="flex-1 px-5 pb-20 pt-[92px] sm:px-8 lg:pt-[100px]">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>

        {/*
          Footer is rendered in the dashboard shell on every breakpoint, so the
          same chrome appears on desktop and mobile. It lives in the right-hand
          column so the sidebar stays pinned to the viewport.
        */}
        <Footer />
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="shell flex min-h-[70vh] flex-col items-center justify-center text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="display-xl mt-4">Wrong turn.</h1>
      <p className="lede mt-5 max-w-md">
        The page you were looking for is not on this road. Let us get you back to somewhere with a
        view.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button to="/" iconRight="arrowRight">
          Back to home
        </Button>
        <Button to="/fleet" variant="ghost">
          Browse the fleet
        </Button>
      </div>
    </div>
  );
}
