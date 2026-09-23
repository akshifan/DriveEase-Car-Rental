import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import Icon from '../ui/Icon.jsx';

const COLUMNS = [
  {
    title: 'Rent',
    links: [
      { label: 'Browse the fleet', to: '/fleet' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Pricing', to: '/fleet?sort=dailyRate,asc' },
      { label: 'Locations', to: '/support#locations' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create account', to: '/register' },
      { label: 'My bookings', to: '/bookings' },
      { label: 'Payments & receipts', to: '/payments' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Support', to: '/support' },
      { label: 'Fleet partnerships', to: '/support#partners' },
      { label: 'Careers', to: '/support#careers' },
      { label: 'Press', to: '/support#press' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/[0.06] bg-ink-950">
      <div className="shell py-14">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-5 text-[14px] leading-relaxed text-mist-400">
              Premium self-drive car rental across Karnataka&apos;s coast and highlands. Transparent
              pricing, verified vehicles and a booking engine that tells you the truth about
              availability.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="mailto:hello@driveease.app"
                className="icon-btn"
                aria-label="Email DriveEase"
              >
                <Icon name="mail" size={16} />
              </a>
              <a href="tel:+918200012345" className="icon-btn" aria-label="Call DriveEase">
                <Icon name="phone" size={16} />
              </a>
              <span className="meta ml-1">Mon–Sun · 7am – 11pm IST</span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="font-display text-[13px] uppercase tracking-[0.16em] text-mist-300">
                {column.title}
              </h2>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-mist-400 transition hover:text-lime"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="rule my-10" />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-mist-500">
            © {new Date().getFullYear()} DriveEase Mobility Pvt Ltd. A portfolio project — no real
            payments are processed.
          </p>
          <div className="flex items-center gap-5">
            <Link to="/support#privacy" className="text-[12.5px] text-mist-500 hover:text-mist-300">
              Privacy
            </Link>
            <Link to="/support#terms" className="text-[12.5px] text-mist-500 hover:text-mist-300">
              Terms
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[12.5px] text-mist-500">
              <Icon name="shield" size={13} className="text-lime" /> Sandbox payments
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
