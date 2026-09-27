import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  StatusBadge,
  Textarea,
} from '../../components/ui/primitives.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import {
  changeVehicleStatus,
  createVehicle,
  exportFleetCsv,
  listFleetInventory,
  retireVehicle,
  updateVehicle,
  uploadVehicleImage,
} from '../../api/vehicles.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency } from '../../utils/format.js';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  FUEL_TYPES,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  VEHICLE_CATEGORIES,
  VEHICLE_STATUS,
  VEHICLE_STATUS_LABELS,
} from '../../utils/constants.js';
import { mediaUrl } from '../../utils/media.js';
import { getVehicle } from '../../api/vehicles.js';

/** Hard cap on images per vehicle (mirrors the backend @Size(max = 15)). */
const MAX_GALLERY = 15;

const EMPTY_FORM = {
  make: '',
  model: '',
  year: new Date().getFullYear(),
  category: 'COMPACT',
  licensePlate: '',
  vin: '',
  dailyRate: '',
  depositAmount: '',
  location: '',
  mileage: '',
  seats: 5,
  doors: 4,
  fuelType: 'PETROL',
  transmission: 'AUTOMATIC',
  imageUrl: '',
  galleryUrls: '',
  description: '',
  features: '',
};

/** Normalises a vehicle response into the form shape. */
function toForm(vehicle) {
  const gallery = (vehicle.gallery || []).map((g) => g.url);
  const cover = vehicle.imageUrl || '';
  const galleryWithCover = cover && !gallery.includes(cover) ? [cover, ...gallery] : gallery;
  return {
    make: vehicle.make || '',
    model: vehicle.model || '',
    year: vehicle.year ?? new Date().getFullYear(),
    category: vehicle.category || 'COMPACT',
    licensePlate: vehicle.licensePlate || '',
    vin: vehicle.vin || '',
    dailyRate: vehicle.dailyRate ?? '',
    depositAmount: vehicle.depositAmount ?? '',
    location: vehicle.location || '',
    mileage: vehicle.mileage ?? '',
    seats: vehicle.seats ?? 5,
    doors: vehicle.doors ?? 4,
    fuelType: vehicle.fuelType || 'PETROL',
    transmission: vehicle.transmission || 'AUTOMATIC',
    imageUrl: cover,
    galleryUrls: galleryWithCover.join(', '),
    description: vehicle.description || '',
    features: (vehicle.features || []).join(', '),
  };
}

