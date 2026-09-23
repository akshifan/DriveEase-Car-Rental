import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Checkbox, Input } from '../../components/ui/primitives.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { landingRouteFor } from '../../utils/constants.js';

const DEMO_ACCOUNTS = [
  { label: 'Customer', email: 'customer@driveease.app', role: 'Books and reviews cars' },
  { label: 'Fleet manager', email: 'fleet@driveease.app', role: 'Runs the fleet console' },
  { label: 'Admin', email: 'admin@driveease.app', role: 'Manages users and reports' },
];

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

  const redirectTo = location.state?.from || null;

  useEffect(() => {
    if (isAuthenticated) navigate(redirectTo || landingRouteFor(user), { replace: true });
  }, [isAuthenticated, navigate, redirectTo, user]);

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
      navigate(redirectTo || landingRouteFor(session.user), { replace: true });
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setErrors(error.fieldErrors || {});
      setFormError(
        error.code === 'ACCOUNT_DISABLED'
          ? 'This account has been deactivated. Contact support if that is unexpected.'
          : error.message,
      );
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

      <div className="mt-9 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <p className="meta">Demo accounts</p>
        <ul className="mt-3 space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => setForm({ email: account.email, password: 'Passw0rd!' })}
                className="flex w-full items-center justify-between gap-4 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.05]"
              >
                <span>
                  <span className="block text-[13px] text-mist-100">{account.email}</span>
                  <span className="block text-[11.5px] text-mist-500">{account.role}</span>
                </span>
                <span className="badge border-white/12 bg-white/[0.04] text-mist-300">{account.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] text-mist-500">
          Password for every demo account: <span className="font-mono text-mist-300">Passw0rd!</span>
        </p>
      </div>
    </AuthShell>
  );
}
