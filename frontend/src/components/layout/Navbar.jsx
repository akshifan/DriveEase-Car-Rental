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

const PUBLIC_LINKS = [
  { to: '/fleet', label: 'Fleet' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#insights', label: 'Why DriveEase' },
  { to: '/support', label: 'Support' },
];

export default function Navbar({ className = '' }) {
  const { user, isAuthenticated, isStaff, isAdmin, logout } = useAuth();
  const scrolled = useScrollPosition(24);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

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

  const handleAnchor = (event, to) => {
    if (!to.includes('#')) return;
    const [path, hash] = to.split('#');
    if (location.pathname !== (path || '/')) return;
    event.preventDefault();
    scrollToTarget(`#${hash}`);
    setDrawerOpen(false);
  };

  const signedInLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/bookings', label: 'My bookings' },
    ...(isStaff ? [{ to: '/console', label: 'Fleet console' }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

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
        <div className="shell flex h-[68px] items-center justify-between gap-6 sm:h-[76px]">
          <div className="flex items-center gap-8">
            <Logo />
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
                <div className="hidden items-center gap-2.5 sm:flex">
                  <NotificationBell />
                </div>
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
                      className="absolute right-0 top-12 w-56 animate-fadeUp overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 py-1.5 shadow-lift"
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
                      {signedInLinks.map((link) => (
                        <Link
                          key={link.to}
                          role="menuitem"
                          to={link.to}
                          className="block px-4 py-2.5 text-[13.5px] text-mist-200 transition hover:bg-white/[0.05] hover:text-white"
                        >
                          {link.label}
                        </Link>
                      ))}
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          await logout();
                          navigate('/');
                        }}
                        className="flex w-full items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-left text-[13.5px] text-mist-300 transition hover:bg-white/[0.05] hover:text-white"
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

      {/* Mobile drawer */}
      {drawerOpen && (
        <div id="mobile-navigation" className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <nav
            className="absolute inset-x-0 top-0 animate-fadeUp border-b border-white/[0.08] bg-ink-900 px-5 pb-8 pt-[76px]"
            aria-label="Mobile"
          >
            <ul className="flex flex-col gap-1">
              {[...PUBLIC_LINKS, ...(isAuthenticated ? signedInLinks : [])].map((link) => (
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

            <div className="mt-6 flex flex-col gap-3">
              {isAuthenticated ? (
                <Button
                  variant="ghost"
                  icon="logout"
                  onClick={async () => {
                    await logout();
                    navigate('/');
                  }}
                >
                  Sign out
                </Button>
              ) : (
                <>
                  <Button to="/login" variant="ghost" onClick={() => setDrawerOpen(false)}>
                    Sign in
                  </Button>
                  <Button to="/register" onClick={() => setDrawerOpen(false)}>
                    Create an account
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
