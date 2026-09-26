import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Checkbox, Input } from '../../components/ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, ApiError } from '../../api/client.js';
import { isRouteAllowedForRole, landingRouteFor } from '../../utils/constants.js';

/**
 * Resolves the landing page for a freshly authenticated user.
 *
 * Rule: a `from` path is honoured ONLY if the user's role is allowed to visit
 * it. Otherwise the user is sent to their role dashboard. This is what stops a
 * Customer's last page (e.g. /payments) from becoming the landing page for a
 * Fleet Manager who logs in on the same browser.
 */
function resolveLanding(fromPath, role) {
  if (fromPath && isRouteAllowedForRole(fromPath, role)) {
    return fromPath;
  }
  return landingRouteFor({ role });
}

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resending, setResending] = useState(false);

  // Read once and never re-use after this render.
  const fromPath = location.state?.from || null;

  // If already authenticated, always go to the role dashboard - never to a
  // stale `from` path that might belong to a previous user.
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(landingRouteFor(user), { replace: true, state: null });
    }
  }, [isAuthenticated, navigate, user]);

  const resendVerification = async () => {
    setResending(true);
    try {
      await api.post(
        '/auth/resend-fleet-verification',
        { email: unverifiedEmail },
        { skipRefresh: true },
      );
      toast.success('If that email is registered, a new verification link is on its way.');
    } catch (failure) {
      toast.error('Could not send the link', failure.message);
    } finally {
      setResending(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.email) nextErrors.email = 'Enter your email address.';
    if (!form.password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormError('');
    try {
      const session = await login({ email: form.email.trim(), password: form.password });
      toast.success(`Welcome back, ${session.user?.firstName || 'driver'}`);
      const destination = resolveLanding(fromPath, session.user.role);
      // state: null clears the "from" so the next user to hit /login starts
      // with an empty state.
      navigate(destination, { replace: true, state: null });
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setErrors(error.fieldErrors || {});
      setFormError(
        error.code === 'ACCOUNT_DISABLED'
          ? 'This account has been deactivated. Contact support if that is unexpected.'
          : error.code === 'EMAIL_NOT_VERIFIED'
            ? 'Verify your email first. Check your inbox for the link we sent at signup — the "Resend verification" button below will send a fresh one.'
            : error.message,
      );
      setUnverifiedEmail(error.code === 'EMAIL_NOT_VERIFIED' ? form.email.trim().toLowerCase() : '');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage bookings, payments and your fleet console."
      footer={
        <>
          New to DriveEase?{' '}
          <Link to="/register" className="text-lime hover:text-lime-soft">
            Create an account
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

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={form.email}
          error={errors.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          value={form.password}
          error={errors.password}
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded p-1.5 text-mist-400 transition hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
            </button>
          }
        />

        {unverifiedEmail && (
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            icon="mail"
            loading={resending}
            onClick={resendVerification}
          >
            Resend verification email
          </Button>
        )}

        <div className="flex items-center justify-between gap-4">
          <Checkbox
            label="Keep me signed in"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <Link to="/forgot-password" className="text-[13px] text-mist-300 hover:text-lime">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
