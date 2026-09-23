import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
  Tabs,
} from '../../components/ui/primitives.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import {
  exportRevenueCsv,
  exportUtilisationCsv,
  revenueReport,
  utilisationReport,
} from '../../api/bookings.js';
import { ApiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { formatCurrency, formatDate, formatPercent } from '../../utils/format.js';
import { isoDaysFromNow, monthStartIso, todayIso } from '../../utils/datetime.js';
import {
  CATEGORY_LABELS,
  REPORT_GROUPINGS,
  VEHICLE_CATEGORIES,
} from '../../utils/constants.js';

const TABS = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'utilisation', label: 'Utilisation' },
];

const PRESETS = [
  { key: '7d', label: 'Last 7 days', from: () => isoDaysFromNow(-7), to: () => todayIso() },
  { key: '30d', label: 'Last 30 days', from: () => isoDaysFromNow(-30), to: () => todayIso() },
  { key: '90d', label: 'Last 90 days', from: () => isoDaysFromNow(-90), to: () => todayIso() },
  { key: 'mtd', label: 'Month to date', from: () => monthStartIso(0), to: () => todayIso() },
  {
    key: 'qtd',
    label: 'Three months',
    from: () => monthStartIso(2),
    to: () => todayIso(),
  },
];

/** The API returns one entry shape per bucket; this reads it defensively. */
function bucketOf(entry) {
  const label =
    entry.label || entry.category || entry.branch || entry.key || entry.name || 'Unlabelled';
  return {
    label: String(label).replace(/_/g, ' '),
    revenue: Number(entry.revenue ?? entry.grossRevenue ?? 0),
    bookings: Number(entry.bookings ?? entry.bookingCount ?? 0),
    refunds: Number(entry.refunds ?? entry.refundAmount ?? 0),
  };
}

