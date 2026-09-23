import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StatusTimeline from '../components/booking/StatusTimeline.jsx';
import VehicleCard from '../components/vehicles/VehicleCard.jsx';
import PricingBreakdown from '../components/booking/PricingBreakdown.jsx';
import { Button, StatusBadge } from '../components/ui/primitives.jsx';

const vehicle = {
  id: 7,
  make: 'Toyota',
  model: 'Camry Hybrid',
  displayName: 'Toyota Camry Hybrid',
  category: 'LUXURY',
  fuelType: 'HYBRID',
  transmission: 'AUTOMATIC',
  seats: 5,
  location: 'Mangaluru',
  dailyRate: 4250,
  depositAmount: 15000,
  status: 'AVAILABLE',
  bookable: true,
  averageRating: 4.5,
  reviewCount: 2,
  imageUrl: '/images/vehicles/toyota-camry-hybrid-1.svg',
};

function wrap(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('VehicleCard', () => {
  it('shows the price, location and rating, and links to the detail page', () => {
    wrap(<VehicleCard vehicle={vehicle} />);

    expect(screen.getByText('Toyota Camry Hybrid')).toBeInTheDocument();
    expect(screen.getByText(/Mangaluru/)).toBeInTheDocument();
    expect(screen.getByLabelText('View Toyota Camry Hybrid')).toHaveAttribute('href', '/fleet/7');
  });

  it('falls back to a placeholder when the gallery image is missing', () => {
    wrap(<VehicleCard vehicle={{ ...vehicle, imageUrl: null, primaryImageUrl: null }} />);
    expect(screen.queryByRole('img', { name: /Toyota Camry/ })).not.toBeInTheDocument();
  });
});

describe('StatusTimeline', () => {
  it('marks reached steps from the API history and keeps future steps inactive', () => {
    wrap(
      <StatusTimeline
        status="ACTIVE"
        history={[
          { status: 'PENDING', label: 'PENDING', occurredAt: '2026-03-01T09:30:00', complete: true },
          { status: 'CONFIRMED', label: 'CONFIRMED', occurredAt: '2026-03-01T09:35:00', complete: true },
          { status: 'ACTIVE', label: 'ACTIVE', occurredAt: '2026-03-02T08:00:00', complete: false },
        ]}
      />,
    );

    ['Awaiting payment', 'Confirmed', 'On rent', 'Completed'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    // Three of the four flow steps carry a recorded timestamp.
    expect(screen.getAllByText(/Mar 2026/)).toHaveLength(3);
  });

  it('renders the flow without history for a freshly created booking', () => {
    wrap(<StatusTimeline status="PENDING" history={[]} />);
    expect(screen.getByText('Awaiting payment')).toBeInTheDocument();
    expect(screen.queryByText(/Mar 2026/)).not.toBeInTheDocument();
  });
});

describe('PricingBreakdown', () => {
  it('breaks a booking down into rate, days, rental, deposit and total', () => {
    wrap(
      <PricingBreakdown
        booking={{ dailyRate: 4250, totalDays: 4, baseAmount: 17000, depositAmount: 15000, totalAmount: 32000 }}
      />,
    );

    expect(screen.getByText('Refundable deposit')).toBeInTheDocument();
    expect(screen.getByText('₹15,000')).toBeInTheDocument();
    expect(screen.getByText('₹32,000')).toBeInTheDocument();
    expect(screen.getByText('Booking total')).toBeInTheDocument();
  });
});

describe('primitives', () => {
  it('keeps a disabled button from firing its handler', async () => {
    const onClick = vi.fn();
    wrap(
      <Button disabled onClick={onClick}>
        Reserve
      </Button>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reserve' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('labels a payment badge for screen readers', () => {
    wrap(<StatusBadge status="REFUNDED" kind="payment" />);
    expect(screen.getByText('Refunded')).toBeInTheDocument();
  });
});
