import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
  Tabs,
  Textarea,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { listAllRefunds, refundPayment, searchAllPayments } from '../../api/bookings.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDateTime, maskedCard } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/constants.js';

const TABS = [
  { key: 'payments', label: 'Payments' },
  { key: 'refunds', label: 'Refund ledger' },
];

/**
 * Payments and refunds.
 *
 * Refunds are administrative here (fleet managers cannot issue them). The API
 * enforces the ceiling - never more than the original amount minus everything
 * already refunded, and a duplicate full refund is refused outright.
 */
export default function AdminPayments() {
  const toast = useToast();

  const [tab, setTab] = useState('payments');
  const [status, setStatus] = useState('');
  const [reference, setReference] = useState('');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState(null);
  const [refunds, setRefunds] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const debouncedReference = useDebouncedValue(reference, 450);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    const request =
      tab === 'payments'
        ? searchAllPayments({
            status: status || undefined,
            reference: debouncedReference || undefined,
            page,
            size: 12,
          }).then((data) => {
            setResult(data);
            return null;
          })
        : listAllRefunds({ page, size: 12 }).then((data) => {
            setRefunds(data);
            return null;
          });

    request
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [tab, status, debouncedReference, page]);

  useEffect(load, [load]);

  const openRefund = (payment) => {
    const remaining = Number(payment.amount || 0) - Number(payment.refundedAmount || 0);
    setTarget(payment);
    setAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setReason('');
    setFieldErrors({});
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!target) return;

    const remaining = Number(target.amount || 0) - Number(target.refundedAmount || 0);
    const value = Number(amount);
    const errors = {};
    if (amount === '' || Number.isNaN(value) || value <= 0) errors.amount = 'Enter an amount above zero.';
    else if (value > remaining) errors.amount = `At most ${formatCurrency(remaining)} is refundable.`;
    if (reason.trim().length < 5) errors.reason = 'Give a reason of at least 5 characters.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      await refundPayment(target.id, { amount: value, reason: reason.trim() });
      toast.success(
        'Refund issued',
        `${formatCurrency(value)} is on its way back to the customer.`,
      );
      setTarget(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setFieldErrors(apiError.fieldErrors || {});
      toast.error(
        apiError.code === 'ALREADY_SETTLED' ? 'Already settled' : 'Refund refused',
        apiError.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const payments = result?.content || [];
  const refundRows = refunds?.content || [];
  const collected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = payments.reduce((sum, payment) => sum + Number(payment.refundedAmount || 0), 0);
  const outstanding = payments.filter((payment) => payment.status === 'FAILED').length;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Money</p>
          <h1 className="display-md mt-3">Payments & refunds</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Gateway records, refund ledger and the receipts customers download. Card numbers are never
            stored - only the last four digits the gateway returns.
          </p>
        </div>
        <Button to="/admin/reports" variant="ghost" iconRight="arrowUpRight">
          Revenue reports
        </Button>
      </header>

      <Tabs
        tabs={TABS}
        activeKey={tab}
        onChange={(key) => {
          setTab(key);
          setPage(0);
        }}
        className="w-fit"
      />

      {tab === 'payments' ? (
        <>
          <section className="grid gap-5 sm:grid-cols-3">
            <StatTile label="Collected (page)" value={formatCurrency(collected)} icon="card" tone="lime" />
            <StatTile label="Refunded (page)" value={formatCurrency(refunded)} icon="refresh" tone="info" />
            <StatTile
              label="Failed payments"
              value={outstanding}
              icon="alert"
              tone={outstanding ? 'danger' : 'default'}
              hint="Customers can retry from checkout"
            />
          </section>

          <div className="surface flex flex-wrap items-end gap-4 p-5">
            <Input
              className="min-w-[240px] flex-1"
              label="Reference"
              placeholder="DE-PAY-… or booking reference"
              prefixIcon="search"
              value={reference}
              onChange={(event) => {
                setReference(event.target.value);
                setPage(0);
              }}
            />
            <Select
              className="w-[190px]"
              label="Status"
              placeholder="All statuses"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(0);
              }}
              options={Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <p className="ml-auto pb-2 text-[12.5px] text-mist-400">
              {loading ? 'Loading…' : `${result?.totalElements || 0} payments`}
            </p>
          </div>
        </>
      ) : (
        <div className="surface flex items-center justify-between gap-4 p-5">
          <p className="text-[13.5px] text-mist-300">
            Every refund ever issued, newest first — cancellations and administrative refunds together.
          </p>
          <p className="text-[12.5px] text-mist-400">
            {loading ? 'Loading…' : `${refunds?.totalElements || 0} refunds`}
          </p>
        </div>
      )}

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[84px]" />
          ))}
        </div>
      ) : tab === 'payments' ? (
        payments.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon="card"
              title="No payments match"
              description="Try a different status or clear the reference filter."
            />
          </div>
        ) : (
          <>
            <div className="table-shell">
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Payment</th>
                      <th scope="col">Booking</th>
                      <th scope="col">Method</th>
                      <th scope="col">Paid</th>
                      <th scope="col" className="text-right">
                        Amount
                      </th>
                      <th scope="col" className="text-right">
                        Refunded
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col" className="w-40">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => {
                      const remaining = Number(payment.amount || 0) - Number(payment.refundedAmount || 0);
                      return (
                        <tr key={payment.id}>
                          <td>
                            <p className="font-mono text-[11.5px] text-mist-200">
                              {payment.paymentReference}
                            </p>
                            <p className="mt-0.5 font-mono text-[10.5px] text-mist-500">
                              {payment.transactionRef || 'no gateway ref'}
                            </p>
                          </td>
                          <td>
                            <Link
                              to="/admin/bookings"
                              className="font-mono text-[11.5px] text-mist-300 hover:text-lime"
                            >
                              {payment.bookingReference}
                            </Link>
                          </td>
                          <td className="text-[12.5px] text-mist-300">
                            {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                            {payment.cardLast4 ? (
                              <span className="ml-2 font-mono text-[11px] text-mist-500">
                                {maskedCard(payment.paymentMethod, payment.cardLast4)}
                              </span>
                            ) : null}
                          </td>
                          <td className="text-[12.5px] text-mist-400">
                            {payment.paidAt ? formatDateTime(payment.paidAt) : '—'}
                          </td>
                          <td className="text-right text-[13px] text-mist-100">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="text-right text-[13px] text-ice">
                            {Number(payment.refundedAmount) > 0
                              ? `−${formatCurrency(payment.refundedAmount)}`
                              : '—'}
                          </td>
                          <td>
                            <StatusBadge status={payment.status} kind="payment" />
                            {payment.failureReason && (
                              <p className="mt-1 max-w-[200px] text-[11px] text-signal-danger">
                                {payment.failureReason}
                              </p>
                            )}
                          </td>
                          <td>
                            <div className="flex justify-end gap-2">
                              <Button
                                to={`/payments/${payment.id}`}
                                size="sm"
                                variant="quiet"
                                iconRight="arrowUpRight"
                              >
                                Receipt
                              </Button>
                              {payment.status === 'SUCCESS' && remaining > 0 && (
                                <Button size="sm" variant="ghost" icon="refresh" onClick={() => openRefund(payment)}>
                                  Refund
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              totalElements={result.totalElements}
              onChange={setPage}
            />
          </>
        )
      ) : refundRows.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="refresh"
            title="No refunds issued"
            description="Cancellations outside the 24-hour window and manual refunds both appear here."
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {refundRows.map((refund) => (
              <li key={refund.id} className="surface flex flex-wrap items-center gap-5 p-5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-ice/30 bg-ice/[0.08] text-ice">
                  <Icon name="refresh" size={19} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-mono text-[12px] text-mist-100">{refund.refundReference}</p>
                    <span className="badge badge-neutral">
                      {refund.source === 'CANCELLATION' ? 'Cancellation' : 'Administrative'}
                    </span>
                    {refund.status && (
                      <span className="badge border-signal-success/35 bg-signal-success/10 text-signal-success">
                        {refund.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[13px] text-mist-300">{refund.reason}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-mist-500">
                    <span>{formatDateTime(refund.createdAt)}</span>
                    {refund.processedByName && <span>by {refund.processedByName}</span>}
                    {refund.paymentReference && (
                      <span className="font-mono">payment {refund.paymentReference}</span>
                    )}
                  </p>
                </div>

                <p className="text-[15px] text-ice">{formatCurrency(refund.amount)}</p>
              </li>
            ))}
          </ul>

          <Pagination
            page={refunds.page}
            totalPages={refunds.totalPages}
            totalElements={refunds.totalElements}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        size="sm"
        title="Issue a refund"
        description={target ? `${target.paymentReference} · ${target.bookingReference}` : ''}
      >
        <form onSubmit={submitRefund} className="space-y-5">
          <Card className="p-4">
            <dl className="space-y-3">
              <DetailRow label="Paid" value={formatCurrency(target?.amount || 0)} />
              <DetailRow label="Already refunded" value={formatCurrency(target?.refundedAmount || 0)} />
              <div className="rule my-1" />
              <DetailRow
                label="Refundable now"
                value={formatCurrency(
                  Number(target?.amount || 0) - Number(target?.refundedAmount || 0),
                )}
                strong
              />
            </dl>
          </Card>

          <Field label="Amount (₹)" htmlFor="refund-amount" required error={fieldErrors.amount}>
            <input
              id="refund-amount"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>

          <Textarea
            label="Reason"
            required
            maxLength={255}
            error={fieldErrors.reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Goodwill gesture after a late hand-over."
          />

          <p className="text-[12px] leading-relaxed text-mist-500">
            Refunds return to the original payment method. A full refund moves the payment to
            refunded; a second full refund on the same payment is rejected by the API.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Issue refund
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
