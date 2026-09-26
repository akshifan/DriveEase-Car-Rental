import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Checkbox, Input } from '../../components/ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';

const INITIAL = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  licenseNo: '',
  city: '',
  address: '',
  password: '',
  confirmPassword: '',
};

/** Client-side mirror of the server rules, for fast feedback only. */
function validate(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = 'First name is required.';
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!/^[+\d][\d\s-]{7,}$/.test(form.phone.trim())) errors.phone = 'Enter a reachable phone number.';
  if (form.licenseNo.trim().length < 6) errors.licenseNo = 'Enter your driving licence number.';
  if (!form.city.trim()) errors.city = 'Which city will you pick up from?';
  if (form.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'Mix upper case, lower case and a number.';
  }
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const update = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validate(form);
    if (!accepted) nextErrors.terms = 'Please accept the rental terms to continue.';
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setSubmitting(true);
    setFormError('');
    try {
      const { confirmPassword: _confirmPassword, ...payload } = form;
      const session = await register({
        ...payload,
        firstName: payload.firstName.trim(),
        lastName: payload.lastName.trim(),
        email: payload.email.trim().toLowerCase(),
      });
      toast.success(
        'Account created',
        `Welcome aboard, ${session.user?.firstName || 'driver'}. Your licence is on file.`,
      );
      navigate('/dashboard', { replace: true });
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setErrors(error.fieldErrors || {});
      setFormError(
        error.code === 'EMAIL_ALREADY_REGISTERED'
          ? 'That email already has an account. Try signing in instead.'
          : error.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="It takes a minute. You only need your licence details once - after that, booking is three clicks."
      footer={
        <div className="flex flex-col gap-3">
          <p>
            Want to list your cars?{' '}
            <Link
              to="/register-fleet"
              className="text-lime hover:text-lime-soft"
            >
              Apply as a fleet partner
            </Link>
          </p>

          <p>
            Already registered?{' '}
            <Link
              to="/login"
              className="text-lime hover:text-lime-soft"
            >
              Sign in
            </Link>
          </p>
        </div>
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
          <Input
            label="First name"
            required
            autoComplete="given-name"
            value={form.firstName}
            error={errors.firstName}
            onChange={update('firstName')}
          />
          <Input
            label="Last name"
            required
            autoComplete="family-name"
            value={form.lastName}
            error={errors.lastName}
            onChange={update('lastName')}
          />
        </div>

        <Input
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          error={errors.email}
          onChange={update('email')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="+91 98200 00000"
            value={form.phone}
            error={errors.phone}
            onChange={update('phone')}
          />
          <Input
            label="Driving licence"
            required
            placeholder="DL-KA-2020-0012345"
            value={form.licenseNo}
            error={errors.licenseNo}
            onChange={update('licenseNo')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="City" required value={form.city} error={errors.city} onChange={update('city')} />
          <Input label="Address" value={form.address} onChange={update('address')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            hint="At least 8 characters with a number."
            onChange={update('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            error={errors.confirmPassword}
            onChange={update('confirmPassword')}
          />
        </div>

        <div>
          <Checkbox
            label="I accept the rental terms and privacy policy"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          {errors.terms && <p className="field-error">{errors.terms}</p>}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Create account
        </Button>

        <p className="text-[12px] leading-relaxed text-mist-500">
          We store your licence number to verify you at handover. Card details are never stored - only
          the last four digits of a payment method are kept for your receipts.
        </p>
      </form>
    </AuthShell>
  );
}
