import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Card, Rating, SectionHeading, Skeleton } from '../../components/ui/primitives.jsx';
import QuickSearch from '../../components/vehicles/QuickSearch.jsx';
import VehicleCard from '../../components/vehicles/VehicleCard.jsx';
import {
  animateCount,
  createHeroTimeline,
  createMarqueeTimeline,
  createOutroTimeline,
  createStoryTimeline,
  refreshScrollTriggers,
} from '../../animations/index.js';
import { getCategories, searchVehicles } from '../../api/vehicles.js';
import { CATEGORY_BLURBS, CATEGORY_LABELS } from '../../utils/constants.js';
import { formatCurrency } from '../../utils/format.js';

// The WebGL stage is heavy: it is split out so the hero markup paints first.
const DriveEaseScene = lazy(() => import('../../three/DriveEaseScene.jsx'));

const STORY_PANELS = [
  {
    index: '01',
    eyebrow: 'The fleet',
    title: 'Every car vetted, every price honest.',
    body: 'Fifty-point inspections, verified documents and a price you see before you sign in. What the card says is what you pay.',
    points: ['Free cancellation up to 24h', 'Deposit refunded in full', 'Roadside assistance included'],
  },
  {
    index: '02',
    eyebrow: 'The booking',
    title: 'Availability you can actually trust.',
    body: 'Dates are checked against real fleet schedules on the server. If a car is free, you get it - no double bookings, no calls to confirm.',
    points: ['Live availability engine', 'Instant confirmation on payment', 'Digital receipt with GST details'],
  },
  {
    index: '03',
    eyebrow: 'The handover',
    title: 'Pick up in minutes. Return without the queue.',
    body: 'Odometer readings, fuel level and a condition report are logged at both ends, so the deposit decision is never a guessing game.',
    points: ['Condition log at pickup', 'Odometer tracked per trip', 'Deposit released on return'],
  },
];

const STEPS = [
  {
    icon: 'search',
    title: 'Find your car',
    body: 'Filter by dates, city, fuel and gearbox. Availability is computed against live bookings rather than a static calendar.',
  },
  {
    icon: 'card',
    title: 'Pay and confirm',
    body: 'A single transparent total - rental plus refundable deposit. Payment confirms the booking instantly.',
  },
  {
    icon: 'key',
    title: 'Drive away',
    body: 'Show your licence, log the odometer, and go. Your deposit is released the moment the car is back.',
  },
];

const FEATURES = [
  {
    icon: 'shield',
    title: 'Server-authoritative availability',
    body: 'Overlapping dates are rejected with a 409 and a clear reason, never by quietly double-booking a car.',
  },
  {
    icon: 'chart',
    title: 'Money you can audit',
    body: 'Every payment and refund is recorded with an actor, a reference and a receipt. Reports come from database aggregation, not guesses.',
  },
  {
    icon: 'wrench',
    title: 'Fleet kept honest',
    body: 'Maintenance and damage logs are part of the vehicle history, so a car with an open repair never enters the booking pool.',
  },
  {
    icon: 'layers',
    title: 'Built as one system',
    body: 'Customer app, fleet console and admin reporting share one API contract - the same rules apply at every level.',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'Booked a Camry for a Mangaluru–Coorg run. Handover took eight minutes and the deposit was back before I reached home.',
    name: 'Ananya R.',
    detail: 'Weekend trip · 3 days',
  },
  {
    quote:
      'The quoted price was the final price. No fuel charges appearing out of nowhere at return, which has never been my experience elsewhere.',
    name: 'Rahul M.',
    detail: 'Business travel · 5 days',
  },
  {
    quote:
      'I run six cars on DriveEase. The maintenance log and utilisation report tell me more than a spreadsheet ever did.',
    name: 'Priya N.',
    detail: 'Fleet partner · Bengaluru',
  },
];

