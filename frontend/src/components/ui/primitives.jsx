import { forwardRef, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  STATUS_TONES,
  VEHICLE_STATUS_LABELS,
} from '../../utils/constants.js';

/**
 * The shared component vocabulary: buttons, fields, badges, cards, states.
 * Everything here is presentation-only - no data fetching, no business rules.
 */

const VARIANTS = {
  primary: 'btn-primary',
  ghost: 'btn-ghost',
  quiet: 'btn-quiet',
  danger: 'btn-danger',
};

const SIZES = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };

/**
 * Renders a <button>, or a react-router <Link> when `to` is given, or an <a>
 * for external hrefs - so navigation stays semantic everywhere.
 */
export const Button = forwardRef(function Button(
  {
    as,
    to,
    href,
    variant = 'primary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    className = '',
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = `btn ${SIZES[size] || SIZES.md} ${VARIANTS[variant] || VARIANTS.primary} ${className}`;
  const content = (
    <>
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={17} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={17} /> : null}
    </>
  );

  if (to) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }
  const Component = as || 'button';
  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      className={classes}
      aria-busy={loading || undefined}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {content}
    </Component>
  );
});

export function Spinner({ size = 20, className = '' }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className = '',
}) {
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-1 text-lime" aria-hidden="true">*</span>}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1.5 text-[12.5px] text-mist-400">{hint}</p>}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={14} className="mt-[2px] shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { label, error, hint, required, className = '', id, prefixIcon, suffix, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || `field-${generatedId}`;
  return (
    <Field
      label={label}
      htmlFor={inputId}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <div className="relative">
        {prefixIcon && (
          <Icon
            name={prefixIcon}
            size={17}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mist-500"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${prefixIcon ? 'pl-10' : ''} ${suffix ? 'pr-12' : ''} ${
            error ? 'border-signal-danger/60' : ''
          }`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          required={required}
          {...rest}
        />
        {suffix && <div className="absolute right-2 top-1/2 -translate-y-1/2">{suffix}</div>}
      </div>
    </Field>
  );
});

export const Textarea = forwardRef(function Textarea(
  { label, error, hint, required, className = '', id, rows = 4, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || `field-${generatedId}`;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`input ${error ? 'border-signal-danger/60' : ''}`}
        aria-invalid={Boolean(error)}
        required={required}
        {...rest}
      />
    </Field>
  );
});

export const Select = forwardRef(function Select(
  { label, error, hint, required, className = '', id, children, options, placeholder, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id || `field-${generatedId}`;
  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={className}>
      <select
        ref={ref}
        id={inputId}
        className={`input ${error ? 'border-signal-danger/60' : ''}`}
        aria-invalid={Boolean(error)}
        required={required}
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
    </Field>
  );
});

export function Checkbox({ label, description, className = '', id, ...rest }) {
  const generatedId = useId();
  const inputId = id || `check-${generatedId}`;
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input id={inputId} type="checkbox" className="checkbox mt-0.5" {...rest} />
      <div className="min-w-0">
        <label htmlFor={inputId} className="cursor-pointer text-[13.5px] text-mist-100">
          {label}
        </label>
        {description && <p className="mt-0.5 text-[12.5px] text-mist-400">{description}</p>}
      </div>
    </div>
  );
}

/** Status pill that understands booking, payment and vehicle vocabularies. */
export function StatusBadge({ status, kind = 'booking', className = '' }) {
  if (!status) return null;
  const labels =
    kind === 'payment'
      ? PAYMENT_STATUS_LABELS
      : kind === 'vehicle'
        ? VEHICLE_STATUS_LABELS
        : BOOKING_STATUS_LABELS;
  return (
    <span className={`badge ${STATUS_TONES[status] || 'badge-neutral'} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {labels[status] || status}
    </span>
  );
}

