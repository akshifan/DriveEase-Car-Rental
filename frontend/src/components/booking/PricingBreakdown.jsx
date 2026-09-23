import { DetailRow } from '../ui/primitives.jsx';
import { formatCurrency } from '../../utils/format.js';

/**
 * Money panel.
 *
 * Values are rendered exactly as the API returned them - the browser never
 * recalculates a total, which keeps a single source of truth for pricing.
 */
export default function PricingBreakdown({ booking, quote, showDepositNote = true, className = '' }) {
  const source = booking || quote;
  if (!source) return null;

  const days = source.totalDays;
  const dailyRate = source.dailyRate;
  const baseAmount = source.baseAmount;
  const depositAmount = source.depositAmount;
  const totalAmount = source.totalAmount;
  const paidAmount = booking?.paidAmount;
  const refundedAmount = booking?.refundedAmount;

  return (
    <div className={className}>
      <dl className="space-y-2.5">
        <DetailRow
          label={`${formatCurrency(dailyRate)} × ${days} ${days === 1 ? 'day' : 'days'}`}
          value={formatCurrency(baseAmount)}
        />
        <DetailRow label="Refundable deposit" value={formatCurrency(depositAmount)} />
      </dl>

      <div className="rule my-4" />

      <dl className="space-y-2.5">
        <DetailRow label="Booking total" value={formatCurrency(totalAmount)} strong />
        {paidAmount !== undefined && paidAmount !== null && (
          <DetailRow label="Paid" value={formatCurrency(paidAmount)} />
        )}
        {refundedAmount > 0 && (
          <DetailRow label="Refunded" value={`−${formatCurrency(refundedAmount)}`} />
        )}
      </dl>

      {showDepositNote && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-mist-500">
          The deposit is fully refundable. Cancelling more than 24 hours before pick-up returns
          everything; inside 24 hours one day of rental is retained.
        </p>
      )}
    </div>
  );
}