function StoryPanel({ panel, align = 'left' }) {
  return (
    <div className="flex h-screen items-center">
      <div
        className={`max-w-[540px] ${align === 'left' ? 'mr-auto' : 'ml-auto'}`}
        data-story-panel
        data-story-copy-column
      >
        <div data-story-copy className="rounded-3xl border border-white/[0.07] bg-ink-950/70 p-7 backdrop-blur-xl sm:p-9">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.2em] text-lime">{panel.index}</span>
            <span className="h-px w-10 bg-lime/40" aria-hidden="true" />
            <span className="eyebrow">{panel.eyebrow}</span>
          </div>
          <h2 className="display-md mt-5">{panel.title}</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-mist-300">{panel.body}</p>
          <ul className="mt-6 space-y-2.5">
            {panel.points.map((point) => (
              <li key={point} className="flex items-start gap-2.5 text-[13.5px] text-mist-200">
                <Icon name="check" size={15} className="mt-0.5 shrink-0 text-lime" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const heroRef = useRef(null);
  const trackRef = useRef(null);
  const statsRef = useRef(null);
  const marqueeRef = useRef(null);
  const outroRef = useRef(null);

  const [categories, setCategories] = useState(null);
  const [featured, setFeatured] = useState(null);

  /* GSAP: hero entrance, pinned story, marquee and outro. */
  useEffect(() => {
    const cleanups = [
      createHeroTimeline(heroRef.current),
      createStoryTimeline(trackRef.current),
      createMarqueeTimeline(marqueeRef.current),
      createOutroTimeline(outroRef.current),
    ];
    return () => cleanups.forEach((dispose) => dispose?.());
  }, []);

  /* Catalogue teasers - two small, independent requests. */
  useEffect(() => {
    let cancelled = false;
    getCategories()
      .then((data) => !cancelled && setCategories(data))
      .catch(() => !cancelled && setCategories([]));
    searchVehicles({ page: 0, size: 3, sort: 'dailyRate,asc' })
      .then((data) => {
        if (cancelled) return;
        setFeatured(data?.content || []);
        // Cards change the page height: let ScrollTrigger re-measure.
        requestAnimationFrame(() => refreshScrollTriggers());
      })
      .catch(() => !cancelled && setFeatured([]));
    return () => {
      cancelled = true;
    };
  }, []);

  /* Statistics count up once they scroll into view. */
  useEffect(() => {
    const node = statsRef.current;
    if (!node) return undefined;
    const numbers = Array.from(node.querySelectorAll('[data-count-to]'));
    const cancels = [];
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        numbers.forEach((element) => {
          cancels.push(
            animateCount(element, Number(element.dataset.countTo), {
              decimals: Number(element.dataset.countDecimals || 0),
              suffix: element.dataset.countSuffix || '',
            }),
          );
        });
        observer.disconnect();
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancels.forEach((cancel) => cancel?.());
    };
  }, []);

  return (
    <div>
      {/* ────────────────────────────────────────────────────────────── */}
      {/* Hero + pinned 3D story                                        */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section data-scene-track className="relative" ref={trackRef}>
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <Suspense
            fallback={
              <div className="absolute inset-0 bg-radial-spot">
                <div className="absolute left-1/2 top-1/2 h-[280px] w-[520px] -translate-x-1/2 -translate-y-1/2">
                  <Skeleton className="h-full w-full rounded-[40%]" />
                </div>
              </div>
            }
          >
            <DriveEaseScene className="absolute inset-0 h-full w-full" />
          </Suspense>

          {/* Scrims keep the type readable over the canvas on every viewport. */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent lg:via-ink-950/40"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink-950 to-transparent"
            aria-hidden="true"
          />
        </div>

        <div className="relative z-10 -mt-[100vh]">
          {/* Panel 1 - the hero itself */}
          <div className="shell flex h-screen items-center" ref={heroRef}>
            <div className="max-w-[560px] pt-10">
              <p className="eyebrow" data-hero-line>
                Self-drive car rental · Karnataka
              </p>
              <h1 className="display-xl mt-5">
                <span className="block overflow-hidden">
                  <span className="block" data-hero-line>
                    Rent the road.
                  </span>
                </span>
                <span className="block overflow-hidden">
                  <span className="block text-mist-400" data-hero-line>
                    Own the journey.
                  </span>
                </span>
              </h1>
              <p className="lede mt-6 max-w-[460px]" data-hero-line>
                Premium cars, transparent pricing and availability you can trust. From a city hatch
                for the weekend to a seven-seat van for the whole family.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3" data-hero-cta>
                <Button to="/fleet" size="lg" iconRight="arrowRight">
                  Browse the fleet
                </Button>
                <Button to="/#how-it-works" variant="ghost" size="lg" icon="info">
                  How it works
                </Button>
              </div>

              <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4" data-hero-stat>
                <div>
                  <dt className="meta">Fleet in service</dt>
                  <dd className="mt-1 font-display text-[22px] font-semibold text-white">40+</dd>
                </div>
                <div>
                  <dt className="meta">Cities</dt>
                  <dd className="mt-1 font-display text-[22px] font-semibold text-white">
                    Mangaluru · Bengaluru
                  </dd>
                </div>
                <div>
                  <dt className="meta">Deposit refund</dt>
                  <dd className="mt-1 font-display text-[22px] font-semibold text-white">100%</dd>
                </div>
              </dl>

              <div className="mt-9" data-hero-cta>
                <QuickSearch />
              </div>
            </div>

            <div
              className="pointer-events-none absolute bottom-8 left-1/2 hidden -translate-x-1/2 items-center gap-3 text-mist-500 lg:flex"
              data-hero-scroll-hint
            >
              <span className="font-mono text-[10.5px] uppercase tracking-[0.24em]">Scroll</span>
              <span className="relative block h-10 w-px bg-gradient-to-b from-lime/70 to-transparent" />
            </div>
          </div>

          {/* Panels 2-3-4 - the pinned story */}
          {STORY_PANELS.map((panel, index) => (
            <div className="shell" key={panel.index}>
              <StoryPanel panel={panel} align={index % 2 === 0 ? 'left' : 'left'} />
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Statistics                                                    */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section border-t border-white/[0.06] bg-ink-900/40" ref={statsRef}>
        <div className="shell grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Trips completed', to: 1240, suffix: '+' },
            { label: 'Average rating', to: 4.8, decimals: 1 },
            { label: 'Fleet utilisation', to: 78, suffix: '%' },
            { label: 'Deposit disputes', to: 0 },
          ].map((stat) => (
            <div key={stat.label} data-reveal>
              <p className="font-display text-[clamp(2.2rem,4vw,3rem)] font-semibold leading-none text-white">
                <span
                  data-count-to={stat.to}
                  data-count-decimals={stat.decimals || 0}
                  data-count-suffix={stat.suffix || ''}
                >
                  0
                </span>
              </p>
              <p className="meta mt-3">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Categories                                                    */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Choose your machine"
            title="A car for the trip you are actually taking"
            description="Each category is priced and maintained separately. Pick the one that fits the road, the luggage and the number of people."
            action={
              <Button to="/fleet" variant="ghost" size="sm" iconRight="arrowRight">
                See all vehicles
              </Button>
            }
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {categories === null
              ? Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-[186px]" />
                ))
              : categories.map((category) => (
                  <Link
                    key={category.category}
                    to={`/fleet?category=${category.category}`}
                    data-reveal
                    className="group surface relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:border-lime/25"
                  >
                    <div className="flex items-start justify-between">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-lime">
                        <Icon name="car" size={20} />
                      </span>
                      <Icon
                        name="arrowUpRight"
                        size={18}
                        className="text-mist-500 transition group-hover:text-lime"
                      />
                    </div>
                    <h3 className="mt-6 font-display text-[19px] font-semibold text-white">
                      {CATEGORY_LABELS[category.category] || category.label}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-mist-400">
                      {CATEGORY_BLURBS[category.category]}
                    </p>
                    <div className="mt-5 flex items-baseline justify-between border-t border-white/[0.06] pt-4">
                      <p className="text-[13px] text-mist-300">
                        from{' '}
                        <span className="font-medium text-white">
                          {formatCurrency(category.startingFrom)}
                        </span>
                        <span className="text-mist-500">/day</span>
                      </p>
                      <p className="meta">{category.vehicleCount} cars</p>
                    </div>
                  </Link>
                ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Featured                                                      */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section border-y border-white/[0.06] bg-ink-900/30">
        <div className="shell">
          <SectionHeading
            eyebrow="Ready to go"
            title="Available from ₹1,500 a day"
            description="The most-booked cars this month, checked against live availability the moment you open a page."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured === null
              ? Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-[380px]" />
                ))
              : featured.map((vehicle) => <VehicleCard key={vehicle.id} vehicle={vehicle} />)}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* How it works                                                  */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section" id="how-it-works">
        <div className="shell">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps, no showroom visit"
            align="center"
            className="mx-auto"
          />
          <ol className="mt-14 grid gap-6 lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} data-reveal data-reveal-delay={index * 90}>
                <Card className="h-full p-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-lime/25 bg-lime/[0.08] text-lime">
                      <Icon name={step.icon} size={21} />
                    </span>
                    <span className="font-mono text-[26px] font-semibold text-white/[0.12]">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-[18px] font-semibold text-white">{step.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-mist-400">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Marquee                                                       */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="overflow-hidden border-y border-white/[0.06] py-8" ref={marqueeRef}>
        <div className="flex w-max items-center gap-12" data-marquee-track>
          {[...Array(2)].map((_, pass) => (
            <div key={pass} className="flex items-center gap-12">
              {[
                'Toyota',
                'Mahindra',
                'Hyundai',
                'Tata',
                'Kia',
                'Honda',
                'Mercedes-Benz',
                'MG',
                'Maruti Suzuki',
              ].map((brand) => (
                <span
                  key={`${pass}-${brand}`}
                  className="font-display text-[22px] font-medium tracking-tight text-white/[0.22]"
                >
                  {brand}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Why DriveEase                                                 */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section" id="insights">
        <div className="shell grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <div data-reveal>
            <p className="eyebrow">Why DriveEase</p>
            <h2 className="display-lg mt-4">
              Built like software,
              <br />
              run like a rental desk.
            </h2>
            <p className="lede mt-6">
              Most rental sites are a form in front of a spreadsheet. DriveEase keeps availability,
              pricing and refunds in one place - so the answer you get online is the answer you get
              at the counter.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/fleet" iconRight="arrowRight">
                Find a car
              </Button>
              <Button to="/support" variant="ghost">
                Talk to a human
              </Button>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((feature, index) => (
              <Card key={feature.title} className="p-6" data-reveal data-reveal-delay={index * 70}>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lime">
                  <Icon name={feature.icon} size={18} />
                </span>
                <h3 className="mt-5 font-display text-[16px] font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-mist-400">{feature.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Testimonials                                                  */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section border-t border-white/[0.06] bg-ink-900/30">
        <div className="shell">
          <SectionHeading eyebrow="From the road" title="What renters say afterwards" />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <Card key={testimonial.name} className="flex h-full flex-col p-7" data-reveal data-reveal-delay={index * 80}>
                <Rating value={5} size={13} />
                <blockquote className="mt-5 flex-1 text-[14.5px] leading-relaxed text-mist-200">
                  “{testimonial.quote}”
                </blockquote>
                <footer className="mt-6 border-t border-white/[0.06] pt-4">
                  <p className="text-[13.5px] font-medium text-white">{testimonial.name}</p>
                  <p className="mt-0.5 text-[12.5px] text-mist-500">{testimonial.detail}</p>
                </footer>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* Outro                                                         */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="section" data-outro ref={outroRef}>
        <div className="shell">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-gradient-to-br from-ink-850 via-ink-900 to-ink-950 px-7 py-16 text-center sm:px-16">
            <div className="pointer-events-none absolute inset-0 hairline-grid opacity-40" aria-hidden="true" />
            <div className="relative">
              <p className="eyebrow" data-outro-item>
                Your next drive is three clicks away
              </p>
              <h2 className="display-lg mx-auto mt-5 max-w-2xl" data-outro-item>
                Pick a date. Pick a car. We will have it ready.
              </h2>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3" data-outro-item>
                <Button to="/fleet" size="lg" iconRight="arrowRight">
                  Browse availability
                </Button>
                <Button to="/register" variant="ghost" size="lg">
                  Create an account
                </Button>
              </div>
              <p className="mt-6 text-[12.5px] text-mist-500" data-outro-item>
                No card stored, no hidden charges. Payments run against a sandbox gateway in this
                demo.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
