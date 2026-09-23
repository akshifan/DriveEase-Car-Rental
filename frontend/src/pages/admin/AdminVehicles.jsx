import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { changeVehicleStatus, exportFleetCsv, listFleetInventory } from '../../api/vehicles.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
  VEHICLE_STATUS,
  VEHICLE_STATUS_LABELS,
} from '../../utils/constants.js';

const SORTS = [
  { value: 'make,asc', label: 'Make (A–Z)' },
  { value: 'dailyRate,desc', label: 'Rate (high → low)' },
  { value: 'dailyRate,asc', label: 'Rate (low → high)' },
  { value: 'mileage,desc', label: 'Odometer (high → low)' },
  { value: 'createdAt,desc', label: 'Newest first' },
];

export default function AdminVehicles() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('make,asc');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listFleetInventory({
      search: debouncedSearch || undefined,
      location: location || undefined,
      page,
      size: 12,
      sort,
    })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [debouncedSearch, location, page, sort]);

  useEffect(load, [load]);

  // The list endpoint is not status-filtered, so the status chip filters the
  // current page only - the count tiles take their numbers from the whole page.
  const rows = useMemo(
    () => (result?.content || []).filter((vehicle) => (status ? vehicle.status === status : true)),
    [result, status],
  );

  const counts = useMemo(() => {
    const totals = { AVAILABLE: 0, RENTED: 0, MAINTENANCE: 0, RETIRED: 0 };
    (result?.content || []).forEach((vehicle) => {
      totals[vehicle.status] = (totals[vehicle.status] || 0) + 1;
    });
    return totals;
  }, [result]);

  const flaggedStatus = async (vehicle, nextStatus) => {
    setBusyId(vehicle.id);
    try {
      await changeVehicleStatus(vehicle.id, {
        status: nextStatus,
        reason: `Administrative status change to ${nextStatus.toLowerCase()}`,
      });
      toast.success('Status updated', `${vehicle.displayName} is now ${nextStatus.toLowerCase()}.`);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not change the status', apiError.message);
    } finally {
      setBusyId(null);
    }
  };

  const downloadCsv = async () => {
    try {
      await exportFleetCsv({ location: location || undefined });
      toast.success('Export started', 'driveease-fleet.csv is downloading.');
    } catch (failure) {
      toast.error('Export failed', failure.message);
    }
  };

  const locations = useMemo(
    () => Array.from(new Set((result?.content || []).map((v) => v.location).filter(Boolean))).sort(),
    [result],
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1 className="display-md mt-3">Vehicle management</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            The full inventory including workshop and retired cars. Fleet managers own day-to-day
            edits; administrators can intervene on any vehicle.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" icon="download" onClick={downloadCsv}>
            Export CSV
          </Button>
          <Button to="/console/vehicles" iconRight="arrowUpRight">
            Open fleet console
          </Button>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Available" value={counts.AVAILABLE} icon="checkCircle" tone="lime" hint="On this page" />
        <StatTile label="On rent" value={counts.RENTED} icon="key" hint="Currently with a customer" />
        <StatTile label="In the workshop" value={counts.MAINTENANCE} icon="wrench" hint="Maintenance in progress" />
        <StatTile
          label="Retired"
          value={counts.RETIRED}
          icon="trash"
          tone={counts.RETIRED ? 'danger' : 'default'}
          hint="Permanently out of service"
        />
      </section>

      <div className="surface flex flex-wrap items-end gap-4 p-5">
        <Input
          className="min-w-[200px] flex-1"
          label="Search"
          placeholder="Make, model or registration"
          prefixIcon="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <Select
          className="w-[170px]"
          label="Location"
          placeholder="All locations"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
            setPage(0);
          }}
          options={locations.map((entry) => ({ value: entry, label: entry }))}
        />
        <Select
          className="w-[180px]"
          label="State"
          placeholder="Every state"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Select
          className="w-[190px]"
          label="Sort"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(0);
          }}
          options={SORTS}
        />
        <p className="ml-auto pb-2 text-[12.5px] text-mist-400">
          {loading ? 'Loading…' : `${result?.totalElements || 0} vehicles`}
        </p>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="car"
            title={status ? `No ${status.toLowerCase()} vehicles on this page` : 'No vehicles match'}
            description="Try a different search term, location or state filter."
          />
        </div>
      ) : (
        <>
          <DataTable
            rows={rows}
            columns={[
              {
                key: 'displayName',
                header: 'Vehicle',
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-white/[0.07] bg-ink-850">
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0">
                      <Link
                        to={`/console/vehicles/${row.id}/history`}
                        className="text-[13.5px] text-white hover:text-lime"
                      >
                        {row.displayName}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10.5px] text-mist-500">{row.licensePlate}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'category',
                header: 'Category',
                render: (row) => (
                  <span className="badge badge-neutral">{CATEGORY_LABELS[row.category]}</span>
                ),
              },
              {
                key: 'spec',
                header: 'Spec',
                render: (row) => (
                  <span className="text-[12.5px] text-mist-400">
                    {FUEL_LABELS[row.fuelType]} · {TRANSMISSION_LABELS[row.transmission]} · {row.seats} seats
                  </span>
                ),
              },
              { key: 'location', header: 'Location' },
              {
                key: 'dailyRate',
                header: 'Rate',
                align: 'right',
                render: (row) => (
                  <div>
                    <p className="text-[13px] text-mist-100">{formatCurrency(row.dailyRate)}</p>
                    <p className="mt-0.5 text-[11px] text-mist-500">
                      dep {formatCurrency(row.depositAmount)}
                    </p>
                  </div>
                ),
              },
              {
                key: 'mileage',
                header: 'Odometer',
                align: 'right',
                render: (row) => `${Number(row.mileage || 0).toLocaleString('en-IN')} km`,
              },
              { key: 'status', header: 'State', render: (row) => <StatusBadge status={row.status} kind="vehicle" /> },
              {
                key: 'actions',
                header: '',
                align: 'right',
                render: (row) => (
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/console/vehicles/${row.id}/history`}
                      className="icon-btn h-8 w-8"
                      aria-label={`History for ${row.displayName}`}
                    >
                      <Icon name="clock" size={15} />
                    </Link>
                    {row.status === VEHICLE_STATUS.MAINTENANCE && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="check"
                        loading={busyId === row.id}
                        onClick={() => flaggedStatus(row, VEHICLE_STATUS.AVAILABLE)}
                      >
                        Release
                      </Button>
                    )}
                    {row.status === VEHICLE_STATUS.RETIRED && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="refresh"
                        loading={busyId === row.id}
                        onClick={() => flaggedStatus(row, VEHICLE_STATUS.AVAILABLE)}
                      >
                        Reinstate
                      </Button>
                    )}
                    {(row.status === VEHICLE_STATUS.AVAILABLE || row.status === VEHICLE_STATUS.RENTED) && (
                      <Button
                        size="sm"
                        variant="quiet"
                        icon="wrench"
                        loading={busyId === row.id}
                        disabled={row.status === VEHICLE_STATUS.RENTED}
                        onClick={() => flaggedStatus(row, VEHICLE_STATUS.MAINTENANCE)}
                      >
                        Workshop
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
            emptyTitle="No vehicles"
          />

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      <p className="text-[12px] leading-relaxed text-mist-500">
        Retiring a vehicle, and moving a car that is out on rent, are refused by the API — the state
        machine protects the demo data. Fleet-wide utilisation and revenue by vehicle live in{' '}
        <Link to="/admin/reports" className="text-mist-300 underline decoration-white/20">
          Reports
        </Link>
        . Created {formatDate(new Date())}.
      </p>
    </div>
  );
}