/** "A, B, C" → ["A","B","C"], dropping blanks. */
function toList(value) {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function FleetVehicles() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const debouncedSearch = useDebouncedValue(search, 400);

  const [editor, setEditor] = useState(null); // { mode: 'create' | 'edit', vehicle? }
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // image upload state
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState([]);

  const [statusTarget, setStatusTarget] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: '', reason: '' });
  const [retireTarget, setRetireTarget] = useState(null);
  const [retireReason, setRetireReason] = useState('');

  /* ------------------------------------------------------------ data load */

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listFleetInventory({
      search: debouncedSearch || undefined,
      location: location || undefined,
      page,
      size: 12,
    })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [debouncedSearch, location, page]);

  useEffect(load, [load]);

  const locations = useMemo(() => {
    const values = new Set((result?.content || []).map((vehicle) => vehicle.location).filter(Boolean));
    return Array.from(values).sort();
  }, [result]);

  /* ---------------------------------------------------- open create / edit */

  const openCreate = () => {
    setEditor({ mode: 'create' });
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setUploadedUrls([]);
  };

  const openEdit = async (vehicle) => {
    setEditor({ mode: 'edit', vehicle });
    setForm(toForm(vehicle));
    setFieldErrors({});
    setUploadedUrls((vehicle.gallery || []).map((g) => g.url));

    try {
      const full = await getVehicle(vehicle.id);
      const form = toForm(full);
      if (!form.imageUrl && form.galleryUrls) {
        const first = toList(form.galleryUrls)[0];
        if (first) form.imageUrl = first;
      }
      setForm(form);
      setUploadedUrls((full.gallery || []).map((g) => g.url));
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not load vehicle images', apiError.message);
    }
  };

  const closeEditor = () => {
    setEditor(null);
    setUploadedUrls([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ---------------------------------------------------------- image upload */

  const onFilePicked = async (event) => {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const room = MAX_GALLERY - uploadedUrls.length;
    if (room <= 0) {
      toast.warn('Image limit reached',
        `A vehicle can have at most ${MAX_GALLERY} images. Remove one to add another.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const files = picked.slice(0, room);
    if (files.length < picked.length) {
      toast.warn('Only some files were added',
        `The vehicle can hold ${MAX_GALLERY} images total. Added ${files.length} of ${picked.length}.`);
    }

    setUploading(true);
    try {
      const uploaded = [];
      for (const file of files) {
        try {
          const result = await uploadVehicleImage(file);
          uploaded.push(result.url);
        } catch (failure) {
          const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
          toast.error(`Couldn't upload ${file.name}`, apiError.message);
        }
      }

      if (uploaded.length) {
        setUploadedUrls((prev) => [...prev, ...uploaded]);
        setForm((prev) => {
          const existing = prev.galleryUrls ? toList(prev.galleryUrls) : [];
          const merged = [...existing, ...uploaded]
            .filter((url, index, arr) => arr.indexOf(url) === index)   // dedupe
            .slice(0, MAX_GALLERY);

          const shouldSetCover = !prev.imageUrl && existing.length === 0;


          return {
            ...prev,
            imageUrl: shouldSetCover ? merged[0] : prev.imageUrl,
            galleryUrls: merged.join(', '),
          };
        });
        toast.success('Images uploaded', `${uploaded.length} file(s) added.`);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeUploadedImage = (url) => {
    setUploadedUrls((prev) => prev.filter((u) => u !== url));
    setForm((prev) => {
      const remaining = toList(prev.galleryUrls).filter((u) => u !== url);
      return {
        ...prev,
        galleryUrls: remaining.join(', '),
        imageUrl: prev.imageUrl === url ? (remaining[0] || '') : prev.imageUrl,
      };
    });
  };

  /* ---------------------------------------------------------------- save */

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const coverUrl = form.imageUrl.trim();
    const galleryList = toList(form.galleryUrls);

    // The backend derives the primary row from the cover and expects it in the list.
    // Prepend it if the user has set one but it isn't already there.
    if (coverUrl && !galleryList.includes(coverUrl)) {
      galleryList.unshift(coverUrl);
    }

    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      category: form.category,
      licensePlate: form.licensePlate.trim().toUpperCase(),
      vin: form.vin.trim() || undefined,
      dailyRate: form.dailyRate === '' ? undefined : Number(form.dailyRate),
      depositAmount: form.depositAmount === '' ? undefined : Number(form.depositAmount),
      location: form.location.trim() || undefined,
      mileage: form.mileage === '' ? undefined : Number(form.mileage),
      seats: Number(form.seats),
      doors: Number(form.doors),
      fuelType: form.fuelType,
      transmission: form.transmission,
      imageUrl: coverUrl || '',          // '' clears the cover; undefined means "leave unchanged"
      galleryUrls: galleryList,          // ALWAYS an array; [] clears the gallery
      description: form.description.trim() || undefined,
      features: toList(form.features).length ? toList(form.features) : undefined,
    };

    try {
      if (editor.mode === 'create') {
        await createVehicle(payload);
        toast.success('Vehicle added', `${payload.make} ${payload.model} is now in the fleet.`);
      } else {
        await updateVehicle(editor.vehicle.id, payload);
        toast.success('Vehicle updated', 'The changes are live in the catalogue.');
      }
      closeEditor();
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setFieldErrors(apiError.fieldErrors || {});
      toast.error(
        apiError.code === 'LICENSE_PLATE_EXISTS' ? 'Registration already in use' : 'Could not save',
        apiError.message,
      );
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------- status change */

  const saveStatus = async (event) => {
    event.preventDefault();
    if (!statusTarget) return;
    setSaving(true);
    try {
      await changeVehicleStatus(statusTarget.id, {
        status: statusForm.status,
        reason: statusForm.reason || undefined,
      });
      toast.success('Status updated', `${statusTarget.displayName} is now ${statusForm.status.toLowerCase()}.`);
      setStatusTarget(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not change the status', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmRetire = async () => {
    if (!retireTarget) return;
    if (retireReason.trim().length < 5) {
      toast.warn('Add a reason', 'A retirement reason is required and stored on the vehicle record.');
      return;
    }
    setSaving(true);
    try {
      await retireVehicle(retireTarget.id, retireReason.trim());
      toast.success('Vehicle retired', `${retireTarget.displayName} is out of the bookable fleet.`);
      setRetireTarget(null);
      setRetireReason('');
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not retire the vehicle', apiError.message);
    } finally {
      setSaving(false);
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

  /* -------------------------------------------------------------- render */

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Inventory</p>
          <h1 className="display-md mt-3">Fleet vehicles</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Add cars, adjust pricing, move a vehicle into the workshop or retire it from service.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            icon="download"
            onClick={downloadCsv}
            className="flex-1 sm:flex-none"
          >
            Export CSV
          </Button>
          <Button icon="plus" onClick={openCreate} className="flex-1 sm:flex-none">
            Add vehicle
          </Button>
        </div>
      </header>

      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        <Input
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
          label="Location"
          placeholder="All locations"
          value={location}
          onChange={(event) => {
            setLocation(event.target.value);
            setPage(0);
          }}
          options={locations.map((entry) => ({ value: entry, label: entry }))}
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
      ) : !result?.content?.length ? (
        <div className="surface">
          <EmptyState
            icon="car"
            title="No vehicles match"
            description="Adjust the filters or add a new vehicle to the fleet."
            action={
              <Button icon="plus" onClick={openCreate}>
                Add vehicle
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {result.content.map((vehicle) => (
              <li key={vehicle.id} className="surface flex flex-wrap items-center gap-5 p-5">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/[0.07] bg-ink-850">
                  {vehicle.imageUrl ? (
                    <img
                      src={mediaUrl(vehicle.imageUrl)}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-mist-600">
                      <Icon name="car" size={22} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-[15.5px] font-semibold text-white">
                      {vehicle.displayName}
                    </p>
                    <StatusBadge status={vehicle.status} kind="vehicle" />
                    <span className="badge badge-neutral">{CATEGORY_LABELS[vehicle.category]}</span>
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11.5px] text-mist-500">
                    <span>{vehicle.licensePlate}</span>
                    <span>{FUEL_LABELS[vehicle.fuelType]}</span>
                    <span>{TRANSMISSION_LABELS[vehicle.transmission]}</span>
                    <span>{Number(vehicle.mileage || 0).toLocaleString('en-IN')} km</span>
                    <span>{vehicle.location}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[14px] text-mist-100">{formatCurrency(vehicle.dailyRate)}</p>
                  <p className="mt-0.5 text-[11.5px] text-mist-500">
                    deposit {formatCurrency(vehicle.depositAmount)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" icon="edit" onClick={() => openEdit(vehicle)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="quiet"
                    icon="gauge"
                    onClick={() => {
                      setStatusTarget(vehicle);
                      setStatusForm({ status: vehicle.status, reason: '' });
                    }}
                  >
                    Status
                  </Button>
                  <Link
                    to={`/console/vehicles/${vehicle.id}/history`}
                    className="icon-btn h-9 w-9"
                    aria-label={`History for ${vehicle.displayName}`}
                  >
                    <Icon name="clock" size={16} />
                  </Link>
                  {vehicle.status !== VEHICLE_STATUS.RETIRED && (
                    <Button size="sm" variant="danger" icon="trash" onClick={() => setRetireTarget(vehicle)}>
                      Retire
                    </Button>
                  )}
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

      {/* Create / edit */}
      <Modal
        open={Boolean(editor)}
        onClose={closeEditor}
        size="xl"
        title={editor?.mode === 'create' ? 'Add a vehicle' : `Edit ${editor?.vehicle?.displayName || ''}`}
        description="Pricing is validated server-side; images are uploaded straight from your computer."
        footer={
          <>
            <Button variant="quiet" onClick={closeEditor} type="button">
              Cancel
            </Button>
            <Button type="submit" form="fleet-vehicle-editor-form" loading={saving}>
              {editor?.mode === 'create' ? 'Add to fleet' : 'Save changes'}
            </Button>
          </>
        }
      >
        <form id="fleet-vehicle-editor-form" onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Make"
              required
              value={form.make}
              error={fieldErrors.make}
              onChange={(event) => setForm((current) => ({ ...current, make: event.target.value }))}
            />
            <Input
              label="Model"
              required
              value={form.model}
              error={fieldErrors.model}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
            />
            <Input
              label="Year"
              type="number"
              required
              min="1950"
              max="2100"
              value={form.year}
              error={fieldErrors.year}
              onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Select
              label="Category"
              required
              value={form.category}
              error={fieldErrors.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              options={VEHICLE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
            />
            <Input
              label="Registration"
              required
              placeholder="KA-19-AB-1234"
              value={form.licensePlate}
              error={fieldErrors.licensePlate}
              onChange={(event) => setForm((current) => ({ ...current, licensePlate: event.target.value }))}
            />
            <Input
              label="VIN"
              value={form.vin}
              error={fieldErrors.vin}
              onChange={(event) => setForm((current) => ({ ...current, vin: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Daily rate (₹)"
              type="number"
              required
              min="0"
              step="50"
              value={form.dailyRate}
              error={fieldErrors.dailyRate}
              onChange={(event) => setForm((current) => ({ ...current, dailyRate: event.target.value }))}
            />
            <Input
              label="Deposit (₹)"
              type="number"
              min="0"
              step="500"
              value={form.depositAmount}
              error={fieldErrors.depositAmount}
              onChange={(event) => setForm((current) => ({ ...current, depositAmount: event.target.value }))}
            />
            <Input
              label="Odometer (km)"
              type="number"
              min="0"
              value={form.mileage}
              error={fieldErrors.mileage}
              onChange={(event) => setForm((current) => ({ ...current, mileage: event.target.value }))}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <Select
              label="Fuel"
              required
              value={form.fuelType}
              onChange={(event) => setForm((current) => ({ ...current, fuelType: event.target.value }))}
              options={FUEL_TYPES.map((value) => ({ value, label: FUEL_LABELS[value] }))}
            />
            <Select
              label="Transmission"
              required
              value={form.transmission}
              onChange={(event) => setForm((current) => ({ ...current, transmission: event.target.value }))}
              options={TRANSMISSIONS.map((value) => ({ value, label: TRANSMISSION_LABELS[value] }))}
            />
            <Input
              label="Seats"
              type="number"
              min="1"
              max="20"
              required
              value={form.seats}
              error={fieldErrors.seats}
              onChange={(event) => setForm((current) => ({ ...current, seats: event.target.value }))}
            />
            <Input
              label="Doors"
              type="number"
              min="1"
              max="9"
              value={form.doors}
              error={fieldErrors.doors}
              onChange={(event) => setForm((current) => ({ ...current, doors: event.target.value }))}
            />
          </div>

          <Input
            label="Location"
            value={form.location}
            error={fieldErrors.location}
            hint="The city where the car is handed over."
            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
          />

          {/* ------------------------------------------- image upload */}
          <Field
            label={`Vehicle images — optional (${uploadedUrls.length}/${MAX_GALLERY})`}
            hint={
              uploadedUrls.length >= MAX_GALLERY
                ? `Limit reached. Remove an image to add another (max ${MAX_GALLERY}).`
                : `JPEG, PNG or WebP · max 5 MB each · at most ${MAX_GALLERY} images. Add as many or as few as you like — you can always add more later.`
            }
          >
            <input
              id="fleet-vehicle-images"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFilePicked}
              disabled={uploading || uploadedUrls.length >= MAX_GALLERY}
              className="input cursor-pointer file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-lime file:px-4 file:py-1.5 file:text-[12.5px] file:font-medium file:text-ink-950 hover:file:bg-lime-soft disabled:cursor-not-allowed disabled:opacity-60"
            />
          </Field>

          {uploading && <p className="meta">Uploading…</p>}

          {uploadedUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {uploadedUrls.map((url) => {
                const isCover = form.imageUrl === url;
                return (
                  <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.07] bg-ink-850">
                    <img src={url} alt="" className="h-full w-full object-cover" />

                    {isCover && (
                      <span className="absolute left-2 top-2 badge border-lime/40 bg-lime/10 text-lime">
          Cover
        </span>
                    )}

                    {!isCover && (
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, imageUrl: url }))}
                        className="absolute bottom-2 left-2 rounded-full bg-ink-950/85 px-2 py-1 text-[10.5px] text-mist-200 opacity-0 transition group-hover:opacity-100 hover:text-lime"
                        aria-label="Set as cover image"
                      >
                        Set as cover
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeUploadedImage(url)}
                      className="absolute right-2 top-2 rounded-full bg-ink-950/80 p-1 text-mist-200 transition hover:text-signal-danger"
                      aria-label="Remove image"
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback: paste a URL directly */}
          <Input
            label="Or paste an image URL"
            value={form.imageUrl}
            hint="Optional. Filled automatically when you upload the first file."
            onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
          />

          <Textarea
            label="Description"
            value={form.description}
            error={fieldErrors.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="How the car drives, who it suits, what makes it worth the rate."
          />

          <Field label="Features" htmlFor="fleet-features" hint="Comma separated, shown as pills on the detail page.">
            <input
              id="fleet-features"
              className="input"
              value={form.features}
              placeholder="Sunroof, Apple CarPlay, 360 Camera"
              onChange={(event) => setForm((current) => ({ ...current, features: event.target.value }))}
            />
          </Field>
        </form>
      </Modal>

      {/* Status change */}
      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        size="sm"
        title="Change vehicle status"
        description={statusTarget?.displayName}
      >
        <form onSubmit={saveStatus} className="space-y-5">
          <Select
            label="New status"
            value={statusForm.status}
            onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}
            options={Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input
            label="Reason (optional)"
            value={statusForm.reason}
            onChange={(event) => setStatusForm((current) => ({ ...current, reason: event.target.value }))}
            placeholder="Off the road for a brake service"
          />
          <p className="text-[12px] leading-relaxed text-mist-500">
            Transitions follow the vehicle state machine. A retired car cannot be brought back, and a
            car that is on rent cannot be moved into maintenance.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setStatusTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Update status
            </Button>
          </div>
        </form>
      </Modal>

      {/* Retire */}
      <ConfirmDialog
        open={Boolean(retireTarget)}
        onClose={() => setRetireTarget(null)}
        onConfirm={confirmRetire}
        title={`Retire ${retireTarget?.displayName || 'this vehicle'}?`}
        description="Retiring removes the car from the bookable fleet permanently. A reason is required and written to the vehicle history."
        confirmLabel="Retire vehicle"
        loading={saving}
      >
        <Field label="Reason" htmlFor="fleet-retire-reason" required>
          <input
            id="fleet-retire-reason"
            className="input"
            value={retireReason}
            onChange={(event) => setRetireReason(event.target.value)}
            placeholder="End of lease, sold, moved to another city…"
          />
        </Field>
      </ConfirmDialog>
    </div>
  );
}
