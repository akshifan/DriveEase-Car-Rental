import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Rating, StatusBadge } from '../ui/primitives.jsx';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
} from '../../utils/constants.js';
import { formatCurrency } from '../../utils/format.js';
import { mediaUrl } from '../../utils/media.js';

/**
 * Catalogue card — specification-forward.
 *
 * Per PRD §7 (premium catalogue), the card leads with real, backend-provided
 * vehicle data (category, specs, rate, status, location) rather than a flat
 * 2D image. Vehicle photography remains available on the detail page through
 * VehicleGallery where the PRD explicitly requires imagery.
 *
 * The card keeps the same props contract (`vehicle`, `showStatus`) so existing
 * callers — FleetPage, HomePage featured grid, and admin/fleet tables — do not
 * need changes.
 */
export default function VehicleCard({ vehicle, showStatus = false }) {
  const fuelIcon = vehicle.fuelType === 'ELECTRIC' ? 'zap' : 'fuel';
  const displayName =
    vehicle.displayName || `${vehicle.make} ${vehicle.model}`.trim();
  const detailHref = `/fleet/${vehicle.id}`;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-lift">
      {/* Watermark: a small brand glyph, NOT a photo. Gives the card a visual
          anchor without reducing it to an image tile. */}
      {vehicle.imageUrl ? (
        <Link to={detailHref} className="relative block aspect-[16/10] overflow-hidden bg-ink-850">
          <img
            src={mediaUrl(vehicle.imageUrl)}
            alt={displayName}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            onError={(event) => {
              // If the URL 404s, hide the img so the glyph fallback below is visible.
              event.currentTarget.style.display = 'none';
            }}
          />
          <span className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="badge border-white/15 bg-ink-950/80 text-mist-100 backdrop-blur">
          {CATEGORY_LABELS[vehicle.category] || vehicle.category}
        </span>
            {showStatus && <StatusBadge status={vehicle.status} kind="vehicle" className="bg-ink-950/80 backdrop-blur" />}
      </span>
        </Link>
      ) : (
        <div className="relative aspect-[16/10] overflow-hidden bg-ink-850 flex items-center justify-center text-mist-600">
          <Icon name="car" size={48} strokeWidth={1.2} />
          <span className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
        <span className="badge border-white/15 bg-ink-950/80 text-mist-100 backdrop-blur">
          {CATEGORY_LABELS[vehicle.category] || vehicle.category}
        </span>
            {showStatus && <StatusBadge status={vehicle.status} kind="vehicle" className="bg-ink-950/80 backdrop-blur" />}
      </span>
        </div>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 text-white/[0.035] transition duration-500 group-hover:text-white/[0.06]"
      >
        <Icon name="car" size={148} strokeWidth={1.1} />
      </span>

      <div className="relative flex flex-1 flex-col p-5">
        {/* Top row: category + optional status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge border-white/15 bg-white/[0.05] text-mist-200">
            {CATEGORY_LABELS[vehicle.category] || vehicle.category}
          </span>
          {showStatus && <StatusBadge status={vehicle.status} kind="vehicle" />}
          {vehicle.bookable === false && !showStatus && (
            <span className="badge border-signal-warning/35 bg-signal-warning/10 text-signal-warning">
              Unavailable
            </span>
          )}
        </div>

        {/* Name + rating */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[17px] font-semibold text-white">
              <Link to={detailHref} className="hover:text-lime">
                {displayName}
              </Link>
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-mist-400">
              <Icon name="mapPin" size={13} />
              <span className="truncate">{vehicle.location || 'Location on request'}</span>
              <span className="text-mist-600">·</span>
              <span>{vehicle.year}</span>
            </p>
          </div>
          <Rating value={vehicle.averageRating || 0} count={vehicle.reviewCount} />
        </div>

        {/* Spec pills — real backend data only */}
        <ul className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12.5px] text-mist-300">
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
            <Icon name={fuelIcon} size={13} className="text-mist-400" />
            {FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
            <Icon name="gear" size={13} className="text-mist-400" />
            {TRANSMISSION_LABELS[vehicle.transmission] || vehicle.transmission}
          </li>
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
            <Icon name="seat" size={13} className="text-mist-400" />
            {vehicle.seats} seats
          </li>
          {vehicle.doors ? (
            <li className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1">
              <Icon name="door" size={13} className="text-mist-400" />
              {vehicle.doors} doors
            </li>
          ) : null}
        </ul>

        {/* Rate + CTA */}
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-white/[0.06] pt-4 [margin-top:1.5rem]">
          <div>
            <p className="font-display text-[21px] font-semibold leading-none text-white">
              {formatCurrency(vehicle.dailyRate)}
              <span className="ml-1 font-sans text-[12.5px] font-normal text-mist-400">/day</span>
            </p>
            <p className="mt-1 text-[11.5px] text-mist-500">
              Deposit {formatCurrency(vehicle.depositAmount)}
            </p>
          </div>
          <Link
            to={detailHref}
            className="btn btn-sm btn-ghost"
            aria-label={`View details and book ${displayName}`}
          >
            View
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
