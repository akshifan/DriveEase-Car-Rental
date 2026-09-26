import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo.jsx';
import Icon from '../ui/Icon.jsx';
import NotificationBell from './NotificationBell.jsx';
import { Button } from '../ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useScrollPosition } from '../../hooks/index.js';
import { setScrollLocked, scrollToTarget } from '../../animations/smoothScroll.js';
import { initialsOf } from '../../utils/format.js';
import { ROLES, landingRouteFor } from '../../utils/constants.js';

const PUBLIC_LINKS = [
  { to: '/fleet', label: 'Fleet' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#insights', label: 'Why DriveEase' },
  { to: '/support', label: 'Support' },
];

/**
 * Every navigation item, grouped by portal. The visible groups depend on role:
 *
 *   CUSTOMER     -> "My account"
 *   FLEET_MANAGER-> "My fleet"
 *   ADMIN        -> "My account" + "My fleet" + "Administration"
 *                    (the admin has all three portals)
 */
/*
 * Navbar-local link catalogues.
 *
 * The navbar renders these inside plain <Link> elements (the dropdown and the
 * mobile drawer), not <NavLink>. Plain <Link> does not consume an `end` prop,
 * so including `end: true` here would leak a boolean `end` attribute to the
 * DOM and trigger React's non-boolean-attribute warning. Active-state matching
 * is handled exclusively by the sidebar's <NavLink> in Layouts.jsx, which
 * keeps its own copy of these catalogues.
 */
const CUSTOMER_NAV = [
  { to: '/dashboard', label: 'Overview', icon: 'dashboard' },
  { to: '/bookings', label: 'My bookings', icon: 'calendar' },
  { to: '/payments', label: 'Payments', icon: 'card' },
  { to: '/profile', label: 'Profile', icon: 'user' },
];

const FLEET_NAV = [
  { to: '/console', label: 'Fleet overview', icon: 'gauge' },
  { to: '/console/bookings', label: 'Bookings', icon: 'calendar' },
  { to: '/console/vehicles', label: 'Vehicles', icon: 'car' },
  { to: '/console/payments', label: 'Payments', icon: 'card' },
  { to: '/console/maintenance', label: 'Maintenance', icon: 'wrench' },
  { to: '/console/damage', label: 'Damage log', icon: 'alert' },
];

const ADMIN_NAV = [
  { to: '/admin', label: 'Admin overview', icon: 'shield' },
  { to: '/admin/fleets', label: 'Fleet partners', icon: 'building' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/vehicles', label: 'All vehicles', icon: 'car' },
  { to: '/admin/bookings', label: 'All bookings', icon: 'calendar' },
  { to: '/admin/payments', label: 'All payments', icon: 'card' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
  { to: '/admin/reports', label: 'Reports', icon: 'chart' },
];

function sectionsForRole(role) {
  if (role === ROLES.ADMIN) {
    return [
      { title: 'My account', items: CUSTOMER_NAV },
      { title: 'My fleet', items: FLEET_NAV },
      { title: 'Administration', items: ADMIN_NAV },
    ];
  }
  if (role === ROLES.FLEET_MANAGER) {
    return [{ title: 'My fleet', items: FLEET_NAV }];
  }
  return [{ title: 'My account', items: CUSTOMER_NAV }];
}

export default function Navbar({ className = '' }) {
  const { user, isAuthenticated, logout } = useAuth();
  const scrolled = useScrollPosition(24);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const drawerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { setDrawerOpen(false); setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClickAway = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [menuOpen]);

  useEffect(() => {
    setScrollLocked(drawerOpen);
    return () => setScrollLocked(false);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const stopWheelPropagation = (event) => {
    if (!drawerRef.current?.contains(event.target)) return;
    event.stopPropagation();
  };

  const handleAnchor = (event, to) => {
    if (!to.includes('#')) return;
    const [path, hash] = to.split('#');
    if (location.pathname !== (path || '/')) return;
    event.preventDefault();
    scrollToTarget(`#${hash}`);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    setDrawerOpen(false);
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true, state: null });
  };

  const sections = sectionsForRole(user?.role);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink-950"
      >
        Skip to content
      </a>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${className} ${
          scrolled
            ? 'border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="shell flex h-[68px] mt-2 items-center justify-between gap-6 sm:h-[76px]">
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-start">
              <Logo to={isAuthenticated ? landingRouteFor(user) : '/'} />
              {location.pathname === '/' && (
                <small className="ml-[42px]  text-[10px]  tracking-[0.22em] text-mist-300">
        By A.K.Shifan
      </small>
              )}
            </div>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
              {PUBLIC_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={(event) => handleAnchor(event, link.to)}
                  className="rounded-full px-3.5 py-2 text-[13.5px] text-mist-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-2.5">
                  <NotificationBell />
                </div>

                {/* Desktop dropdown — three scrollable groups for admin */}
                <div className="relative hidden sm:block" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-3.5 transition hover:border-white/20"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-lime font-mono text-[11px] font-semibold text-ink-950">
                      {initialsOf(user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`)}
                    </span>
                    <span className="max-w-[120px] truncate text-[13px] text-mist-200">
                      {user?.firstName || 'Account'}
                    </span>
                    <Icon name="chevronDown" size={14} className="text-mist-400" />
                  </button>

                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-12 max-h-[80vh] w-72 animate-fadeUp overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.08] bg-ink-900 py-1.5 shadow-lift"
                    >
                      <div className="border-b border-white/[0.06] px-4 py-3">
                        <p className="truncate text-[13.5px] font-medium text-white">
                          {user?.fullName || user?.firstName}
                        </p>
                        <p className="truncate text-[12px] text-mist-400">{user?.email}</p>
                        <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-lime">
                          {user?.role?.replace('_', ' ')}
                        </p>
                      </div>

                      {sections.map((section, idx) => (
                        <div key={section.title} className={idx > 0 ? 'border-t border-white/[0.06]' : ''}>
                          <p className="px-4 pt-3 pb-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-mist-500">
                            {section.title}
                          </p>
                          {section.items.map((link) => (
                            <Link
                              key={`${section.title}-${link.to}`}
                              role="menuitem"
                              to={link.to}
                              onClick={() => setMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] text-mist-200 transition hover:bg-white/[0.05] hover:text-white"
                            >
                              <Icon name={link.icon} size={15} className="text-mist-400" />
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ))}

                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-2.5 text-left text-[13.5px] text-mist-300 transition hover:bg-white/[0.05] hover:text-white"
                      >
                        <Icon name="logout" size={15} /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2.5 sm:flex">
                <Button to="/login" variant="quiet" size="sm">
                  Sign in
                </Button>
                <Button to="/fleet" size="sm" iconRight="arrowRight">
                  Book a car
                </Button>
              </div>
            )}

            <button
              type="button"
              className="icon-btn lg:hidden"
              onClick={() => setDrawerOpen((open) => !open)}
              aria-expanded={drawerOpen}
              aria-controls="mobile-navigation"
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            >
              <Icon name={drawerOpen ? 'x' : 'menu'} size={18} />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div id="mobile-navigation" className="fixed inset-0 z-[60] lg:hidden" role="presentation">
          <div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          <nav
            ref={drawerRef}
            onWheel={stopWheelPropagation}
            onTouchMove={stopWheelPropagation}
            className="absolute inset-y-0 right-0 flex w-[min(360px,90vw)] animate-fadeUp flex-col border-l border-white/[0.08] bg-ink-900"
            aria-label="Mobile"
          >
            <div className="flex shrink-0 mt-2 items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex flex-col items-start ">
                <Logo to={isAuthenticated ? landingRouteFor(user) : '/'} />
                {location.pathname === '/' && (
                  <small className="ml-[42px]  text-[10px]  tracking-[0.22em] text-mist-400">
        By A.K.Shifan
      </small>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="icon-btn h-9 w-9"
                aria-label="Close menu"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
              <ul className="flex flex-col gap-1">
                {PUBLIC_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={(event) => handleAnchor(event, link.to)}
                      className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] text-mist-100 transition hover:bg-white/[0.05]"
                    >
                      {link.label}
                      <Icon name="chevronRight" size={16} className="text-mist-500" />
                    </Link>
                  </li>
                ))}
              </ul>

              {isAuthenticated && sections.map((section) => (
                <div key={section.title}>
                  <p className="meta mt-6 px-3">{section.title}</p>
                  <ul className="mt-1 flex flex-col gap-1">
                    {section.items.map((link) => (
                      <li key={`${section.title}-${link.to}`}>
                        <Link
                          to={link.to}
                          onClick={() => setDrawerOpen(false)}
                          className="flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] text-mist-100 transition hover:bg-white/[0.05]"
                        >
                          <Icon name={link.icon} size={17} className="text-mist-400" />
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-white/[0.06] px-4 py-4">
              {isAuthenticated ? (
                <Button variant="ghost" icon="logout" className="w-full" onClick={handleLogout}>
                  Sign out
                </Button>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <Button to="/login" variant="ghost" className="w-full" onClick={() => setDrawerOpen(false)}>
                    Sign in
                  </Button>
                  <Button to="/register" className="w-full" onClick={() => setDrawerOpen(false)}>
                    Create an account
                  </Button>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
