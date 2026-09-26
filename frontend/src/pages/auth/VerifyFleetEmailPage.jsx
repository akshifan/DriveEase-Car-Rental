import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Input } from '../../components/ui/primitives.jsx';
import { api, ApiError, setAccessToken } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { landingRouteFor } from '../../utils/constants.js';

/**
 * Landing page for the fleet-partner verification link.
 *
 * The link arrives from the backend as
 *   {APP_BASE_URL}/verify-fleet-email?token=<opaque>
 *
 * On mount we POST the token to /auth/verify-fleet-email. The backend responds
 * with a full session (access token + refresh cookie), which we hydrate into
 * the auth context and then redirect to the fleet console — no second sign-in.
 *
 * Failure branches:
 *   - expired / already used → offer a resend form (if recoverable)
 *   - network error          → offer a Retry button
 */
export default function VerifyFleetEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setUser } = useAuth();

  const token = params.get('token') || '';

  const [state, setState] = useState({
    status: 'verifying', // verifying | ok | error
    message: '',
    code: null,
  });
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  const verify = async () => {
    if (!token) {
      setState({
        status: 'error',
        message:
          'This page expects a verification link from your email. Open the link we sent you, or request a new one.',
        code: 'NO_TOKEN',
      });
      return;
    }
    setState({ status: 'verifying', message: '', code: null });

    try {
      const session = await api.post(
        '/auth/verify-fleet-email',
        { token },
        { skipRefresh: true },
      );

      // The endpoint now returns a full session. Hydrate the auth context and
      // drop the user straight into the fleet console.
      if (session?.accessToken && session?.user) {
        setAccessToken(session.accessToken);
        setUser(session.user);
        toast.success('Email verified', 'Welcome to your fleet console.');
        // Brief delay so the toast renders before navigation replaces the page.
        window.setTimeout(
          () => navigate(landingRouteFor(session.user), { replace: true }),
          400,
        );
        return;
      }

      // Fallback if the backend still returns only a message (older builds).
      setState({
        status: 'ok',
        message: 'Your fleet account is verified. Please sign in to continue.',
        code: null,
      });
    } catch (failure) {
      const err =
        failure instanceof ApiError
          ? failure
          : new ApiError({ message: failure.message });

      const friendly =
        err.code === 'INVALID_VERIFICATION_TOKEN'
          ? 'This verification link is not valid, or it has already been used. You can sign in if the account is already verified, or request a new link.'
          : err.code === 'VERIFICATION_TOKEN_EXPIRED'
            ? 'This verification link has expired. Request a new one below.'
            : err.message ||
            'We could not reach the server. Check your connection and try again.';
      setState({ status: 'error', message: friendly, code: err.code });
    }
  };

  // Run once on mount, and again if the token in the URL changes.
  useEffect(() => {
    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const resend = async (event) => {
    event.preventDefault();
    const email = resendEmail.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setResending(true);
    try {
      await api.post(
        '/auth/resend-fleet-verification',
        { email },
        { skipRefresh: true },
      );
      setResendSent(true);
      toast.success(
        'If that address is registered, a new link is on its way.',
      );
    } catch (failure) {
      // The endpoint always answers 202 regardless of whether the email
      // exists, so a failure here is a real network/server problem.
      toast.error('Could not send the link', failure.message);
    } finally {
      setResending(false);
    }
  };

  /* ------------------------------------------------------------ verifying */

  if (state.status === 'verifying') {
    return (
      <AuthShell
        title="Verifying your email"
        subtitle="One moment while we confirm your link."
      >
        <div className="flex items-center gap-3 text-mist-300">
          <Icon name="refresh" size={18} className="animate-spin text-lime" />
          <span className="text-[14px]">Verifying…</span>
        </div>
      </AuthShell>
    );
  }

  /* ------------------------------------------------------------------- ok */
  /* Shown only if the backend returned a message without a session payload. */

  if (state.status === 'ok') {
    return (
      <AuthShell
        title="You're verified"
        subtitle="Your fleet account is ready."
      >
        <div className="space-y-6">
          <div className="flex items-start gap-3 rounded-xl border border-signal-success/30 bg-signal-success/[0.08] px-4 py-3.5">
            <Icon
              name="checkCircle"
              size={18}
              className="mt-0.5 shrink-0 text-signal-success"
            />
            <div>
              <p className="text-[13.5px] font-medium text-white">
                Email confirmed
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
                {state.message}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full"
            iconRight="arrowRight"
            onClick={() => navigate('/login', { replace: true })}
          >
            Sign in
          </Button>
        </div>
      </AuthShell>
    );
  }

  /* ---------------------------------------------------------------- error */

  // Offer a resend form only when the failure is likely recoverable: the
  // token was expired/used, or missing entirely. For a network failure we
  // offer a Retry button instead.
  const recoverable =
    state.code === 'INVALID_VERIFICATION_TOKEN' ||
    state.code === 'VERIFICATION_TOKEN_EXPIRED' ||
    state.code === 'NO_TOKEN';

  return (
    <AuthShell
      title="We couldn't verify that link"
      subtitle="Don't worry — you can request a fresh one, or sign in if the account is already active."
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-signal-danger/30 bg-signal-danger/[0.08] px-4 py-3.5">
          <Icon
            name="alert"
            size={18}
            className="mt-0.5 shrink-0 text-signal-danger"
          />
          <div>
            <p className="text-[13.5px] font-medium text-white">
              Verification failed
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
              {state.message}
            </p>
          </div>
        </div>

        {recoverable && !resendSent && (
          <form onSubmit={resend} className="space-y-3">
            <Input
              label="Send a new link to"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={resending}
              iconRight="mail"
            >
              Resend verification email
            </Button>
          </form>
        )}

        {resendSent && (
          <div className="flex items-start gap-3 rounded-xl border border-signal-success/30 bg-signal-success/[0.08] px-4 py-3.5">
            <Icon
              name="mail"
              size={18}
              className="mt-0.5 shrink-0 text-signal-success"
            />
            <div>
              <p className="text-[13.5px] font-medium text-white">
                Check your inbox
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">
                If that address is registered and still awaiting verification, a
                fresh link is on its way. The link expires in 48 hours.
              </p>
            </div>
          </div>
        )}

        {!recoverable && (
          <Button
            size="lg"
            variant="ghost"
            className="w-full"
            icon="refresh"
            onClick={verify}
          >
            Try again
          </Button>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-[13px] text-mist-400">
          <Link to="/login" className="text-lime hover:text-lime-soft">
            Sign in
          </Link>
          <Link to="/register-fleet" className="hover:text-white">
            Start a new application
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
