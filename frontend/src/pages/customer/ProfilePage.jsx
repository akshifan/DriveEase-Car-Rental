import { useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import { Button, Card, DetailRow, Field, Input, StatusBadge } from '../../components/ui/primitives.jsx';
import { changePassword, getProfile, updateProfile } from '../../api/auth.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatDateTime, initialsOf } from '../../utils/format.js';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const toast = useToast();

  const [profile, setProfile] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    let cancelled = false;
    getProfile()
      .then((data) => !cancelled && setProfile(data))
      .catch(() => !cancelled && setProfile(user));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const updated = await updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        address: profile.address,
        city: profile.city,
        licenseNo: profile.licenseNo,
      });
      setProfile(updated);
      setUser((current) => ({ ...current, ...updated }));
      toast.success('Profile updated', 'Your details are saved.');
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setProfileErrors(error.fieldErrors || {});
      toast.error('Could not save your profile', error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = 'Enter your current password.';
    if (passwords.newPassword.length < 8) errors.newPassword = 'Use at least 8 characters.';
    else if (!/[A-Z]/.test(passwords.newPassword) || !/[a-z]/.test(passwords.newPassword) || !/\d/.test(passwords.newPassword)) {
      errors.newPassword = 'Mix upper case, lower case and a number.';
    }
    if (passwords.newPassword !== passwords.confirm) errors.confirm = 'Passwords do not match.';
    setPasswordErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed', 'Other sessions have been signed out.');
    } catch (failure) {
      const error = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setPasswordErrors(error.fieldErrors || {});
      toast.error('Could not change your password', error.message);
    } finally {
      setSavingPassword(false);
    }
  };

  if (!profile) {
    return <div className="surface h-64 animate-pulse" aria-hidden="true" />;
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Account</p>
        <h1 className="display-md mt-3">Profile & security</h1>
        <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
          Keep your licence and contact details current - they are checked against your documents at
          handover.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={saveProfile} className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Personal details</h2>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label="First name"
                required
                value={profile.firstName || ''}
                error={profileErrors.firstName}
                onChange={(event) => setProfile((current) => ({ ...current, firstName: event.target.value }))}
              />
              <Input
                label="Last name"
                required
                value={profile.lastName || ''}
                error={profileErrors.lastName}
                onChange={(event) => setProfile((current) => ({ ...current, lastName: event.target.value }))}
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Phone"
                type="tel"
                value={profile.phone || ''}
                error={profileErrors.phone}
                onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}
              />
              <Input
                label="Driving licence"
                value={profile.licenseNo || ''}
                error={profileErrors.licenseNo}
                hint="Checked at handover."
                onChange={(event) => setProfile((current) => ({ ...current, licenseNo: event.target.value }))}
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="City"
                value={profile.city || ''}
                error={profileErrors.city}
                onChange={(event) => setProfile((current) => ({ ...current, city: event.target.value }))}
              />
              <Input
                label="Address"
                value={profile.address || ''}
                error={profileErrors.address}
                onChange={(event) => setProfile((current) => ({ ...current, address: event.target.value }))}
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-[12px] text-mist-500">
                Your email <span className="text-mist-300">{profile.email}</span> cannot be changed
                here - contact support.
              </p>
              <Button type="submit" loading={savingProfile}>
                Save changes
              </Button>
            </div>
          </Card>
        </form>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-lime font-mono text-[15px] font-semibold text-ink-950">
                {profile.initials || initialsOf(profile.fullName)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-white">{profile.fullName}</p>
                <p className="truncate text-[12.5px] text-mist-400">{profile.email}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StatusBadge status={profile.active ? 'AVAILABLE' : 'RETIRED'} kind="vehicle" />
              <span className="badge badge-neutral">{profile.role?.replace('_', ' ')}</span>
            </div>

            <dl className="mt-5 space-y-3 border-t border-white/[0.06] pt-5">
              <DetailRow label="Member since" value={formatDateTime(profile.createdAt)} />
              <DetailRow
                label="Last sign-in"
                value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : 'This session'}
              />
              <DetailRow label="Account status" value={profile.active ? 'Active' : 'Deactivated'} />
            </dl>
          </Card>

          <form onSubmit={savePassword}>
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <Icon name="lock" size={18} className="text-lime" />
                <h2 className="font-display text-[16px] font-semibold text-white">Change password</h2>
              </div>

              <div className="mt-5 space-y-4">
                <Field label="Current password" htmlFor="current-password" required error={passwordErrors.currentPassword}>
                  <input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    className="input"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, currentPassword: event.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="New password"
                  htmlFor="new-password"
                  required
                  error={passwordErrors.newPassword}
                  hint="At least 8 characters with a number."
                >
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, newPassword: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Confirm new password" htmlFor="confirm-password" required error={passwordErrors.confirm}>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    className="input"
                    value={passwords.confirm}
                    onChange={(event) =>
                      setPasswords((current) => ({ ...current, confirm: event.target.value }))
                    }
                  />
                </Field>
              </div>

              <Button type="submit" className="mt-5 w-full" loading={savingPassword}>
                Update password
              </Button>
              <p className="mt-3 text-[12px] leading-relaxed text-mist-500">
                Changing your password signs out every other device.
              </p>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
