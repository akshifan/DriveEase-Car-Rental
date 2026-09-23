import Icon from '../../components/ui/Icon.jsx';
import { Button, Card, SectionHeading } from '../../components/ui/primitives.jsx';

const FAQS = [
  {
    q: 'How is availability calculated?',
    a: 'Every booking reserves a date window on a specific car. When you search, the API checks those windows in the database - if the dates overlap an existing reservation you get a clear conflict message instead of a silent double booking.',
  },
  {
    q: 'What does the deposit cover?',
    a: 'The refundable deposit covers fuel, tolls and any damage recorded at return. It is returned in full when the car comes back in the condition it left in; a partial deduction is only made if a condition report documents new damage.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes. Cancelling more than 24 hours before pick-up refunds everything you paid, including the deposit. Inside 24 hours a single day of rental is retained and the deposit is still returned.',
  },
  {
    q: 'How do I get an invoice?',
    a: 'Each successful payment produces a receipt with its own reference. Open Payments in your account and download any receipt for your records or expense claims.',
  },
  {
    q: 'Which documents do I need at pick-up?',
    a: 'A valid driving licence and a government photo ID matching the booking name. Both are verified against the licence you register with, so keep those details up to date in your profile.',
  },
];

const LOCATIONS = [
  { city: 'Mangaluru', address: 'Kadri Road, near Bunts Hostel Circle', hours: '7am – 11pm' },
  { city: 'Bengaluru', address: 'Indiranagar 100ft Road, HAL 2nd Stage', hours: '24 hours' },
];

export default function SupportPage() {
  return (
    <div className="pt-[76px]">
      <div className="border-b border-white/[0.06] bg-ink-900/40">
        <div className="shell py-14">
          <p className="eyebrow">Support</p>
          <h1 className="display-lg mt-4">Humans, not chatbots.</h1>
          <p className="lede mt-4 max-w-2xl">
            Questions about a booking, a deposit or a damaged car - here is how to reach us, and the
            answers to what people ask most.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="tel:+918200012345" icon="phone">
              +91 82000 12345
            </Button>
            <Button href="mailto:hello@driveease.app" variant="ghost" icon="mail">
              hello@driveease.app
            </Button>
          </div>
        </div>
      </div>

      <section className="section">
        <div className="shell grid gap-10 lg:grid-cols-[1fr_1.3fr]">
          <div id="locations">
            <h2 className="display-md">Pick-up points</h2>
            <p className="mt-3 text-[14px] text-mist-400">
              Both hubs are staffed, with covered parking and a handover bay.
            </p>
            <ul className="mt-7 space-y-4">
              {LOCATIONS.map((location) => (
                <li key={location.city}>
                  <Card className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-display text-[16px] font-semibold text-white">
                          {location.city}
                        </h3>
                        <p className="mt-1.5 text-[13.5px] text-mist-400">{location.address}</p>
                      </div>
                      <span className="badge border-lime/30 bg-lime/[0.08] text-lime">
                        {location.hours}
                      </span>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            <div className="mt-8 surface p-5" id="partners">
              <div className="flex items-center gap-3">
                <Icon name="building" size={18} className="text-lime" />
                <h3 className="font-display text-[15px] font-semibold text-white">
                  List your fleet
                </h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mist-400">
                Fleet partners get a dashboard for utilisation, maintenance history and revenue per
                vehicle. Bring five cars or fifty - the console scales with you.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="sm" to="/register">
                  Create an account
                </Button>
                <Button size="sm" variant="ghost" href="mailto:partners@driveease.app">
                  Talk to partnerships
                </Button>
              </div>
            </div>
          </div>

          <div>
            <SectionHeading eyebrow="FAQ" title="Questions we get every week" />
            <div className="mt-8 divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {FAQS.map((faq) => (
                <details key={faq.q} className="group py-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-6 text-[15px] font-medium text-white marker:content-none">
                    {faq.q}
                    <Icon
                      name="chevronDown"
                      size={18}
                      className="shrink-0 text-mist-500 transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3.5 max-w-2xl text-[14px] leading-relaxed text-mist-400">{faq.a}</p>
                </details>
              ))}
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <Card className="p-5" id="careers">
                <h3 className="font-display text-[15px] font-semibold text-white">Careers</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
                  We hire engineers, fleet operators and city leads. Write to us with what you would
                  improve.
                </p>
              </Card>
              <Card className="p-5" id="press">
                <h3 className="font-display text-[15px] font-semibold text-white">Press</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-mist-400">
                  Brand assets and a product fact sheet are available on request.
                </p>
              </Card>
            </div>

            <div className="mt-8 surface-flat p-6" id="privacy">
              <h3 className="font-display text-[15px] font-semibold text-white">Privacy & terms</h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-mist-400">
                DriveEase stores the minimum needed to rent you a car: contact details, your licence
                number and your booking history. Card numbers and CVV codes are never received or
                stored - payments run through a sandbox gateway in this build, and only the last
                four digits of a card are ever kept for display.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
