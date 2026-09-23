import { Link } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Rating, StatusBadge } from '../ui/primitives.jsx';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
} from '../../utils/constants.js';
import { formatCurrency } from '../../utils/format.js';

/**
 * Catalogue card.
 *
 * The image is the database-provided gallery URL with an inline SVG fallback, so
 * a missing asset degrades into a branded panel instead of a broken icon. All
 * imagery is lazy-loaded with explicit dimensions to keep layout stable.
 */
export default function VehicleCard({ vehicle, showStatus = false }) {
  const image = vehicle.primaryImageUrl || vehicle.imageUrl;
  const fuelIcon = vehicle.fuelType === 'ELECTRIC' ? 'zap' : 'fuel';

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-900/70 transition duration-300 hover:-translate-y-1 hover:border-white/15 hover:shadow-lift">
      <Link
        to={`/fleet/${vehicle.id}`}
        className="relative block aspect-[16/10] overflow-hidden bg-ink-850"
        aria-label={`View ${vehicle.displayName || `${vehicle.make} ${vehicle.model}`}`}
      >
        {image ? (
          <img
            src={image}
            alt={`${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            decoding="async"
            width="640"
            height="400"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-mist-600">
            <Icon name="car" size={38} />
          </span>
        )}

        <span className="absolute left-3 top-3 flex flex-wrap items-center gap-2">
          <span className="badge border-white/15 bg-ink-950/80 text-mist-100 backdrop-blur">
            {CATEGORY_LABELS[vehicle.category] || vehicle.category}
          </span>
          {showStatus && (
            <StatusBadge status={vehicle.status} kind="vehicle" className="bg-ink-950/80 backdrop-blur" />
          )}
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-[17px] font-semibold text-white">
              <Link to={`/fleet/${vehicle.id}`} className="hover:text-lime">
                {vehicle.displayName || `${vehicle.make} ${vehicle.model}`}
              </Link>
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-mist-400">
              <Icon name="mapPin" size={13} />
              {vehicle.location}
              <span className="text-mist-600">·</span>
              {vehicle.year}
            </p>
          </div>
          <Rating value={vehicle.averageRating || 0} count={vehicle.reviewCount} />
        </div>

        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px] text-mist-400">
          <li className="inline-flex items-center gap-1.5">
            <Icon name={fuelIcon} size={14} className="text-mist-500" />
            {FUEL_LABELS[vehicle.fuelType] || vehicle.fuelType}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Icon name="gear" size={14} className="text-mist-500" />
            {TRANSMISSION_LABELS[vehicle.transmission] || vehicle.transmission}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Icon name="seat" size={14} className="text-mist-500" />
            {vehicle.seats} seats
          </li>
        </ul>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-white/[0.06] pt-4">
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
            to={`/fleet/${vehicle.id}`}
            className="btn btn-sm btn-ghost"
            aria-label={`View details and book ${vehicle.displayName || vehicle.make}`}
          >
            View
            <Icon name="arrowRight" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
