import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Skeleton,
  StatusBadge,
  Tabs,
} from '../../components/ui/primitives.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { createStaffUser, listUsers, setUserStatus } from '../../api/auth.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatDateTime, initialsOf } from '../../utils/format.js';
import { ROLE_LABELS, STAFF_ROLES } from '../../utils/constants.js';

const ROLE_TABS = [
  { key: 'ALL', label: 'Everyone' },
  { key: 'CUSTOMER', label: 'Customers' },
  { key: 'FLEET_MANAGER', label: 'Fleet managers' },
  { key: 'ADMIN', label: 'Admins' },
];

const ROLE_TONES = {
  ADMIN: 'border-lime/40 bg-lime/[0.1] text-lime',
  FLEET_MANAGER: 'border-ice/35 bg-ice/[0.1] text-ice',
  CUSTOMER: 'border-white/12 bg-white/[0.05] text-mist-300',
};

const EMPTY_STAFF = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'FLEET_MANAGER',
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [role, setRole] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [staff, setStaff] = useState(EMPTY_STAFF);
  const [staffErrors, setStaffErrors] = useState({});
  const [savingStaff, setSavingStaff] = useState(false);

  const [statusTarget, setStatusTarget] = useState(null);
  const [statusReason, setStatusReason] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 400);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listUsers({ role: role === 'ALL' ? undefined : role, search: debouncedSearch || undefined, page, size: 12, sort: 'createdAt,desc' })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [role, debouncedSearch, page]);

  useEffect(load, [load]);

  const submitStaff = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email)) errors.email = 'Enter a valid email address.';
    if (staff.password.length < 8) errors.password = 'Use at least 8 characters.';
    if (!staff.firstName.trim()) errors.firstName = 'First name is required.';
    if (!staff.lastName.trim()) errors.lastName = 'Last name is required.';
    setStaffErrors(errors);
    if (Object.keys(errors).length) return;

    setSavingStaff(true);
    try {
      const created = await createStaffUser({
        email: staff.email.trim().toLowerCase(),
        password: staff.password,
        firstName: staff.firstName.trim(),
        lastName: staff.lastName.trim(),
        phone: staff.phone.trim() || undefined,
        role: staff.role,
      });
      toast.success('Account created', `${created.fullName} can now sign in as ${staff.role.replace('_', ' ').toLowerCase()}.`);
      setInviteOpen(false);
      setStaff(EMPTY_STAFF);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setStaffErrors(apiError.fieldErrors || {});
      toast.error(
        apiError.code === 'EMAIL_ALREADY_REGISTERED' ? 'Email already registered' : 'Could not create the account',
        apiError.message,
      );
    } finally {
      setSavingStaff(false);
    }
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    const nextActive = !statusTarget.active;
    if (!nextActive && statusReason.trim().length < 3) {
      toast.warn('Add a reason', 'Deactivating an account is recorded in the audit log.');
      return;
    }
    setSavingStatus(true);
    try {
      await setUserStatus(statusTarget.id, {
        active: nextActive,
        reason: statusReason.trim() || undefined,
      });
      toast.success(
        nextActive ? 'Account reactivated' : 'Account deactivated',
        nextActive
          ? `${statusTarget.fullName} can sign in again.`
          : `${statusTarget.fullName} can no longer sign in.`,
      );
      setStatusTarget(null);
      setStatusReason('');
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not change the account', apiError.message);
    } finally {
      setSavingStatus(false);
    }
  };

  const users = result?.content || [];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Access</p>
          <h1 className="display-md mt-3">User management</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Customers self-register; fleet managers and admins are created here. Deactivating an
            account blocks sign-in immediately and is written to the audit trail.
          </p>
        </div>
        <Button icon="plus" onClick={() => setInviteOpen(true)}>
          Create staff account
        </Button>
      </header>

      <div className="surface flex flex-wrap items-end gap-4 p-5">
        <Input
          className="min-w-[240px] flex-1"
          label="Search"
          placeholder="Name, email or phone"
          prefixIcon="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <p className="ml-auto pb-2 text-[12.5px] text-mist-400">
          {loading ? 'Loading…' : `${result?.totalElements || 0} accounts`}
        </p>
      </div>

      <Tabs tabs={ROLE_TABS} activeKey={role} onChange={(key) => { setRole(key); setPage(0); }} className="w-fit max-w-full" />

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[84px]" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="users"
            title="No accounts match"
            description="Try a different role or search term."
          />
        </div>
      ) : (
        <>
          <div className="table-shell">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Account</th>
                    <th scope="col">Role</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Last sign-in</th>
                    <th scope="col">State</th>
                    <th scope="col" className="w-40">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((account) => {
                    const isSelf = account.id === currentUser?.id;
                    return (
                      <tr key={account.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-mono text-[11px] text-mist-200">
                              {account.initials || initialsOf(account.fullName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13.5px] text-white">{account.fullName}</p>
                              <p className="truncate font-mono text-[10.5px] text-mist-500">
                                #{account.id} {account.licenseNo ? `· ${account.licenseNo}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${ROLE_TONES[account.role] || 'badge-neutral'}`}>
                            {ROLE_LABELS[account.role] || account.role}
                          </span>
                        </td>
                        <td>
                          <p className="text-[12.5px] text-mist-300">{account.email}</p>
                          <p className="mt-0.5 text-[12px] text-mist-500">
                            {account.phone || 'No phone'}
                            {account.city ? ` · ${account.city}` : ''}
                          </p>
                        </td>
                        <td className="text-[12.5px] text-mist-400">{formatDateTime(account.createdAt)}</td>
                        <td className="text-[12.5px] text-mist-400">
                          {account.lastLoginAt ? formatDateTime(account.lastLoginAt) : 'Never'}
                        </td>
                        <td>
                          <StatusBadge status={account.active ? 'AVAILABLE' : 'RETIRED'} kind="vehicle" />
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {isSelf ? (
                              <span className="text-[11.5px] text-mist-500">This is you</span>
                            ) : (
                              <Button
                                size="sm"
                                variant={account.active ? 'danger' : 'ghost'}
                                icon={account.active ? 'lock' : 'check'}
                                onClick={() => {
                                  setStatusTarget(account);
                                  setStatusReason('');
                                }}
                              >
                                {account.active ? 'Deactivate' : 'Activate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      {/* Create staff */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        size="lg"
        title="Create a staff account"
        description="Staff accounts skip self-registration and are trusted with console access immediately."
      >
        <form onSubmit={submitStaff} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              required
              value={staff.firstName}
              error={staffErrors.firstName}
              onChange={(event) => setStaff((current) => ({ ...current, firstName: event.target.value }))}
            />
            <Input
              label="Last name"
              required
              value={staff.lastName}
              error={staffErrors.lastName}
              onChange={(event) => setStaff((current) => ({ ...current, lastName: event.target.value }))}
            />
          </div>

          <Input
            label="Work email"
            type="email"
            required
            value={staff.email}
            error={staffErrors.email}
            onChange={(event) => setStaff((current) => ({ ...current, email: event.target.value }))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Temporary password"
              type="password"
              required
              autoComplete="new-password"
              value={staff.password}
              error={staffErrors.password}
              hint="They can change it from their profile."
              onChange={(event) => setStaff((current) => ({ ...current, password: event.target.value }))}
            />
            <Input
              label="Phone"
              type="tel"
              value={staff.phone}
              error={staffErrors.phone}
              onChange={(event) => setStaff((current) => ({ ...current, phone: event.target.value }))}
            />
          </div>

          <Field label="Role" htmlFor="staff-role" required>
            <div className="grid gap-3 sm:grid-cols-2">
              {STAFF_ROLES.map((value) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    staff.role === value
                      ? 'border-lime/50 bg-lime/[0.07]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff-role"
                    className="sr-only"
                    value={value}
                    checked={staff.role === value}
                    onChange={() => setStaff((current) => ({ ...current, role: value }))}
                  />
                  <Icon name={value === 'ADMIN' ? 'shield' : 'wrench'} size={16} className={staff.role === value ? 'text-lime' : 'text-mist-400'} />
                  <span className="text-[13.5px] text-mist-100">
                    {value === 'ADMIN' ? 'Administrator' : 'Fleet manager'}
                  </span>
                </label>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingStaff}>
              Create account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Activate / deactivate */}
      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={confirmStatus}
        title={
          statusTarget?.active
            ? `Deactivate ${statusTarget?.fullName}?`
            : `Reactivate ${statusTarget?.fullName}?`
        }
        description={
          statusTarget?.active
            ? 'They will be signed out and cannot sign in again until an admin reactivates the account. Existing bookings are untouched.'
            : 'The account can sign in again immediately with its existing credentials.'
        }
        confirmLabel={statusTarget?.active ? 'Deactivate' : 'Reactivate'}
        loading={savingStatus}
      >
        {statusTarget?.active && (
          <Field label="Reason" htmlFor="user-status-reason" required>
            <input
              id="user-status-reason"
              className="input"
              value={statusReason}
              onChange={(event) => setStatusReason(event.target.value)}
              placeholder="Fraudulent activity, duplicate account, requested deletion…"
            />
          </Field>
        )}
      </ConfirmDialog>
    </div>
  );
}
