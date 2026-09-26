import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionHeading,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { exportFleetCsv } from '../../api/vehicles.js';
import { fleetDashboard } from '../../api/bookings.js';
import { api } from '../../api/client.js';
import { useApiResource } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDate, formatPercent, pluralise } from '../../utils/format.js';
import { CATEGORY_LABELS, VEHICLE_STATUS_LABELS } from '../../utils/constants.js';

export default function FleetDashboard() {
  const { data, error, loading, reload } = useApiResource(() => fleetDashboard(), []);
  const { data: earnings } = useApiResource(
    () => api.get('/fleet/payments/summary').catch(() => null),
    [],
  );
  const toast = useToast();

  const downloadFleet = async () => {
    try {
      await exportFleetCsv({});
      toast.success('Fleet export started', 'driveease-fleet.csv is downloading.');
    } catch (failure) {
      toast.error('Export failed', failure.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const {
    vehicleStatusCounts = {},
    totalVehicles = 0,
    activeBookings = 0,
    pendingConfirmations = 0,
    upcomingPickups = 0,
    openDamageRecords = 0,
    scheduledMaintenance = 0,
    fleetValue,
    averageDailyRate,
    utilisationPercent,
    vehicles = [],
    upcomingBookings = [],
    maintenanceDue = [],
    recentDamage = [],
  } = data || {};

  // Empty-state: the caller owns no vehicles yet. Both a fresh fleet manager
  // and an admin who hasn't listed a car will land here.
  if (totalVehicles === 0) {
    return (
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="eyebrow">Fleet operations</p>
            <h1 className="display-md mt-3">Fleet overview</h1>
            <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
              Your fleet is empty. Add a vehicle to start taking bookings.
            </p>
          </div>
          <Button to="/console/vehicles" icon="plus" iconRight="arrowRight">
            Add your first vehicle
          </Button>
        </header>
        <div className="surface">
          <EmptyState
            icon="car"
            title="No vehicles in your fleet yet"
            description="Add a car, set its daily rate and deposit, and it will appear in the public catalogue for customers to book."
            action={
              <Button to="/console/vehicles" icon="plus">
                Add a vehicle
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Fleet operations</p>
          <h1 className="display-md mt-3">Fleet overview</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Live vehicle states, today&apos;s handovers and money earned from your vehicles.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" size="md" icon="download" onClick={downloadFleet}>
            Export fleet CSV
          </Button>
          <Button to="/console/payments" variant="ghost" size="md" icon="card">
            Payments
          </Button>
          <Button to="/console/bookings" iconRight="arrowRight">
            Today&apos;s work
          </Button>
        </div>
      </header>

      {/* Earnings */}
      {earnings && (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Gross collected"
            value={formatCurrency(earnings.grossCollected || 0)}
            icon="card"
            tone="lime"
            hint={`${earnings.totalPayments || 0} payments`}
          />
          <StatTile
            label="Refunded"
            value={formatCurrency(earnings.refunded || 0)}
            icon="refresh"
            tone={Number(earnings.refunded || 0) > 0 ? 'info' : 'default'}
          />
          <StatTile
            label="Net collected"
            value={formatCurrency(earnings.netCollected || 0)}
            icon="chart"
            hint={`${earnings.completedBookings || 0} completed bookings`}
          />
          <StatTile
            label="Live rental value"
            value={formatCurrency(earnings.activeRentalRevenue || 0)}
            icon="key"
            hint="Base amounts on currently active rentals"
          />
        </section>
      )}

      {/* Key numbers */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Fleet size"
          value={totalVehicles}
          icon="car"
          hint={`${vehicleStatusCounts.AVAILABLE || 0} available · ${vehicleStatusCounts.RENTED || 0} on rent`}
        />
        <StatTile
          label="Utilisation"
          value={formatPercent(utilisationPercent, 1)}
          icon="gauge"
          tone="lime"
          hint="Rented days ÷ available rental days"
        />
        <StatTile
          label="Out right now"
          value={activeBookings}
          icon="key"
          hint={`${pluralise(upcomingPickups, 'pickup')} due`}
        />
        <StatTile
          label="Needs attention"
          value={openDamageRecords + scheduledMaintenance + pendingConfirmations}
          icon="alert"
          tone={openDamageRecords ? 'danger' : 'default'}
          hint={`${pendingConfirmations} awaiting confirmation · ${scheduledMaintenance} scheduled services`}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-6">
          <h2 className="font-display text-[16px] font-semibold text-white">Vehicle states</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {Object.entries(VEHICLE_STATUS_LABELS).map(([status, label]) => {
              const count = vehicleStatusCounts[status] || 0;
              const share = totalVehicles ? Math.round((count / totalVehicles) * 100) : 0;
              return (
                <div key={status} className="surface-inset p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge status={status} kind="vehicle" />
                    <span className="font-display text-[20px] font-semibold text-white">{count}</span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-lime/60"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11.5px] text-mist-500">
                    {share}% of the fleet · {label}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-[16px] font-semibold text-white">Fleet economics</h2>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="meta">Monthly earning capacity</dt>
              <dd className="mt-1 font-display text-[24px] font-semibold text-white">
                {formatCurrency(fleetValue || 0)}
              </dd>
              <p className="mt-1 text-[11.5px] text-mist-500">
                Daily rates of every bookable car, projected across 30 days.
              </p>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <dt className="meta">Average daily rate</dt>
              <dd className="mt-1 font-display text-[20px] font-semibold text-white">
                {formatCurrency(averageDailyRate, { precise: true })}
              </dd>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <dt className="meta">Maintenance scheduled</dt>
              <dd className="mt-1 font-display text-[20px] font-semibold text-white">
                {scheduledMaintenance}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SectionHeading
            eyebrow="Next up"
            title="Upcoming handovers"
            action={
              <Button to="/console/bookings" variant="quiet" size="sm" iconRight="arrowRight">
                All bookings
              </Button>
            }
          />
          <Card className="mt-5 px-5 py-2">
            {upcomingBookings.length ? (
              <ul className="divide-y divide-white/[0.05]">
                {upcomingBookings.map((booking) => (
                  <li key={booking.id} className="flex flex-wrap items-center gap-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] text-white">
                        {booking.vehicle?.displayName}
                        <span className="ml-2 font-mono text-[11px] text-mist-500">
                          {booking.vehicle?.licensePlate}
                        </span>
                      </p>
                      <p className="mt-1 text-[12.5px] text-mist-400">
                        {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)} ·{' '}
                        {booking.pickupLocation}
                      </p>
                    </div>
                    <StatusBadge status={booking.status} />
                    <Link
                      to="/console/bookings"
                      className="icon-btn h-9 w-9"
                      aria-label={`Manage ${booking.bookingReference}`}
                    >
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="calendar"
                title="No confirmed handovers ahead"
                description="Once a customer pays, their booking appears here for pick-up."
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-white">Maintenance due</h2>
            <Card className="mt-4 divide-y divide-white/[0.05] px-5 py-2">
              {maintenanceDue.length ? (
                maintenanceDue.map((record) => (
                  <div key={record.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-white">{record.vehicleName}</p>
                      <p className="mt-0.5 text-[12px] text-mist-500">
                        {record.type?.replace('_', ' ').toLowerCase()} · {formatDate(record.scheduledDate)}
                      </p>
                    </div>
                    <span className="badge border-white/12 bg-white/[0.05] text-mist-300">
                      {record.status?.replace('_', ' ')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-[13px] text-mist-400">
                  Nothing scheduled. The workshop calendar is clear.
                </p>
              )}
            </Card>
            <Button className="mt-3" size="sm" variant="quiet" to="/console/maintenance" iconRight="arrowRight">
              Maintenance desk
            </Button>
          </div>

          <div>
            <h2 className="font-display text-[16px] font-semibold text-white">Recent damage</h2>
            <Card className="mt-4 divide-y divide-white/[0.05] px-5 py-2">
              {recentDamage.length ? (
                recentDamage.map((record) => (
                  <div key={record.id} className="flex items-start justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-white">{record.vehicleName}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12px] text-mist-500">
                        {record.description}
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        record.severity === 'CRITICAL' || record.severity === 'MAJOR'
                          ? 'border-signal-danger/35 bg-signal-danger/10 text-signal-danger'
                          : 'border-signal-warning/35 bg-signal-warning/10 text-signal-warning'
                      }`}
                    >
                      {record.severity}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-[13px] text-mist-400">No damage logged.</p>
              )}
            </Card>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Inventory"
          title="Vehicles and their next commitment"
          action={
            <Button to="/console/vehicles" variant="ghost" size="sm" iconRight="arrowRight">
              Manage vehicles
            </Button>
          }
        />
        <DataTable
          className="mt-5"
          rows={vehicles}
          emptyTitle="No vehicles in the fleet yet"
          emptyDescription="Add a car to start taking bookings."
          columns={[
            {
              key: 'displayName',
              header: 'Vehicle',
              render: (row) => (
                <div>
                  <p className="text-[13.5px] text-white">{row.displayName}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-mist-500">{row.licensePlate}</p>
                </div>
              ),
            },
            {
              key: 'category',
              header: 'Category',
              render: (row) => CATEGORY_LABELS[row.category] || row.category,
            },
            { key: 'location', header: 'Location' },
            {
              key: 'dailyRate',
              header: 'Rate',
              align: 'right',
              render: (row) => formatCurrency(row.dailyRate),
            },
            {
              key: 'mileage',
              header: 'Odometer',
              align: 'right',
              render: (row) => `${Number(row.mileage || 0).toLocaleString('en-IN')} km`,
            },
            {
              key: 'nextBookingDate',
              header: 'Next booking',
              render: (row) =>
                row.nextBookingDate ? (
                  <span className="text-[12.5px] text-mist-300">
                    {formatDate(row.nextBookingDate)}
                    <span className="ml-2 font-mono text-[11px] text-mist-500">
                      {row.nextBookingReference}
                    </span>
                  </span>
                ) : (
                  <span className="text-[12.5px] text-mist-500">Free</span>
                ),
            },
            { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} kind="vehicle" /> },
            {
              key: 'history',
              header: '',
              align: 'right',
              render: (row) => (
                <Button
                  to={`/console/vehicles/${row.id}/history`}
                  size="sm"
                  variant="quiet"
                  iconRight="arrowUpRight"
                >
                  History
                </Button>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
