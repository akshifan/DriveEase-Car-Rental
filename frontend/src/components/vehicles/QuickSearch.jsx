import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Button } from '../ui/primitives.jsx';
import { getLocations } from '../../api/vehicles.js';
import { useBookingDraft } from '../../context/BookingContext.jsx';
import { todayIso } from '../../utils/datetime.js';

/**
 * Hero search bar.
 *
 * Three inputs, one action: the dates and location are written into the shared
 * booking draft (which the fleet page reads) and the user is taken to results.
 */
export default function QuickSearch({ className = '', tone = 'dark' }) {
  const { draft, updateDraft } = useBookingDraft();
  const [locations, setLocations] = useState([]);
  const [pickup, setPickup] = useState(draft.pickupDate);
  const [dropoff, setDropoff] = useState(draft.returnDate);
  const [location, setLocation] = useState(draft.pickupLocation || '');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    getLocations()
      .then((list) => {
        if (!cancelled) setLocations(Array.isArray(list) ? list : []);
      })
      .catch(() => setLocations([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (event) => {
    event.preventDefault();
    if (!pickup || !dropoff) {
      setError('Choose both a pick-up and a return date.');
      return;
    }
    if (dropoff <= pickup) {
      setError('The return date has to be after the pick-up date.');
      return;
    }
    setError('');
    updateDraft({
      pickupDate: pickup,
      returnDate: dropoff,
      pickupLocation: location,
      dropoffLocation: location,
    });
    navigate(`/fleet?pickupDate=${pickup}&returnDate=${dropoff}${location ? `&location=${encodeURIComponent(location)}` : ''}`);
  };

  return (
    <form
      onSubmit={submit}
      className={`rounded-2xl border p-3 backdrop-blur-xl sm:p-3.5 ${
        tone === 'dark'
          ? 'border-white/[0.09] bg-ink-900/80'
          : 'border-ink-800/10 bg-white/90'
      } ${className}`}
      aria-label="Check availability"
    >
      <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <label className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/60 px-3.5 py-2.5">
          <Icon name="mapPin" size={17} className="shrink-0 text-lime" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500">
              Pick-up
            </span>
            <select
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className="w-full cursor-pointer appearance-none border-0 bg-transparent p-0 text-[13.5px] text-white focus:outline-none"
              aria-label="Pick-up location"
            >
              <option value="">All locations</option>
              {locations.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/60 px-3.5 py-2.5">
          <Icon name="calendar" size={17} className="shrink-0 text-lime" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500">
              From
            </span>
            <input
              type="date"
              value={pickup}
              min={today}
              onChange={(event) => {
                setPickup(event.target.value);
                if (dropoff <= event.target.value) {
                  const next = new Date(event.target.value);
                  next.setDate(next.getDate() + 1);
                  setDropoff(next.toISOString().slice(0, 10));
                }
              }}
              className="w-full border-0 bg-transparent p-0 text-[13.5px] text-white focus:outline-none"
            />
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-ink-950/60 px-3.5 py-2.5">
          <Icon name="calendar" size={17} className="shrink-0 text-lime" />
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-mist-500">
              Until
            </span>
            <input
              type="date"
              value={dropoff}
              min={pickup || today}
              onChange={(event) => setDropoff(event.target.value)}
              className="w-full border-0 bg-transparent p-0 text-[13.5px] text-white focus:outline-none"
            />
          </span>
        </label>

        <Button type="submit" size="lg" iconRight="arrowRight" className="w-full lg:w-auto">
          Check availability
        </Button>
      </div>

      {error && (
        <p className="field-error mt-3" role="alert">
          <Icon name="alert" size={14} /> {error}
        </p>
      )}
    </form>
  );
}
