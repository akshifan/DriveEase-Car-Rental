import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Input } from '../../components/ui/primitives.jsx';
import { resetPassword } from '../../api/auth.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';

/** Completes a reset: token comes from the emailed link, password is chosen here. */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (form.password.length < 8) nextErrors.password = 'Use at least 8 characters.';
    else if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      nextErrors.password = 'Mix upper case, lower case and a number.';
    }
    if (form.password !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setFormError('');
    try {
      await resetPassword({ token, newPassword: form.password });
      toast.success('Password updated', 'Sign in with your new password to continue.');
      navigate('/login', { replace: true });
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setErrors(error.fieldErrors || {});
      setFormError(
        error.code === 'RESET_TOKEN_EXPIRED' || error.code === 'INVALID_RESET_TOKEN'
          ? 'That reset link has expired or was already used. Request a new one.'
          : error.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Link not valid" subtitle="This page expects a reset token from your email.">
        <div className="flex items-start gap-3 rounded-xl border border-signal-danger/30 bg-signal-danger/[0.08] px-4 py-3.5">
          <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-signal-danger" />
          <p className="text-[13px] leading-relaxed text-mist-100">
            No token was supplied. Request a fresh password reset link to continue.
          </p>
        </div>
        <Button className="mt-6 w-full" to="/forgot-password" variant="ghost" iconRight="arrowRight">
          Request a new link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you have not used on this account before. All other sessions will be signed out."
      footer={
        <>
          Changed your mind?{' '}
          <Link to="/login" className="text-lime hover:text-lime-soft">
            Back to sign in
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
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={form.password}
          error={errors.password}
          hint="At least 8 characters with a number."
          onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
        />
        <Input
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          value={form.confirmPassword}
          error={errors.confirmPassword}
          onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
        />

        <Button type="submit" size="lg" className="w-full" loading={submitting}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