/** Dependency-free bar chart: one bar per bucket, values on the axis. */
function SeriesChart({ series }) {
  const bars = series.map(bucketOf);
  if (!bars.length) return null;

  const max = Math.max(...bars.map((bar) => bar.revenue), 1);

  return (
    <div className="mt-6">
      <div className="flex h-[210px] items-end gap-1.5" role="img" aria-label="Revenue by bucket">
        {bars.map((bar, index) => {
          const height = Math.max(2, Math.round((bar.revenue / max) * 180));
          return (
            <div
              key={`${bar.label}-${index}`}
              className="group relative flex min-w-[6px] flex-1 flex-col justify-end"
              title={`${bar.label} · ${formatCurrency(bar.revenue)} · ${bar.bookings} bookings`}
            >
              <span
                className="block rounded-t-[3px] bg-lime/70 transition group-hover:bg-lime"
                style={{ height }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
        <span className="meta">{bars[0].label}</span>
        <span className="meta">Peak {formatCurrency(max)}</span>
        <span className="meta">{bars[bars.length - 1].label}</span>
      </div>
      <p className="mt-2 text-[11.5px] text-mist-500">
        Hover a bar for the exact figure — {bars.length} buckets in this range.
      </p>
    </div>
  );
}

function BreakdownTable({ title, description, entries, labelHeading }) {
  const rows = entries.map(bucketOf);
  if (!rows.length) return null;

  const total = rows.reduce((sum, row) => sum + row.revenue, 0) || 1;

  return (
    <Card className="p-6">
      <h3 className="font-display text-[16px] font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 text-[13px] text-mist-400">{description}</p>}
      <table className="table mt-5">
        <thead>
          <tr>
            <th scope="col">{labelHeading}</th>
            <th scope="col" className="text-right">
              Bookings
            </th>
            <th scope="col" className="text-right">
              Revenue
            </th>
            <th scope="col" className="w-32">
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="text-mist-100">
                {CATEGORY_LABELS[row.label.replace(/ /g, '_')] || row.label}
              </td>
              <td className="text-right text-mist-300">{row.bookings}</td>
              <td className="text-right text-mist-100">{formatCurrency(row.revenue)}</td>
              <td>
                <span className="flex items-center gap-2">
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-lime/60"
                      style={{ width: `${Math.round((row.revenue / total) * 100)}%` }}
                    />
                  </span>
                  <span className="w-9 text-right font-mono text-[10.5px] text-mist-500">
                    {Math.round((row.revenue / total) * 100)}%
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function AdminReports() {
  const toast = useToast();

  const [tab, setTab] = useState('revenue');
  const [from, setFrom] = useState(isoDaysFromNow(-30));
  const [to, setTo] = useState(todayIso());
  const [groupBy, setGroupBy] = useState('day');
  const [category, setCategory] = useState('');
  const [branch, setBranch] = useState('');

  const [revenue, setRevenue] = useState(null);
  const [utilisation, setUtilisation] = useState(null);
  const [utilPage, setUtilPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState('');

  const filters = useMemo(
    () => ({ from, to, groupBy, category: category || undefined, branch: branch || undefined }),
    [from, to, groupBy, category, branch],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const request =
      tab === 'revenue'
        ? revenueReport(filters).then((data) => setRevenue(data))
        : utilisationReport({ from, to }).then((data) => setUtilisation(data));

    request
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [tab, filters, from, to]);

  useEffect(load, [load]);

  const runExport = async (kind) => {
    setExporting(kind);
    try {
      if (kind === 'revenue') await exportRevenueCsv(filters);
      else await exportUtilisationCsv({ from, to });
      toast.success('Export started', 'The CSV matches the filters on screen.');
    } catch (failure) {
      toast.error('Export failed', failure.message);
    } finally {
      setExporting('');
    }
  };

  const applyPreset = (preset) => {
    setFrom(preset.from());
    setTo(preset.to());
    setUtilPage(0);
  };

  const totals = revenue?.totals || {};
  const series = revenue?.series || [];
  const utilisationRows = utilisation?.vehicles || [];
  const pagedUtilisation = utilisationRows.slice(utilPage * 10, utilPage * 10 + 10);
  const branches = useMemo(
    () => (revenue?.byBranch || []).map((entry) => String(entry.branch ?? entry.key ?? entry.label ?? '')),
    [revenue],
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1 className="display-md mt-3">Revenue & utilisation</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Aggregated in the database with SQL, never estimated in the browser. Utilisation is rented
            days divided by the rental days the fleet was actually available.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            icon="download"
            loading={exporting === 'revenue'}
            onClick={() => runExport('revenue')}
          >
            Revenue CSV
          </Button>
          <Button
            icon="download"
            loading={exporting === 'utilisation'}
            onClick={() => runExport('utilisation')}
          >
            Utilisation CSV
          </Button>
        </div>
      </header>

      <Tabs tabs={TABS} activeKey={tab} onChange={setTab} className="w-fit" />

      {/* Filters */}
      <div className="surface space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="From" htmlFor="report-from">
            <input
              id="report-from"
              type="date"
              className="input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="report-to">
            <input
              id="report-to"
              type="date"
              className="input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          {tab === 'revenue' && (
            <>
              <Select
                label="Group by"
                value={groupBy}
                onChange={(event) => setGroupBy(event.target.value)}
                options={REPORT_GROUPINGS}
              />
              <Select
                label="Branch"
                placeholder="All branches"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                options={branches
                  .filter(Boolean)
                  .map((entry) => ({ value: entry, label: entry.replace(/_/g, ' ') }))}
              />
              <Select
                label="Segment"
                placeholder="Every category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                options={VEHICLE_CATEGORIES.map((value) => ({
                  value,
                  label: CATEGORY_LABELS[value],
                }))}
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="meta mr-1">Quick ranges</span>
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-[12.5px] text-mist-400 transition hover:border-white/20 hover:text-mist-100"
            >
              {preset.label}
            </button>
          ))}
          {category && tab === 'revenue' && (
            <button
              type="button"
              onClick={() => setCategory('')}
              className="rounded-full border border-lime/35 bg-lime/[0.08] px-3.5 py-1.5 text-[12.5px] text-lime"
            >
              {CATEGORY_LABELS[category]} ✕
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : tab === 'revenue' ? (
        !revenue?.series?.length ? (
          <div className="surface">
            <EmptyState
              icon="chart"
              title="No revenue in this window"
              description="Widen the date range, or pick a different grouping to see the series."
            />
          </div>
        ) : (
          <>
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Gross revenue"
                value={formatCurrency(totals.grossRevenue)}
                icon="card"
                tone="lime"
                hint={`${totals.paidBookings ?? 0} paid bookings`}
              />
              <StatTile
                label="Refunds"
                value={formatCurrency(totals.refunds)}
                icon="refresh"
                tone={Number(totals.refunds) > 0 ? 'info' : 'default'}
                hint={`${totals.cancelledBookings ?? 0} cancelled bookings`}
              />
              <StatTile
                label="Net revenue"
                value={formatCurrency(totals.netRevenue)}
                icon="chart"
                hint={`Deposits held ${formatCurrency(totals.depositHeld)}`}
              />
              <StatTile
                label="Average booking value"
                value={formatCurrency(totals.averageBookingValue)}
                icon="tag"
                hint={`${totals.failedPayments ?? 0} failed payments in range`}
              />
            </section>

            <Card className="p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-[16px] font-semibold text-white">
                    Revenue by {groupBy}
                  </h2>
                  <p className="mt-1.5 text-[13px] text-mist-400">
                    {formatDate(revenue.from)} → {formatDate(revenue.to)} · {series.length} buckets
                  </p>
                </div>
                <p className="font-display text-[20px] font-semibold text-white">
                  {formatCurrency(totals.grossRevenue)}
                </p>
              </div>
              <SeriesChart series={series} />
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <BreakdownTable
                title="By category"
                description="Which segments earn their keep."
                entries={revenue.byCategory || []}
                labelHeading="Category"
              />
              <BreakdownTable
                title="By branch"
                description="Where the money is picked up."
                entries={revenue.byBranch || []}
                labelHeading="Location"
              />
            </div>

            {revenue.byMonth?.length > 0 && groupBy !== 'month' && (
              <Card className="p-6">
                <h3 className="font-display text-[16px] font-semibold text-white">Month on month</h3>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {revenue.byMonth.map((entry) => {
                    const bucket = bucketOf(entry);
                    return (
                      <div key={bucket.label} className="surface-inset p-4">
                        <dt className="meta">{bucket.label}</dt>
                        <dd className="mt-2 font-display text-[18px] font-semibold text-white">
                          {formatCurrency(bucket.revenue)}
                        </dd>
                        <p className="mt-1 text-[11.5px] text-mist-500">{bucket.bookings} bookings</p>
                      </div>
                    );
                  })}
                </dl>
              </Card>
            )}
          </>
        )
      ) : !utilisation ? (
        <div className="surface">
          <EmptyState icon="gauge" title="No utilisation data" description="Try a wider date range." />
        </div>
      ) : (
        <>
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Fleet utilisation"
              value={formatPercent(utilisation.fleetUtilisationPercent, 1)}
              icon="gauge"
              tone="lime"
              hint={`${formatDate(utilisation.from)} → ${formatDate(utilisation.to)}`}
            />
            <StatTile
              label="Rented days"
              value={Number(utilisation.fleetRentedDays || 0).toLocaleString('en-IN')}
              icon="key"
              hint="Days a car was out with a customer"
            />
            <StatTile
              label="Available days"
              value={Number(utilisation.fleetAvailableDays || 0).toLocaleString('en-IN')}
              icon="calendar"
              hint="Denominator: days the fleet could have been rented"
            />
            <StatTile
              label="Window"
              value={`${utilisation.periodDays ?? 0} days`}
              icon="clock"
              hint={`${utilisationRows.length} vehicles reported`}
            />
          </section>

          <DataTable
            rows={pagedUtilisation}
            emptyTitle="No vehicles reported"
            emptyDescription="Vehicles appear once they have availability in the window."
            columns={[
              {
                key: 'vehicleName',
                header: 'Vehicle',
                render: (row) => (
                  <div>
                    <p className="text-[13.5px] text-white">{row.vehicleName}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-mist-500">{row.licensePlate}</p>
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
                key: 'bookingCount',
                header: 'Trips',
                align: 'right',
                render: (row) => row.bookingCount ?? 0,
              },
              {
                key: 'days',
                header: 'Rented / available',
                align: 'right',
                render: (row) => (
                  <span className="font-mono text-[12px] text-mist-300">
                    {row.rentedDays} / {row.availableDays}
                  </span>
                ),
              },
              {
                key: 'utilisationPercent',
                header: 'Utilisation',
                render: (row) => (
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full bg-lime/70"
                        style={{ width: `${Math.min(100, Number(row.utilisationPercent || 0))}%` }}
                      />
                    </span>
                    <span className="font-mono text-[11.5px] text-mist-300">
                      {formatPercent(row.utilisationPercent, 1)}
                    </span>
                  </span>
                ),
              },
              {
                key: 'revenue',
                header: 'Revenue',
                align: 'right',
                render: (row) => formatCurrency(row.revenue),
              },
              {
                key: 'status',
                header: 'State',
                render: (row) => <StatusBadge status={row.status} kind="vehicle" />,
              },
            ]}
          />

          {utilisationRows.length > 10 && (
            <Pagination
              page={utilPage}
              totalPages={Math.ceil(utilisationRows.length / 10)}
              totalElements={utilisationRows.length}
              onChange={setUtilPage}
            />
          )}

          <Card className="p-6">
            <h3 className="font-display text-[16px] font-semibold text-white">How this is measured</h3>
            <dl className="mt-5 space-y-3">
              <DetailRow
                label="Utilisation"
                value="rented days ÷ available rental days"
                strong
              />
              <DetailRow
                label="Available rental days"
                value="days the vehicle was not retired, in the workshop or already rented"
              />
              <DetailRow label="Rented days" value="days a booking covered the vehicle inside the window" />
            </dl>
            <p className="mt-4 text-[12.5px] leading-relaxed text-mist-500">
              A low figure means cars sitting idle — the fleet table above shows exactly which ones. A
              figure close to 100% suggests it is time to buy another vehicle in that category.
            </p>
          </Card>
        </>
      )}

      <p className="text-[12px] leading-relaxed text-mist-500">
        <Icon name="info" size={13} className="mr-1 inline align-[-2px] text-ice" />
        Revenue excludes refunds; net revenue subtracts them. Deposits are reported separately because
        they are refundable rather than earned.
      </p>
    </div>
  );
}
