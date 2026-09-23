import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Rating,
  Select,
  Skeleton,
  StatTile,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { listAllReviews, moderateReview } from '../../api/bookings.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatDateTime } from '../../utils/format.js';

/**
 * Review moderation.
 *
 * Reviews are only ever soft-deleted: the row stays, the text is hidden and the
 * reason is written to the audit trail, so a decision can be reviewed later.
 */
export default function AdminReviews() {
  const toast = useToast();

  const [ratingFilter, setRatingFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 450);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAllReviews({
      search: debouncedSearch || undefined,
      maxRating: ratingFilter || undefined,
      includeDeleted: true,
      page,
      size: 10,
    })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [debouncedSearch, ratingFilter, page]);

  useEffect(load, [load]);

  const submitModeration = async (event) => {
    event.preventDefault();
    if (!target) return;
    if (reason.trim().length < 5) {
      setReasonError('Give a reason of at least 5 characters — it is stored on the audit trail.');
      return;
    }
    setSubmitting(true);
    setReasonError('');
    try {
      await moderateReview(target.id, reason.trim());
      toast.success('Review removed', 'The text is hidden and the action is on the audit trail.');
      setTarget(null);
      setReason('');
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setReasonError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const rows = result?.content || [];
  const live = rows.filter((review) => !review.deleted);
  const hidden = rows.filter((review) => review.deleted);
  const average =
    live.length > 0 ? live.reduce((sum, review) => sum + review.rating, 0) / live.length : null;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Reputation</p>
          <h1 className="display-md mt-3">Review moderation</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            One review per completed booking, tied to the trip by the API. Removing one hides the text
            and keeps the record for the audit log.
          </p>
        </div>
        <Button to="/admin/reports" variant="ghost" iconRight="arrowUpRight">
          Rating reports
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile
          label="Visible on this page"
          value={live.length}
          icon="star"
          tone="lime"
          hint={average != null ? `${average.toFixed(2)} average` : 'No ratings yet'}
        />
        <StatTile
          label="Hidden"
          value={hidden.length}
          icon="eyeOff"
          tone={hidden.length ? 'danger' : 'default'}
        />
        <StatTile label="Total reviews" value={result?.totalElements || 0} icon="users" />
      </section>

      <div className="surface flex flex-wrap items-end gap-4 p-5">
        <Input
          className="min-w-[240px] flex-1"
          label="Search"
          placeholder="Reviewer, vehicle or review text"
          prefixIcon="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <Select
          className="w-[190px]"
          label="Rating"
          placeholder="Any rating"
          value={ratingFilter}
          onChange={(event) => {
            setRatingFilter(event.target.value);
            setPage(0);
          }}
          options={[1, 2, 3, 4, 5].map((value) => ({
            value,
            label: `${value} star${value > 1 ? 's' : ''} and below`,
          }))}
        />
        <p className="ml-auto pb-2 text-[12.5px] text-mist-400">
          {loading ? 'Loading…' : `${result?.totalElements || 0} reviews`}
        </p>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[130px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="star"
            title="No reviews match"
            description="Reviews appear once customers complete trips. Adjust the filters to see more."
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((review) => (
              <li
                key={review.id}
                className={`surface p-5 ${review.deleted ? 'opacity-70' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-mist-200">
                        {review.reviewerInitials || 'DE'}
                      </span>
                      <div>
                        <p className="text-[13.5px] font-medium text-white">{review.reviewerName}</p>
                        <p className="mt-0.5 text-[11.5px] text-mist-500">
                          {formatDateTime(review.createdAt)}
                          {review.bookingReference ? ` · ${review.bookingReference}` : ''}
                        </p>
                      </div>
                      <Rating value={review.rating} />
                      {review.deleted && (
                        <span className="badge border-signal-danger/35 bg-signal-danger/10 text-signal-danger">
                          Hidden
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-[12.5px] text-mist-400">
                      <Link
                        to={`/fleet/${review.vehicleId}`}
                        className="text-mist-200 hover:text-lime"
                      >
                        {review.vehicleName}
                      </Link>
                    </p>

                    {review.title && (
                      <h3 className="mt-3 text-[14.5px] font-medium text-white">{review.title}</h3>
                    )}
                    <p
                      className={`mt-1.5 text-[13.5px] leading-relaxed ${
                        review.deleted ? 'text-mist-500 line-through' : 'text-mist-300'
                      }`}
                    >
                      {review.comment}
                    </p>

                    {review.deleted && review.deleteReason && (
                      <p className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-[12.5px] text-mist-400">
                        <span className="meta mr-2">Removed</span>
                        {review.deleteReason}
                      </p>
                    )}
                  </div>

                  {!review.deleted && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon="eyeOff"
                      onClick={() => {
                        setTarget(review);
                        setReason('');
                        setReasonError('');
                      }}
                    >
                      Hide review
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

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        size="sm"
        title="Hide this review?"
        description={target ? `${target.reviewerName} · ${target.rating}★ · ${target.vehicleName}` : ''}
      >
        <form onSubmit={submitModeration} className="space-y-5">
          <Card className="p-4">
            <p className="text-[12.5px] leading-relaxed text-mist-300">
              “{target?.comment ? target.comment.slice(0, 240) : ''}
              {target?.comment && target.comment.length > 240 ? '…' : ''}”
            </p>
          </Card>

          <Field
            label="Reason for removal"
            htmlFor="moderation-reason"
            required
            error={reasonError}
            hint="Recorded against your account in the audit log."
          >
            <textarea
              id="moderation-reason"
              className="input"
              rows={3}
              maxLength={255}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contains personal information about a third party."
            />
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setTarget(null)}>
              Keep it
            </Button>
            <Button type="submit" variant="danger" loading={submitting}>
              Hide review
            </Button>
          </div>
        </form>
      </Modal>

      <p className="text-[12px] leading-relaxed text-mist-500">
        Reviews are attached to a booking, so a customer cannot review a car they never drove — the API
        rejects it with 409 <span className="font-mono">REVIEW_ALREADY_SUBMITTED</span> and 404 for
        bookings that were not completed. Deleted reviews keep their rating in the distribution, which
        is why hidden rows still show on this page.
      </p>
    </div>
  );
}
