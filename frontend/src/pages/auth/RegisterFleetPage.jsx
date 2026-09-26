import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Input } from '../../components/ui/primitives.jsx';
import { api, ApiError } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const INITIAL = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  city: '',
  estimatedFleetSize: 5,
  password: '',
  confirmPassword: '',
};

export default function RegisterFleetPage() {
  const toast = useToast();
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Resend cooldown: prevents a user from hammering the endpoint.
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.';
    if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
    if (!form.companyName.trim()) next.companyName = 'Company name is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (form.password.length < 8) next.password = 'Use at least 8 characters.';
    else if (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      next.password = 'Include at least one letter and one number.';
    }
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    setFormError('');
    try {
      await api.post(
        '/auth/register-fleet',
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          companyName: form.companyName.trim(),
          city: form.city.trim(),
          estimatedFleetSize: Number(form.estimatedFleetSize) || 1,
          password: form.password,
        },
        { skipRefresh: true },
      );
      setSubmitted(true);
      startCooldown();
    } catch (failure) {
      const err = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setErrors(err.fieldErrors || {});
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startCooldown = () => {
    setCooldown(60);
    const timer = setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post(
        '/auth/resend-fleet-verification',
        { email: form.email.trim().toLowerCase() },
        { skipRefresh: true },
      );
      toast.success('Sent again', 'If that address is registered, a new link is on its way.');
      startCooldown();
    } catch (failure) {
      toast.error('Could not send the link', failure.message);
    } finally {
      setResending(false);
    }
  };

  /* ------------------------------------------------------------- submitted */

  if (submitted) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="One more step to activate your fleet account."
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-signal-success/30 bg-signal-success/[0.08] px-4 py-3.5">
            <Icon name="mail" size={18} className="mt-0.5 shrink-0 text-signal-success" />
            <div>
              <p className="text-[13.5px] font-medium text-white">Verification link sent</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
                We emailed a verification link to{' '}
                <span className="text-mist-100">{form.email}</span>. Click it to activate your
                account, then sign in.
              </p>
            </div>
          </div>

          <ul className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-mist-300">
            <li className="flex items-start gap-2">
              <Icon name="info" size={14} className="mt-0.5 shrink-0 text-mist-400" />
              The link expires in 48 hours.
            </li>
            <li className="flex items-start gap-2">
              <Icon name="info" size={14} className="mt-0.5 shrink-0 text-mist-400" />
              If you don't see it, check spam — the sender is <span className="text-mist-100">no-reply@driveease</span>.
            </li>
            <li className="flex items-start gap-2">
              <Icon name="info" size={14} className="mt-0.5 shrink-0 text-mist-400" />
              Wrong address?{' '}
              <button
                type="button"
                className="text-lime hover:text-lime-soft"
                onClick={() => {
                  setSubmitted(false);
                  setForm((current) => ({ ...current, password: '', confirmPassword: '' }));
                }}
              >
                Start over
              </button>
            </li>
          </ul>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              variant="ghost"
              className="w-full"
              icon="mail"
              disabled={cooldown > 0 || resending}
              loading={resending}
              onClick={resend}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Didn't get it? Resend"}
            </Button>
            <Button
              size="lg"
              variant="quiet"
              className="w-full"
              onClick={() => (window.location.href = '/login')}
            >
              Back to sign in
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  /* ------------------------------------------------------------------ form */

  return (
    <AuthShell
      title="Become a fleet partner"
      subtitle="List and manage your vehicles on DriveEase. Verify your email and you're in."
      footer={
        <>
          Already a partner?{' '}
          <Link to="/login" className="text-lime hover:text-lime-soft">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        {formError && (
          <div
            className="flex items-start gap-2.5 rounded-xl border border-signal-danger/30 bg-signal-danger/[0.08] px-4 py-3"
            role="alert"
          >
            <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-signal-danger" />
            <p className="text-[13px] leading-relaxed text-mist-100">{formError}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" required value={form.firstName} error={errors.firstName} onChange={update('firstName')} />
          <Input label="Last name" required value={form.lastName} error={errors.lastName} onChange={update('lastName')} />
        </div>

        <Input
          label="Work email"
          type="email"
          required
          value={form.email}
          error={errors.email}
          hint="We'll send your verification link here."
          onChange={update('email')}
        />

        <Input label="Phone" type="tel" value={form.phone} error={errors.phone} onChange={update('phone')} />

        <Input
          label="Company / fleet name"
          required
          value={form.companyName}
          error={errors.companyName}
          onChange={update('companyName')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Primary city" required value={form.city} error={errors.city} onChange={update('city')} />
          <Input
            label="Estimated fleet size"
            type="number"
            min="1"
            max="10000"
            value={form.estimatedFleetSize}
            onChange={update('estimatedFleetSize')}
            hint="How many cars do you plan to list?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            required
            value={form.password}
            error={errors.password}
            hint="At least 8 characters with a number."
            onChange={update('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            required
            value={form.confirmPassword}
            error={errors.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create fleet account
        </Button>

        <p className="text-[12px] leading-relaxed text-mist-500">
          We'll email you a verification link. Your account activates the moment you click it.
        </p>
      </form>
    </AuthShell>
  );
}
