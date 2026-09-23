import { useEffect, useState } from 'react';
import Icon from '../ui/Icon.jsx';
import { Button, Input, Select } from '../ui/primitives.jsx';
import { useDebouncedValue } from '../../hooks/index.js';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  FUEL_TYPES,
  TRANSMISSION_LABELS,
  TRANSMISSIONS,
  VEHICLE_CATEGORIES,
} from '../../utils/constants.js';
import { todayIso } from '../../utils/datetime.js';

const SORTS = [
  { value: 'dailyRate,asc', label: 'Price: low to high' },
  { value: 'dailyRate,desc', label: 'Price: high to low' },
  { value: 'year,desc', label: 'Newest first' },
  { value: 'averageRating,desc', label: 'Highest rated' },
  { value: 'make,asc', label: 'Make A–Z' },
];

/**
 * Catalogue filter rail.
 *
 * Text input is debounced before it reaches the query so typing stays smooth;
 * every other control applies immediately. Date inputs are clamped to today so
 * the API never has to reject a past pickup date.
 */
export default function VehicleFilters({
  draft,
  onApply,
  locations = [],
  onReset,
  resultCount,
  loading = false,
}) {
  const [local, setLocal] = useState(draft);
  const [open, setOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(local.search, 400);

  // Keep the panel in sync when the URL (or a reset) changes the draft.
  useEffect(() => {
    setLocal(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.pickupDate, draft.returnDate, draft.category, draft.pickupLocation]);

  useEffect(() => {
    if (debouncedSearch === draft.search) return;
    onApply({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const update = (patch) => {
    setLocal((current) => ({ ...current, ...patch }));
    onApply(patch);
  };

  const today = todayIso();

  return (
    <div className="surface p-5 lg:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Icon name="filter" size={17} className="text-lime" />
          <h2 className="font-display text-[15px] font-semibold text-white">Refine</h2>
        </div>
        <button
          type="button"
          className="text-[12.5px] text-mist-400 transition hover:text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Show'}
        </button>
      </div>

      <div className={`${open ? 'grid' : 'hidden'} mt-5 gap-4 lg:grid`}>
        <Input
          label="Search"
          placeholder="Toyota, SUV, automatic…"
          value={local.search || ''}
          prefixIcon="search"
          onChange={(event) => setLocal((current) => ({ ...current, search: event.target.value }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Pickup"
            type="date"
            min={today}
            value={local.pickupDate || ''}
            onChange={(event) => update({ pickupDate: event.target.value })}
          />
          <Input
            label="Return"
            type="date"
            min={local.pickupDate || today}
            value={local.returnDate || ''}
            onChange={(event) => update({ returnDate: event.target.value })}
          />
        </div>

        <Select
          label="Pick-up location"
          placeholder="Any location"
          value={local.pickupLocation || ''}
          onChange={(event) => update({ pickupLocation: event.target.value })}
          options={locations.map((location) => ({ value: location, label: location }))}
        />

        <Select
          label="Category"
          placeholder="Any category"
          value={local.category || ''}
          onChange={(event) => update({ category: event.target.value })}
          options={VEHICLE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Fuel"
            placeholder="Any"
            value={local.fuelType || ''}
            onChange={(event) => update({ fuelType: event.target.value })}
            options={FUEL_TYPES.map((value) => ({ value, label: FUEL_LABELS[value] }))}
          />
          <Select
            label="Gearbox"
            placeholder="Any"
            value={local.transmission || ''}
            onChange={(event) => update({ transmission: event.target.value })}
            options={TRANSMISSIONS.map((value) => ({ value, label: TRANSMISSION_LABELS[value] }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Min ₹/day"
            type="number"
            min="0"
            step="100"
            placeholder="0"
            value={local.minPrice ?? ''}
            onChange={(event) => update({ minPrice: event.target.value })}
          />
          <Input
            label="Max ₹/day"
            type="number"
            min="0"
            step="100"
            placeholder="Any"
            value={local.maxPrice ?? ''}
            onChange={(event) => update({ maxPrice: event.target.value })}
          />
        </div>

        <Select
          label="Minimum seats"
          placeholder="Any"
          value={local.minSeats || ''}
          onChange={(event) => update({ minSeats: event.target.value })}
          options={[2, 4, 5, 7].map((value) => ({ value: String(value), label: `${value}+ seats` }))}
        />

        <Select
          label="Sort by"
          value={local.sort || 'dailyRate,asc'}
          onChange={(event) => update({ sort: event.target.value })}
          options={SORTS}
        />

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[12.5px] text-mist-400">
            {loading ? 'Searching…' : `${resultCount ?? 0} vehicles match`}
          </p>
          <Button variant="quiet" size="sm" icon="refresh" onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
