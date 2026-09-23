import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  Textarea,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { completeMaintenance, listMaintenance, scheduleMaintenance } from '../../api/bookings.js';
import { listFleetInventory } from '../../api/vehicles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { todayIso } from '../../utils/datetime.js';
import { MAINTENANCE_TYPES } from '../../utils/constants.js';

const STATUS_TONES = {
  SCHEDULED: 'border-signal-info/35 bg-signal-info/10 text-signal-info',
  IN_PROGRESS: 'border-signal-warning/35 bg-signal-warning/10 text-signal-warning',
  COMPLETED: 'border-signal-success/35 bg-signal-success/10 text-signal-success',
  CANCELLED: 'border-white/12 bg-white/[0.05] text-mist-400',
};

export default function FleetMaintenance() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    vehicleId: '',
    type: 'SERVICE',
    description: '',
    scheduledDate: todayIso(),
    cost: '',
    odometerReading: '',
    garage: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm, setCompleteForm] = useState({
    completedDate: todayIso(),
    cost: '',
    odometerReading: '',
    notes: '',
    releaseVehicle: true,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listMaintenance({ page, size: 12 }),
      listFleetInventory({ size: 50, sort: 'make,asc' }),
    ])
      .then(([records, fleet]) => {
        setResult(records);
        setVehicles(fleet?.content || []);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(load, [load]);

  const submitSchedule = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      await scheduleMaintenance(Number(scheduleForm.vehicleId), {
        type: scheduleForm.type,
        description: scheduleForm.description.trim(),
        scheduledDate: scheduleForm.scheduledDate,
        cost: scheduleForm.cost === '' ? undefined : Number(scheduleForm.cost),
        odometerReading:
          scheduleForm.odometerReading === '' ? undefined : Number(scheduleForm.odometerReading),
        garage: scheduleForm.garage.trim() || undefined,
      });
      toast.success('Maintenance scheduled', 'The vehicle is reserved for the workshop on that date.');
      setScheduleOpen(false);
      setScheduleForm({
        vehicleId: '',
        type: 'SERVICE',
        description: '',
        scheduledDate: todayIso(),
        cost: '',
        odometerReading: '',
        garage: '',
      });
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setFieldErrors(apiError.fieldErrors || {});
      toast.error('Could not schedule maintenance', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitComplete = async (event) => {
    event.preventDefault();
    if (!completeTarget) return;

    setSaving(true);
    try {
      await completeMaintenance(completeTarget.id, {
        completedDate: completeForm.completedDate,
        cost: completeForm.cost === '' ? undefined : Number(completeForm.cost),
        odometerReading:
          completeForm.odometerReading === '' ? undefined : Number(completeForm.odometerReading),
        notes: completeForm.notes.trim() || undefined,
        releaseVehicle: completeForm.releaseVehicle,
      });
      toast.success(
        'Maintenance completed',
        completeForm.releaseVehicle
          ? 'The vehicle is back in the bookable pool.'
          : 'Recorded. The vehicle stays out of service.',
      );
      setCompleteTarget(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not complete the record', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const records = result?.content || [];
  const openCount = records.filter((record) => record.status !== 'COMPLETED' && record.status !== 'CANCELLED').length;
  const spend = records.reduce((sum, record) => sum + Number(record.cost || 0), 0);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Workshop</p>
          <h1 className="display-md mt-3">Maintenance</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Scheduling a service takes the car out of the booking pool until it is released again -
            no double-booking a car that is on the ramp.
          </p>
        </div>
        <Button icon="plus" onClick={() => setScheduleOpen(true)}>
          Schedule maintenance
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile label="Records" value={result?.totalElements || 0} icon="file" />
        <StatTile label="Open jobs" value={openCount} icon="wrench" tone={openCount ? 'info' : 'default'} />
        <StatTile label="Recorded cost" value={formatCurrency(spend)} icon="card" hint="On this page" />
      </section>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="wrench"
            title="No maintenance records"
            description="Schedule a service, inspection or repair to start building a vehicle's service history."
            action={
              <Button icon="plus" onClick={() => setScheduleOpen(true)}>
                Schedule maintenance
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {records.map((record) => (
              <li key={record.id} className="surface flex flex-wrap items-center gap-5 p-5">
                <span
                  className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${STATUS_TONES[record.status]}`}
                >
                  <Icon name="wrench" size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-[15px] font-semibold text-white">
                      {record.vehicleName}
                    </p>
                    <span className={`badge ${STATUS_TONES[record.status]}`}>
                      {record.status?.replace('_', ' ')}
                    </span>
                    <span className="badge badge-neutral">{record.type?.replace('_', ' ')}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[13px] text-mist-300">{record.description}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mist-500">
                    <span className="font-mono">{record.licensePlate}</span>
                    <span>Scheduled {formatDate(record.scheduledDate)}</span>
                    {record.completedDate && <span>Completed {formatDate(record.completedDate)}</span>}
                    {record.garage && <span>{record.garage}</span>}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[13.5px] text-mist-100">
                    {record.cost ? formatCurrency(record.cost) : 'Cost TBD'}
                  </p>
                  {record.odometerReading != null && (
                    <p className="mt-0.5 text-[11.5px] text-mist-500">
                      {record.odometerReading.toLocaleString('en-IN')} km
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {record.status !== 'COMPLETED' && record.status !== 'CANCELLED' && (
                    <Button
                      size="sm"
                      icon="check"
                      onClick={() => {
                        setCompleteTarget(record);
                        setCompleteForm({
                          completedDate: todayIso(),
                          cost: record.cost ?? '',
                          odometerReading: record.odometerReading ?? '',
                          notes: '',
                          releaseVehicle: true,
                        });
                      }}
                    >
                      Complete
                    </Button>
                  )}
                  <Link
                    to={`/console/vehicles/${record.vehicleId}/history`}
                    className="icon-btn h-9 w-9"
                    aria-label={`History for ${record.vehicleName}`}
                  >
                    <Icon name="clock" size={16} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      {/* Schedule */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        size="lg"
        title="Schedule maintenance"
        description="Future dates create a scheduled job; today or earlier starts it immediately."
      >
        <form onSubmit={submitSchedule} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle" htmlFor="m-vehicle" required error={fieldErrors.vehicleId}>
              <select
                id="m-vehicle"
                className="input"
                value={scheduleForm.vehicleId}
                onChange={(event) =>
                  setScheduleForm((current) => ({ ...current, vehicleId: event.target.value }))
                }
              >
                <option value="">Choose a vehicle…</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.displayName} · {vehicle.licensePlate} ({vehicle.status})
                  </option>
                ))}
              </select>
            </Field>
            <Select
              label="Type"
              value={scheduleForm.type}
              onChange={(event) => setScheduleForm((current) => ({ ...current, type: event.target.value }))}
              options={MAINTENANCE_TYPES.map((value) => ({
                value,
                label: value.charAt(0) + value.slice(1).toLowerCase(),
              }))}
            />
          </div>

          <Field label="What needs doing" htmlFor="m-description" required error={fieldErrors.description}>
            <textarea
              id="m-description"
              className="input"
              rows={3}
              maxLength={500}
              value={scheduleForm.description}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="60,000 km service: oil, filters, brake fluid, alignment."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Scheduled date"
              type="date"
              required
              value={scheduleForm.scheduledDate}
              error={fieldErrors.scheduledDate}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, scheduledDate: event.target.value }))
              }
            />
            <Input
              label="Estimated cost (₹)"
              type="number"
              min="0"
              step="100"
              value={scheduleForm.cost}
              onChange={(event) => setScheduleForm((current) => ({ ...current, cost: event.target.value }))}
            />
            <Input
              label="Odometer (km)"
              type="number"
              min="0"
              value={scheduleForm.odometerReading}
              onChange={(event) =>
                setScheduleForm((current) => ({ ...current, odometerReading: event.target.value }))
              }
            />
          </div>

          <Input
            label="Garage"
            value={scheduleForm.garage}
            onChange={(event) => setScheduleForm((current) => ({ ...current, garage: event.target.value }))}
            placeholder="Maruti Authorised Service - Kadri"
          />

          <p className="text-[12px] leading-relaxed text-mist-500">
            A vehicle on rent cannot be scheduled. Existing confirmed bookings in the window are
            flagged to the fleet team rather than cancelled.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!scheduleForm.vehicleId}>
              Schedule
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete */}
      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        size="lg"
        title="Complete maintenance"
        description={completeTarget ? `${completeTarget.vehicleName} · ${completeTarget.type}` : ''}
      >
        <form onSubmit={submitComplete} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Completed on"
              type="date"
              value={completeForm.completedDate}
              onChange={(event) =>
                setCompleteForm((current) => ({ ...current, completedDate: event.target.value }))
              }
            />
            <Input
              label="Final cost (₹)"
              type="number"
              min="0"
              step="100"
              value={completeForm.cost}
              onChange={(event) => setCompleteForm((current) => ({ ...current, cost: event.target.value }))}
            />
            <Input
              label="Odometer (km)"
              type="number"
              min="0"
              value={completeForm.odometerReading}
              onChange={(event) =>
                setCompleteForm((current) => ({ ...current, odometerReading: event.target.value }))
              }
            />
          </div>

          <Textarea
            label="Workshop notes"
            value={completeForm.notes}
            onChange={(event) => setCompleteForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Parts replaced, anything deferred to the next service."
          />

          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={completeForm.releaseVehicle}
              onChange={(event) =>
                setCompleteForm((current) => ({ ...current, releaseVehicle: event.target.checked }))
              }
            />
            <span>
              <span className="block text-[13.5px] text-mist-100">Return the car to the fleet</span>
              <span className="mt-0.5 block text-[12.5px] text-mist-400">
                Leave this off if further work is needed - the vehicle stays in maintenance.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setCompleteTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Mark complete
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
