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
import { listDamageRecords, updateDamageStatus } from '../../api/bookings.js';
import { severityTone } from '../../utils/damage.js';
import { listFleetInventory, reportDamage } from '../../api/vehicles.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import { DAMAGE_SEVERITIES, DAMAGE_STATUS } from '../../utils/constants.js';

export default function FleetDamage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    vehicleId: '',
    description: '',
    severity: 'MINOR',
    locationOnVehicle: '',
    bookingId: '',
    repairEstimate: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [updateTarget, setUpdateTarget] = useState(null);
  const [updateForm, setUpdateForm] = useState({ status: 'UNDER_REPAIR', actualRepairCost: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([listDamageRecords({ page, size: 12 }), listFleetInventory({ size: 50 })])
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

  const submitReport = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});
    try {
      await reportDamage(Number(reportForm.vehicleId), {
        description: reportForm.description.trim(),
        severity: reportForm.severity,
        locationOnVehicle: reportForm.locationOnVehicle.trim() || undefined,
        bookingId: reportForm.bookingId === '' ? undefined : Number(reportForm.bookingId),
        repairEstimate: reportForm.repairEstimate === '' ? undefined : Number(reportForm.repairEstimate),
      });
      toast.success(
        'Damage logged',
        reportForm.severity === 'CRITICAL'
          ? 'The vehicle has been moved into maintenance automatically.'
          : 'The record is on the vehicle history now.',
      );
      setReportOpen(false);
      setReportForm({
        vehicleId: '',
        description: '',
        severity: 'MINOR',
        locationOnVehicle: '',
        bookingId: '',
        repairEstimate: '',
      });
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setFieldErrors(apiError.fieldErrors || {});
      toast.error('Could not log the damage', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async (event) => {
    event.preventDefault();
    if (!updateTarget) return;
    setSaving(true);
    try {
      await updateDamageStatus(updateTarget.id, {
        status: updateForm.status,
        actualRepairCost:
          updateForm.actualRepairCost === '' ? undefined : Number(updateForm.actualRepairCost),
      });
      toast.success('Damage record updated', `${updateTarget.vehicleName} → ${updateForm.status}`);
      setUpdateTarget(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not update the record', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const records = result?.content || [];
  const open = records.filter((record) => record.status === 'REPORTED' || record.status === 'UNDER_REPAIR');
  const estimated = records.reduce(
    (sum, record) => sum + Number(record.repairEstimate || 0),
    0,
  );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Condition log</p>
          <h1 className="display-md mt-3">Damage records</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Every scratch, dent and repair with the estimate, the booking it came from and who
            reported it. Critical damage takes the car off the road immediately.
          </p>
        </div>
        <Button icon="plus" onClick={() => setReportOpen(true)}>
          Log damage
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile label="Records" value={result?.totalElements || 0} icon="file" />
        <StatTile
          label="Open cases"
          value={open.length}
          icon="alert"
          tone={open.length ? 'danger' : 'default'}
        />
        <StatTile label="Estimated repair" value={formatCurrency(estimated)} icon="card" hint="On this page" />
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
            icon="shield"
            title="No damage on record"
            description="Report anything found during a return inspection so the deposit decision is documented."
            action={
              <Button icon="plus" onClick={() => setReportOpen(true)}>
                Log damage
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {records.map((record) => {
              const tone = severityTone(record.severity);
              return (
                <li key={record.id} className="surface flex flex-wrap items-center gap-5 p-5">
                  <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}>
                    <Icon name="alert" size={19} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-display text-[15px] font-semibold text-white">
                        {record.vehicleName}
                      </p>
                      <span className={`badge ${tone}`}>{record.severity}</span>
                      <span className="badge badge-neutral">{record.status?.replace('_', ' ')}</span>
                    </div>
                    <p className="mt-2 text-[13px] text-mist-300">{record.description}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-mist-500">
                      <span className="font-mono">{record.licensePlate}</span>
                      {record.locationOnVehicle && <span>{record.locationOnVehicle}</span>}
                      {record.bookingReference && <span>Booking {record.bookingReference}</span>}
                      <span>Logged {formatDate(record.createdAt)}</span>
                      {record.resolvedAt && <span>Resolved {formatDate(record.resolvedAt)}</span>}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-[13.5px] text-mist-100">
                      {formatCurrency(record.actualRepairCost || record.repairEstimate || 0)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-mist-500">
                      {record.actualRepairCost ? 'actual cost' : 'estimate'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="edit"
                      onClick={() => {
                        setUpdateTarget(record);
                        setUpdateForm({
                          status: record.status === 'REPORTED' ? 'UNDER_REPAIR' : record.status,
                          actualRepairCost: record.actualRepairCost ?? '',
                        });
                      }}
                    >
                      Update
                    </Button>
                    <Link
                      to={`/console/vehicles/${record.vehicleId}/history`}
                      className="icon-btn h-9 w-9"
                      aria-label={`History for ${record.vehicleName}`}
                    >
                      <Icon name="clock" size={16} />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      {/* Report */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        size="lg"
        title="Log vehicle damage"
        description="A critical finding on an available car moves it into maintenance automatically."
      >
        <form onSubmit={submitReport} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Vehicle" htmlFor="d-vehicle" required error={fieldErrors.vehicleId}>
              <select
                id="d-vehicle"
                className="input"
                value={reportForm.vehicleId}
                onChange={(event) =>
                  setReportForm((current) => ({ ...current, vehicleId: event.target.value }))
                }
              >
                <option value="">Choose a vehicle…</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.displayName} · {vehicle.licensePlate}
                  </option>
                ))}
              </select>
            </Field>
            <Select
              label="Severity"
              value={reportForm.severity}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, severity: event.target.value }))
              }
              options={DAMAGE_SEVERITIES.map((value) => ({
                value,
                label: value.charAt(0) + value.slice(1).toLowerCase(),
              }))}
            />
          </div>

          <Textarea
            label="What happened"
            required
            maxLength={1000}
            value={reportForm.description}
            error={fieldErrors.description}
            onChange={(event) =>
              setReportForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Rear bumper scuff noticed during the return inspection, left corner."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Location on vehicle"
              value={reportForm.locationOnVehicle}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, locationOnVehicle: event.target.value }))
              }
              placeholder="Rear bumper, left"
            />
            <Input
              label="Booking ID"
              type="number"
              min="1"
              value={reportForm.bookingId}
              error={fieldErrors.bookingId}
              hint="Optional - must belong to this vehicle."
              onChange={(event) =>
                setReportForm((current) => ({ ...current, bookingId: event.target.value }))
              }
            />
            <Input
              label="Repair estimate (₹)"
              type="number"
              min="0"
              step="100"
              value={reportForm.repairEstimate}
              onChange={(event) =>
                setReportForm((current) => ({ ...current, repairEstimate: event.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!reportForm.vehicleId}>
              Log damage
            </Button>
          </div>
        </form>
      </Modal>

      {/* Update */}
      <Modal
        open={Boolean(updateTarget)}
        onClose={() => setUpdateTarget(null)}
        size="sm"
        title="Update damage record"
        description={updateTarget ? `${updateTarget.vehicleName} · ${updateTarget.severity}` : ''}
      >
        <form onSubmit={submitUpdate} className="space-y-5">
          <Select
            label="Status"
            value={updateForm.status}
            onChange={(event) => setUpdateForm((current) => ({ ...current, status: event.target.value }))}
            options={DAMAGE_STATUS.map((value) => ({
              value,
              label: value.replace('_', ' ').toLowerCase(),
            }))}
          />
          <Input
            label="Actual repair cost (₹)"
            type="number"
            min="0"
            step="100"
            value={updateForm.actualRepairCost}
            onChange={(event) =>
              setUpdateForm((current) => ({ ...current, actualRepairCost: event.target.value }))
            }
            hint="Recorded when the work is finished."
          />
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setUpdateTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
