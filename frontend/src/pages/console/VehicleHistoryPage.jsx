import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  ErrorState,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import { getVehicle, getVehicleHistory } from '../../api/vehicles.js';
import { severityTone } from '../../utils/damage.js';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, formatPercent } from '../../utils/format.js';
import { CATEGORY_LABELS, FUEL_LABELS, TRANSMISSION_LABELS } from '../../utils/constants.js';

const FILTERS = [
  { key: 'ALL', label: 'Everything', icon: 'layers' },
  { key: 'BOOKING', label: 'Trips', icon: 'calendar' },
  { key: 'MAINTENANCE', label: 'Workshop', icon: 'wrench' },
  { key: 'DAMAGE', label: 'Damage', icon: 'alert' },
  { key: 'STATUS', label: 'Status', icon: 'gauge' },
];

/** Icon + tone for an entry type coming back from the vehicle history feed. */
function entryVisual(type) {
  switch (type) {
    case 'BOOKING':
      return { icon: 'calendar', tone: 'border-ice/30 bg-ice/[0.08] text-ice' };
    case 'MAINTENANCE':
      return { icon: 'wrench', tone: 'border-signal-info/35 bg-signal-info/10 text-signal-info' };
    case 'DAMAGE':
      return { icon: 'alert', tone: 'border-signal-danger/35 bg-signal-danger/10 text-signal-danger' };
    case 'STATUS':
      return { icon: 'gauge', tone: 'border-lime/35 bg-lime/10 text-lime' };
    case 'REGISTRATION':
      return { icon: 'plus', tone: 'border-white/15 bg-white/[0.05] text-mist-200' };
    default:
      return { icon: 'file', tone: 'border-white/12 bg-white/[0.05] text-mist-300' };
  }
}