export function Card({ as: Component = 'div', className = '', interactive = false, children, ...rest }) {
  return (
    <Component
      className={`surface ${interactive ? 'transition duration-300 hover:border-white/15 hover:bg-ink-850/80' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function SectionHeading({ eyebrow, title, description, align = 'left', action, className = '' }) {
  return (
    <div
      className={`flex flex-col gap-5 ${
        align === 'center' ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'
      } ${className}`}
    >
      <div className={align === 'center' ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        {title && <h2 className="display-lg">{title}</h2>}
        {description && <p className="lede mt-4">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '', rounded = 'rounded-xl' }) {
  return (
    <div
      className={`relative overflow-hidden bg-white/[0.05] ${rounded} ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

export function EmptyState({ icon = 'search', title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      <span className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lime">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="text-lg font-medium text-white">{title}</h3>
      {description && <p className="mt-2 max-w-md text-[14.5px] text-mist-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className = '' }) {
  return (
    <div className={`surface flex flex-col items-center gap-4 px-6 py-14 text-center ${className}`}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-signal-danger/30 bg-signal-danger/10 text-signal-danger">
        <Icon name="alert" size={22} />
      </span>
      <div>
        <h3 className="text-base font-medium text-white">
          {error?.isNotFound ? 'We could not find that' : 'Something went wrong'}
        </h3>
        <p className="mt-1.5 max-w-md text-[14px] text-mist-400">
          {error?.message || 'The request failed. Please try again.'}
        </p>
      </div>
      {onRetry && (
        <Button variant="ghost" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Pagination({ page = 0, totalPages = 1, totalElements, onChange, className = '' }) {
  if (!totalPages || totalPages <= 1) return null;
  const windowSize = 5;
  const start = Math.max(0, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize));
  const pages = Array.from({ length: Math.min(windowSize, totalPages) }, (_, index) => start + index);

  return (
    <nav className={`flex items-center justify-between gap-4 ${className}`} aria-label="Pagination">
      <p className="meta">
        {totalElements !== undefined && `${totalElements} total`}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="icon-btn h-9 w-9"
          onClick={() => onChange(Math.max(0, page - 1))}
          disabled={page === 0}
          aria-label="Previous page"
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        {pages.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-current={value === page ? 'page' : undefined}
            className={`h-9 min-w-9 rounded-full px-3 text-[13px] transition ${
              value === page
                ? 'bg-lime text-ink-950'
                : 'border border-white/10 bg-white/[0.03] text-mist-300 hover:border-white/25 hover:text-white'
            }`}
          >
            {value + 1}
          </button>
        ))}
        <button
          type="button"
          className="icon-btn h-9 w-9"
          onClick={() => onChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
        >
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </nav>
  );
}

/** Read-only star rating; `interactive` turns it into a keyboard-accessible input. */
export function Rating({ value = 0, count, size = 14, interactive = false, onChange, className = '' }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  if (!interactive) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg key={star} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
              <path
                d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L3.5 9.7l5.9-.8L12 3.5Z"
                fill={star <= Math.round(value) ? '#D7F24B' : 'rgba(255,255,255,0.14)'}
              />
            </svg>
          ))}
        </span>
        <span className="text-[12.5px] text-mist-300">
          {value ? value.toFixed(1) : 'New'}
          {count !== undefined && count > 0 && (
            <span className="text-mist-500"> ({count})</span>
          )}
        </span>
        <span className="sr-only">
          {value ? `${value.toFixed(1)} out of 5 from ${count || 0} reviews` : 'No reviews yet'}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={star === value}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className="rounded p-0.5 transition hover:scale-110"
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onClick={() => onChange?.(star)}
        >
          <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
            <path
              d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L3.5 9.7l5.9-.8L12 3.5Z"
              fill={star <= active ? '#D7F24B' : 'rgba(255,255,255,0.14)'}
            />
          </svg>
        </button>
      ))}
    </span>
  );
}

export function StatTile({ label, value, hint, icon, tone = 'default', trend, className = '' }) {
  const toneRing =
    tone === 'lime'
      ? 'text-lime border-lime/25 bg-lime/[0.07]'
      : tone === 'danger'
        ? 'text-signal-danger border-signal-danger/25 bg-signal-danger/[0.07]'
        : tone === 'info'
          ? 'text-ice border-ice/25 bg-ice/[0.07]'
          : 'text-mist-200 border-white/10 bg-white/[0.04]';

  return (
    <div className={`surface p-5 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-mist-400">{label}</p>
        {icon && (
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border ${toneRing}`}>
            <Icon name={icon} size={17} />
          </span>
        )}
      </div>
      <p className="mt-4 font-display text-[28px] font-semibold leading-none text-white">{value}</p>
      {trend && (
        <p
          className={`mt-2 inline-flex items-center gap-1.5 text-[12.5px] ${
            trend.direction === 'up'
              ? 'text-signal-success'
              : trend.direction === 'down'
                ? 'text-signal-danger'
                : 'text-mist-400'
          }`}
        >
          <Icon name={trend.direction === 'down' ? 'chevronDown' : 'chart'} size={13} />
          {trend.label}
        </p>
      )}
      {hint && <p className="mt-2 text-[12.5px] text-mist-400">{hint}</p>}
    </div>
  );
}

export function Divider({ className = '' }) {
  return <div className={`rule ${className}`} role="presentation" />;
}

/** Small labelled definition row used in summaries and receipts. */
export function DetailRow({ label, value, strong = false, className = '' }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <dt className="text-[13px] text-mist-400">{label}</dt>
      <dd className={`text-right text-[13.5px] ${strong ? 'font-medium text-white' : 'text-mist-200'}`}>
        {value}
      </dd>
    </div>
  );
}

export function useTabs(initialKey) {
  const [activeKey, setActiveKey] = useState(initialKey);
  return { activeKey, setActiveKey };
}

export function Tabs({ tabs, activeKey, onChange, className = '' }) {
  const listRef = useRef(null);

  const onKeyDown = (event) => {
    const index = tabs.findIndex((tab) => tab.key === activeKey);
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].key);
    const buttons = listRef.current?.querySelectorAll('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={`no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-white/[0.03] p-1 ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-[13px] transition ${
              selected ? 'bg-lime text-ink-950' : 'text-mist-300 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-2 text-[11px] ${selected ? 'text-ink-800' : 'text-mist-500'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
