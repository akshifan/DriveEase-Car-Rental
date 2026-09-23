import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Input } from '../../components/ui/primitives.jsx';
import { forgotPassword } from '../../api/auth.js';
import { ApiError } from '../../api/client.js';

/**
 * Password reset request.
 *
 * The API always answers with the same message so the screen cannot be used to
 * discover which emails have accounts. In development the mock mail provider
 * returns the reset token directly, and we surface it as a convenience link.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Enter the email you registered with.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await forgotPassword(email.trim().toLowerCase());
      setSent(result);
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setError(apiError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Tell us the email on the account and we will send a link to set a new password."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="text-lime hover:text-lime-soft">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-signal-success/30 bg-signal-success/[0.08] px-4 py-3.5">
            <Icon name="checkCircle" size={17} className="mt-0.5 shrink-0 text-signal-success" />
            <div>
              <p className="text-[13.5px] font-medium text-white">Check your inbox</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
                {sent.message || 'If an account exists for that address, a reset link is on its way. The link expires in 30 minutes.'}
              </p>
            </div>
          </div>

          {sent.resetToken && (
            <div className="rounded-xl border border-lime/25 bg-lime/[0.06] p-4">
              <p className="meta text-lime">Development mode</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-mist-200">
                The mock mail provider is active, so the token is returned by the API instead of being
                emailed. It expires in {sent.expiresInMinutes ?? 30} minutes.
              </p>
              <Button
                className="mt-3 w-full"
                variant="ghost"
                size="sm"
                to={`/reset-password?token=${encodeURIComponent(sent.resetToken)}`}
                iconRight="arrowRight"
              >
                Open the reset link
              </Button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            error={error}
            onChange={(event) => {
              setEmail(event.target.value);
              setError('');
            }}
          />
          <Button type="submit" size="lg" className="w-full" loading={submitting}>
            Send reset link
          </Button>
          <p className="text-[12px] leading-relaxed text-mist-500">
            For your security we do not confirm whether an address is registered. Reset links are
            single-use and expire after 30 minutes.
          </p>
        </form>
      )}
    </AuthShell>
  );
}
