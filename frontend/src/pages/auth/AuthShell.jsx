import { Link } from 'react-router-dom';
import Logo from '../../components/layout/Logo.jsx';
import Icon from '../../components/ui/Icon.jsx';

/**
 * Shared frame for the four auth screens: a focused form column beside a
 * branded panel that carries the product's voice.
 */
export function AuthShell({ title, subtitle, children, footer, side }) {
  return (
    <div className="pt-[68px] lg:pt-0">
      <div className="grid min-h-[calc(100vh-68px)] lg:min-h-screen lg:grid-cols-2">
        <div className="flex items-center justify-center px-5 py-14 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden">
              <Logo />
            </div>
            <h1 className="display-md mt-8 lg:mt-0">{title}</h1>
            {subtitle && <p className="mt-3 text-[14.5px] leading-relaxed text-mist-400">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-[13.5px] text-mist-400">{footer}</div>}
          </div>
        </div>

        <aside className="relative hidden overflow-hidden border-l border-white/[0.06] bg-ink-900/50 lg:flex lg:items-center lg:justify-center">
          <div className="pointer-events-none absolute inset-0 hairline-grid opacity-40" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 bg-radial-spot" aria-hidden="true" />
          <div className="relative w-full max-w-md px-12">
            {side || (
              <>
                <p className="eyebrow">The DriveEase promise</p>
                <h2 className="display-lg mt-5">
                  No hidden charges.
                  <br />
                  No double bookings.
                </h2>
                <ul className="mt-9 space-y-5">
                  {[
                    ['shield', 'Server-checked availability', 'Dates are validated against live bookings before a car is held for you.'],
                    ['card', 'Transparent money', 'A single total, a receipt for every payment and refunds that show their working.'],
                    ['gauge', 'Cars that are actually maintained', 'Every service and damage entry lives on the vehicle record.'],
                  ].map(([icon, heading, body]) => (
                    <li key={heading} className="flex gap-4">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime/25 bg-lime/[0.08] text-lime">
                        <Icon name={icon} size={18} />
                      </span>
                      <div>
                        <p className="text-[14.5px] font-medium text-white">{heading}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-mist-400">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/fleet"
                  className="mt-10 inline-flex items-center gap-2 text-[13.5px] text-lime hover:text-lime-soft"
                >
                  Browse the fleet without an account
                  <Icon name="arrowRight" size={15} />
                </Link>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default AuthShell;