export default function VehicleHistoryPage() {
  const { vehicleId } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([getVehicle(vehicleId), getVehicleHistory(vehicleId)])
      .then(([detail, history]) => {
        setVehicle(detail);
        setEntries(Array.isArray(history) ? history : history?.events || []);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [vehicleId]);

  useEffect(load, [load]);

  const counts = useMemo(() => {
    const totals = { ALL: entries.length, BOOKING: 0, MAINTENANCE: 0, DAMAGE: 0, STATUS: 0 };
    entries.forEach((entry) => {
      if (totals[entry.type] !== undefined) totals[entry.type] += 1;
    });
    return totals;
  }, [entries]);

  const visible = useMemo(
    () => (filter === 'ALL' ? entries : entries.filter((entry) => entry.type === filter)),
    [entries, filter],
  );

  const completedTrips = entries.filter((entry) => entry.type === 'BOOKING' && entry.distanceKm != null);
  const distance = completedTrips.reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0);
  const maintenanceSpend = entries
    .filter((entry) => entry.type === 'MAINTENANCE')
    .reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
  const damageSpend = entries
    .filter((entry) => entry.type === 'DAMAGE')
    .reduce((sum, entry) => sum + Number(entry.actualRepairCost || entry.repairEstimate || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <div className="grid gap-5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !vehicle) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-mist-500">
        <Link to="/console/vehicles" className="hover:text-mist-200">
          Vehicles
        </Link>
        <Icon name="chevronRight" size={13} />
        <span className="text-mist-300">{vehicle.displayName}</span>
      </nav>

      {/* Header */}
      <section className="surface flex flex-wrap items-start gap-6 p-6">
        <div className="h-28 w-40 shrink-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-ink-850">
          {vehicle.imageUrl && (
            <img
              src={vehicle.imageUrl}
              alt={vehicle.displayName}
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="display-md">{vehicle.displayName}</h1>
            <StatusBadge status={vehicle.status} kind="vehicle" />
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11.5px] uppercase tracking-[0.12em] text-mist-500">
            <span>{vehicle.licensePlate}</span>
            <span>{CATEGORY_LABELS[vehicle.category]}</span>
            <span>{FUEL_LABELS[vehicle.fuelType]}</span>
            <span>{TRANSMISSION_LABELS[vehicle.transmission]}</span>
            <span>{vehicle.year}</span>
          </p>
          <p className="mt-2 text-[13.5px] text-mist-400">
            {vehicle.location}
            {vehicle.vin ? ` · VIN ${vehicle.vin}` : ''}
          </p>
        </div>

        <div className="text-right">
          <p className="font-display text-[22px] font-semibold text-white">
            {formatCurrency(vehicle.dailyRate)}
          </p>
          <p className="mt-0.5 text-[12px] text-mist-500">per day</p>
          {vehicle.averageRating != null && (
            <p className="mt-2 text-[12.5px] text-mist-300">
              {Number(vehicle.averageRating).toFixed(1)}★ · {vehicle.reviewCount} reviews
            </p>
          )}
        </div>
      </section>

      {/* Lifetime numbers */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Trips completed"
          value={completedTrips.length}
          icon="calendar"
          hint={`${formatCurrency(vehicle.dailyRate)} per day`}
        />
        <StatTile
          label="Odometer"
          value={`${Number(vehicle.mileage || 0).toLocaleString('en-IN')} km`}
          icon="gauge"
          hint={distance ? `${distance.toLocaleString('en-IN')} km logged in history` : undefined}
        />
        <StatTile label="Maintenance spend" value={formatCurrency(maintenanceSpend)} icon="wrench" />
        <StatTile
          label="Damage spend"
          value={formatCurrency(damageSpend)}
          icon="alert"
          tone={damageSpend > 0 ? 'danger' : 'default'}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
        {/* Timeline */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-[17px] font-semibold text-white">Service & trip history</h2>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => {
                const active = filter === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${
                      active
                        ? 'border-lime/45 bg-lime/[0.1] text-lime'
                        : 'border-white/10 bg-white/[0.02] text-mist-400 hover:border-white/20 hover:text-mist-200'
                    }`}
                  >
                    <Icon name={option.icon} size={13} />
                    {option.label}
                    <span className="font-mono text-[10.5px] opacity-70">{counts[option.key] || 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Card className="mt-5 p-6">
            {visible.length ? (
              <ol className="relative space-y-6 border-l border-white/[0.08] pl-7">
                {visible.map((entry, index) => {
                  const visual = entryVisual(entry.type);
                  return (
                    <li key={entry.id ?? `${entry.type}-${index}`} className="relative">
                      <span
                        className={`absolute -left-[38px] inline-flex h-8 w-8 items-center justify-center rounded-full border ${visual.tone}`}
                      >
                        <Icon name={visual.icon} size={15} />
                      </span>

                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <p className="text-[14px] font-medium text-white">{entry.title}</p>
                            {entry.severity && (
                              <span className={`badge ${severityTone(entry.severity)}`}>
                                {entry.severity}
                              </span>
                            )}
                            {entry.status && !entry.severity && (
                              <span className="badge badge-neutral">{entry.status.replace('_', ' ')}</span>
                            )}
                          </div>
                          {entry.description && (
                            <p className="mt-1.5 text-[13px] leading-relaxed text-mist-400">
                              {entry.description}
                            </p>
                          )}
                          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] uppercase tracking-[0.1em] text-mist-500">
                            <span>{formatDate(entry.occurredAt)}</span>
                            {entry.reference && <span>{entry.reference}</span>}
                            {entry.odometerReading != null && (
                              <span>{Number(entry.odometerReading).toLocaleString('en-IN')} km</span>
                            )}
                            {entry.actorName && <span>{entry.actorName}</span>}
                          </p>
                        </div>

                        <div className="text-right">
                          {entry.amount != null && (
                            <p className="text-[13.5px] text-mist-100">{formatCurrency(entry.amount)}</p>
                          )}
                          {entry.cost != null && (
                            <p className="text-[13.5px] text-mist-100">{formatCurrency(entry.cost)}</p>
                          )}
                          {entry.actualRepairCost != null || entry.repairEstimate != null ? (
                            <p className="text-[13.5px] text-mist-100">
                              {formatCurrency(entry.actualRepairCost ?? entry.repairEstimate)}
                            </p>
                          ) : null}
                          {entry.distanceKm != null && (
                            <p className="mt-0.5 text-[11.5px] text-mist-500">
                              {Number(entry.distanceKm).toLocaleString('en-IN')} km driven
                            </p>
                          )}
                          {entry.bookingReference && (
                            <p className="mt-0.5 font-mono text-[10.5px] text-mist-500">
                              {entry.bookingReference}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[13.5px] text-mist-300">
                  {entries.length ? 'Nothing of that kind yet.' : 'No history recorded for this car.'}
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* Facts */}
        <aside className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Vehicle record</h2>
            <dl className="mt-5 space-y-3">
              <DetailRow label="Registration" value={vehicle.licensePlate} />
              <DetailRow label="VIN" value={vehicle.vin || '-'} />
              <DetailRow label="Category" value={CATEGORY_LABELS[vehicle.category]} />
              <DetailRow label="Seats / doors" value={`${vehicle.seats} / ${vehicle.doors}`} />
              <DetailRow label="Added to fleet" value={formatDate(vehicle.createdAt)} />
              <DetailRow label="Deposit" value={formatCurrency(vehicle.depositAmount)} />
              <DetailRow label="Active bookings" value={vehicle.activeBookings ?? 0} />
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Post-trip condition</h2>
            <p className="mt-3 text-[13px] leading-relaxed text-mist-400">
              Inspections logged against this car carry the odometer reading at the time, so wear can
              be attributed to a specific renter.
            </p>
            <dl className="mt-5 space-y-3">
              <DetailRow
                label="Damage cases"
                value={counts.DAMAGE}
              />
              <DetailRow label="Workshop visits" value={counts.MAINTENANCE} />
              <DetailRow
                label="Damage per 1,000 km"
                value={
                  distance > 0
                    ? formatCurrency(Math.round(damageSpend / Math.max(1, distance / 1000)))
                    : '-'
                }
              />
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button size="sm" variant="ghost" to="/console/maintenance" icon="wrench">
                Schedule service
              </Button>
              <Button size="sm" variant="quiet" to="/console/damage">
                Damage log
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Icon name="info" size={17} className="mt-0.5 shrink-0 text-ice" />
              <p className="text-[12.5px] leading-relaxed text-mist-400">
                Utilisation for the fleet across the reporting window:{' '}
                <span className="text-mist-200">
                  {formatPercent(vehicle.utilisationPercent ?? null, 1)}
                </span>{' '}
                where the reporting service provides it.
              </p>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
