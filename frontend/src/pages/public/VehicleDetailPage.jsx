import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  ErrorState,
  Field,
  Rating,
  Skeleton,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import VehicleGallery from '../../components/vehicles/VehicleGallery.jsx';
import { getVehicle, getVehicleAvailability } from '../../api/vehicles.js';
import {
  createBooking,
  getReviewSummary,
  listVehicleReviews,
  quoteBooking,
} from '../../api/bookings.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBookingDraft } from '../../context/BookingContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  TRANSMISSION_LABELS,
} from '../../utils/constants.js';
import { addDays, daysBetween, formatCurrency, formatDate, toIsoDate } from '../../utils/format.js';
import { todayIso } from '../../utils/datetime.js';

const REVIEWS_PER_PAGE = 4;

function SpecTile({ icon, label, value }) {
  return (
    <div className="surface-inset flex items-center gap-3.5 p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lime">
        <Icon name={icon} size={17} />
      </span>
      <div className="min-w-0">
        <p className="meta">{label}</p>
        <p className="mt-0.5 truncate text-[14px] text-white">{value}</p>
      </div>
    </div>
  );
}

export default function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { draft, updateDraft } = useBookingDraft();
  const toast = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upcoming, setUpcoming] = useState(null);
  const [summary, setSummary] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [reviewPage, setReviewPage] = useState(0);

  const [dates, setDates] = useState({
    pickupDate: draft.pickupDate,
    returnDate: draft.returnDate,
  });
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [booking, setBooking] = useState(false);

  const today = todayIso();

  const loadVehicle = useCallback(() => {
    setLoading(true);
    setError(null);
    getVehicle(vehicleId, { pickupDate: dates.pickupDate, returnDate: dates.returnDate })
      .then((data) => {
        setVehicle(data);
        setUpcoming(data.upcomingAvailability || []);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
    // Dates are handled by the quote effect; the detail itself is fetched once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId]);

  useEffect(loadVehicle, [loadVehicle]);

  useEffect(() => {
    getReviewSummary(vehicleId)
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [vehicleId]);

  useEffect(() => {
    let cancelled = false;
    listVehicleReviews(vehicleId, { page: reviewPage, size: REVIEWS_PER_PAGE })
      .then((page) => !cancelled && setReviews(page))
      .catch(
        () =>
          !cancelled &&
          setReviews({ content: [], totalPages: 0, totalElements: 0 }),
      );
    return () => {
      cancelled = true;
    };
  }, [vehicleId, reviewPage]);

  /* Live quote, recomputed whenever the dates move. */
  useEffect(() => {
    if (!dates.pickupDate || !dates.returnDate || dates.returnDate <= dates.pickupDate) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    setQuoting(true);
    setQuoteError(null);

    const timer = setTimeout(() => {
      quoteBooking({ vehicleId, ...dates })
        .then((result) => !cancelled && setQuote(result))
        .catch((failure) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(
            failure instanceof ApiError ? failure : new ApiError({ message: failure.message }),
          );
        })
        .finally(() => !cancelled && setQuoting(false));
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vehicleId, dates]);

  const nights = daysBetween(dates.pickupDate, dates.returnDate);

  const refreshWindows = () => {
    getVehicleAvailability(vehicleId)
      .then((page) => setUpcoming(page?.content || []))
      .catch(() => {});
  };

  const bookNow = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/fleet/${vehicleId}` } });
      return;
    }
    if (!quote) return;

    setBooking(true);
    try {
      const created = await createBooking({
        vehicleId: Number(vehicleId),
        pickupDate: dates.pickupDate,
        returnDate: dates.returnDate,
        pickupLocation: vehicle.location,
        returnLocation: vehicle.location,
      });
      updateDraft({ pickupDate: dates.pickupDate, returnDate: dates.returnDate });
      toast.success('Car held for you', 'Complete the payment step to confirm the booking.');
      navigate(`/checkout/${created.id}`);
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      if (apiError.isConflict) {
        toast.error('Those dates were just taken', apiError.message);
        refreshWindows();
      } else {
        toast.error('Could not create the booking', apiError.message);
      }
    } finally {
      setBooking(false);
    }
  };

  const images = useMemo(
    () => (vehicle?.gallery || []).map((image) => ({ url: image.url, altText: image.altText })),
    [vehicle],
  );

  if (loading) {
    return (
      <div className="shell pt-[110px] pb-20">
        <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr]">
          <Skeleton className="aspect-[16/10] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="shell pt-[120px] pb-20">
        <ErrorState error={error} onRetry={loadVehicle} />
        <div className="mt-6 text-center">
          <Button to="/fleet" variant="ghost" icon="arrowLeft">
            Back to the fleet
          </Button>
        </div>
      </div>
    );
  }

  const displayName = vehicle.displayName || `${vehicle.make} ${vehicle.model}`;
  const distribution = summary?.distribution || vehicle.ratingDistribution || {};
  const distributionTotal = summary?.reviewCount || vehicle.reviewCount || 0;

  return (
    <div className="pt-[76px]">
      <div className="shell pt-10 pb-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-mist-500">
          <Link to="/fleet" className="hover:text-mist-200">
            Fleet
          </Link>
          <Icon name="chevronRight" size={13} />
          <Link to={`/fleet?category=${vehicle.category}`} className="hover:text-mist-200">
            {CATEGORY_LABELS[vehicle.category]}
          </Link>
          <Icon name="chevronRight" size={13} />
          <span className="text-mist-300">{displayName}</span>
        </nav>
      </div>

      <div className="shell grid gap-10 pb-16 lg:grid-cols-[1.55fr_1fr] lg:gap-14">
        <div>
          <VehicleGallery images={images} name={displayName} />

          <div className="mt-10 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="display-md">{displayName}</h1>
              <div className="mt-2.5 flex flex-wrap items-center gap-4">
                <Rating value={vehicle.averageRating || 0} count={vehicle.reviewCount} />
                <span className="flex items-center gap-1.5 text-[13px] text-mist-400">
                  <Icon name="mapPin" size={14} /> {vehicle.location}
                </span>
                <StatusBadge status={vehicle.status} kind="vehicle" />
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-[26px] font-semibold leading-none text-white">
                {formatCurrency(vehicle.dailyRate)}
                <span className="ml-1 font-sans text-[13px] font-normal text-mist-400">/day</span>
              </p>
              <p className="mt-1.5 text-[12.5px] text-mist-500">
                {formatCurrency(vehicle.depositAmount)} refundable deposit
              </p>
            </div>
          </div>

          {vehicle.description && <p className="lede mt-6 max-w-3xl">{vehicle.description}</p>}

          <div className="mt-9 grid gap-3.5 sm:grid-cols-2">
            <SpecTile icon="car" label="Category" value={CATEGORY_LABELS[vehicle.category]} />
            <SpecTile
              icon={vehicle.fuelType === 'ELECTRIC' ? 'zap' : 'fuel'}
              label="Fuel"
              value={FUEL_LABELS[vehicle.fuelType]}
            />
            <SpecTile icon="gear" label="Transmission" value={TRANSMISSION_LABELS[vehicle.transmission]} />
            <SpecTile icon="seat" label="Seats" value={`${vehicle.seats} seats`} />
            <SpecTile icon="door" label="Doors" value={`${vehicle.doors} doors`} />
            <SpecTile
              icon="gauge"
              label="Odometer"
              value={`${Number(vehicle.mileage || 0).toLocaleString('en-IN')} km`}
            />
          </div>

          {vehicle.features?.length > 0 && (
            <div className="mt-10">
              <h2 className="font-display text-[17px] font-semibold text-white">What you get</h2>
              <ul className="mt-4 flex flex-wrap gap-2.5">
                {vehicle.features.map((feature) => (
                  <li
                    key={feature}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-mist-200"
                  >
                    <Icon name="check" size={14} className="text-lime" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reserved windows */}
          <div className="mt-12">
            <h2 className="font-display text-[17px] font-semibold text-white">Reserved windows</h2>
            <p className="mt-2 text-[13.5px] text-mist-400">
              Straight from the booking engine - a car shown as available can still be taken by
              someone else first, and checkout will tell you immediately.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {upcoming?.length ? (
                upcoming.slice(0, 6).map((window, index) => (
                  <div
                    key={`${window.pickupDate}-${index}`}
                    className="surface-inset flex items-center justify-between px-4 py-3.5"
                  >
                    <span className="text-[13.5px] text-mist-200">
                      {formatDate(window.pickupDate)} → {formatDate(window.returnDate)}
                    </span>
                    <span className="badge border-white/12 bg-white/[0.05] text-mist-400">Booked</span>
                  </div>
                ))
              ) : (
                <div className="surface-inset flex items-center gap-3 px-4 py-4 sm:col-span-2">
                  <Icon name="checkCircle" size={18} className="text-signal-success" />
                  <p className="text-[13.5px] text-mist-200">
                    No upcoming reservations - this car is wide open.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reviews */}
          <div className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-[17px] font-semibold text-white">Reviews</h2>
                <p className="mt-1.5 text-[13.5px] text-mist-400">
                  Only renters who completed a trip in this car can review it.
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-[24px] font-semibold text-white">
                  {summary?.averageRating ? summary.averageRating.toFixed(1) : vehicle.averageRating
                    ? vehicle.averageRating.toFixed(1)
                    : '-'}
                </p>
                <p className="meta">{distributionTotal} reviews</p>
              </div>
            </div>

            {distributionTotal > 0 && (
              <ul className="mt-6 space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[star] ?? distribution[String(star)] ?? 0;
                  return (
                    <li key={star} className="flex items-center gap-3">
                      <span className="w-10 font-mono text-[11px] text-mist-400">{star}★</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className="block h-full rounded-full bg-lime/70"
                          style={{ width: `${Math.round((count / distributionTotal) * 100)}%` }}
                        />
                      </span>
                      <span className="w-8 text-right font-mono text-[11px] text-mist-500">{count}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-7 space-y-4">
              {reviews === null ? (
                <Skeleton className="h-28" />
              ) : reviews.content?.length ? (
                reviews.content.map((review) => (
                  <Card key={review.id} className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-mist-200">
                          {review.reviewerInitials || 'DE'}
                        </span>
                        <div>
                          <p className="text-[13.5px] font-medium text-white">{review.reviewerName}</p>
                          <p className="text-[12px] text-mist-500">
                            {review.createdAt ? formatDate(review.createdAt) : ''}
                          </p>
                        </div>
                      </div>
                      <Rating value={review.rating} />
                    </div>
                    {review.title && (
                      <h3 className="mt-4 text-[14.5px] font-medium text-white">{review.title}</h3>
                    )}
                    <p className="mt-2 text-[13.5px] leading-relaxed text-mist-300">{review.comment}</p>
                  </Card>
                ))
              ) : (
                <div className="surface px-5 py-10 text-center">
                  <p className="text-[14px] text-mist-300">No reviews yet.</p>
                  <p className="mt-1.5 text-[13px] text-mist-500">
                    Be the first once your trip is complete.
                  </p>
                </div>
              )}
            </div>

            {reviews?.totalPages > 1 && (
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  className="icon-btn h-9 w-9"
                  onClick={() => setReviewPage((page) => Math.max(0, page - 1))}
                  disabled={reviewPage === 0}
                  aria-label="Previous reviews"
                >
                  <Icon name="chevronLeft" size={15} />
                </button>
                <span className="font-mono text-[11.5px] text-mist-400">
                  {reviewPage + 1} / {reviews.totalPages}
                </span>
                <button
                  type="button"
                  className="icon-btn h-9 w-9"
                  onClick={() => setReviewPage((page) => Math.min(reviews.totalPages - 1, page + 1))}
                  disabled={reviewPage >= reviews.totalPages - 1}
                  aria-label="More reviews"
                >
                  <Icon name="chevronRight" size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-[17px] font-semibold text-white">Reserve this car</h2>
            <p className="mt-1.5 text-[13px] text-mist-400">
              Nothing is charged until you confirm the payment step.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Field label="Pick-up" htmlFor="detail-pickup">
                <input
                  id="detail-pickup"
                  type="date"
                  className="input"
                  min={today}
                  value={dates.pickupDate}
                  onChange={(event) => {
                    const pickupDate = event.target.value;
                    setDates((current) => ({
                      pickupDate,
                      returnDate:
                        current.returnDate <= pickupDate
                          ? toIsoDate(addDays(pickupDate, 1))
                          : current.returnDate,
                    }));
                  }}
                />
              </Field>
              <Field label="Return" htmlFor="detail-return">
                <input
                  id="detail-return"
                  type="date"
                  className="input"
                  min={dates.pickupDate || today}
                  value={dates.returnDate}
                  onChange={(event) =>
                    setDates((current) => ({ ...current, returnDate: event.target.value }))
                  }
                />
              </Field>
            </div>

            <div className="surface-inset mt-5 p-4">
              {quoteError ? (
                <div className="flex items-start gap-2.5">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-signal-danger" />
                  <div>
                    <p className="text-[13px] font-medium text-signal-danger">Not available</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-mist-400">
                      {quoteError.message}
                    </p>
                  </div>
                </div>
              ) : quoting || !quote ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3.5 w-3/4" />
                </div>
              ) : (
                <dl className="space-y-2.5">
                  <DetailRow
                    label={`${formatCurrency(quote.dailyRate)} × ${quote.totalDays} ${
                      quote.totalDays === 1 ? 'day' : 'days'
                    }`}
                    value={formatCurrency(quote.baseAmount)}
                  />
                  <DetailRow label="Refundable deposit" value={formatCurrency(quote.depositAmount)} />
                  <div className="rule my-3" />
                  <DetailRow label="Total due" value={formatCurrency(quote.totalAmount)} strong />
                  <p className="pt-1 text-[11.5px] leading-relaxed text-mist-500">
                    The deposit is returned in full when the car comes back with no new damage. Late
                    cancellation inside 24 hours retains one day of rental.
                  </p>
                </dl>
              )}
            </div>

            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={bookNow}
              loading={booking}
              disabled={!quote || Boolean(quoteError) || !vehicle.bookable}
              iconRight={quote && vehicle.bookable ? 'arrowRight' : undefined}
            >
              {!vehicle.bookable
                ? vehicle.unavailableReason || 'Currently unavailable'
                : isAuthenticated
                  ? 'Reserve and pay'
                  : 'Sign in to reserve'}
            </Button>

            <ul className="mt-5 space-y-2">
              {[
                nights > 0 ? `${nights} ${nights === 1 ? 'day' : 'days'} of rental` : 'Choose your dates',
                `Pick-up from ${vehicle.location}`,
                'Free cancellation up to 24h before',
              ].map((line) => (
                <li key={line} className="flex items-center gap-2 text-[12.5px] text-mist-400">
                  <Icon name="check" size={13} className="text-lime" />
                  {line}
                </li>
              ))}
            </ul>
          </Card>

          <div className="surface mt-4 flex items-start gap-3 p-4">
            <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-lime" />
            <p className="text-[12.5px] leading-relaxed text-mist-400">
              Every car carries valid insurance, a fitness certificate and a recent service record.
              Documents are verified before a vehicle enters the fleet.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
