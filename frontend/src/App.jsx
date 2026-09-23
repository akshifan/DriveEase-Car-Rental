import { Suspense, lazy, useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import {
  DashboardLayout,
  NotFoundPage,
  PublicLayout,
  RequireAuth,
  ScrollToTop,
} from './components/layout/Layouts.jsx';
import Toaster from './components/ui/Toaster.jsx';
import { Spinner } from './components/ui/primitives.jsx';
import { destroySmoothScroll, initSmoothScroll, refreshScrollTriggers } from './animations/index.js';
import { ROLES } from './utils/constants.js';

// The landing page ships in the entry chunk; everything else is split.
import HomePage from './pages/public/HomePage.jsx';

const FleetPage = lazy(() => import('./pages/public/FleetPage.jsx'));
const VehicleDetailPage = lazy(() => import('./pages/public/VehicleDetailPage.jsx'));
const SupportPage = lazy(() => import('./pages/public/SupportPage.jsx'));

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage.jsx'));

const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard.jsx'));
const BookingsPage = lazy(() => import('./pages/customer/BookingsPage.jsx'));
const BookingDetailPage = lazy(() => import('./pages/customer/BookingDetailPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/customer/CheckoutPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/customer/PaymentsPage.jsx'));
const ReceiptPage = lazy(() => import('./pages/customer/ReceiptPage.jsx'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage.jsx'));
const NotificationsPage = lazy(() => import('./pages/customer/NotificationsPage.jsx'));

const FleetDashboard = lazy(() => import('./pages/console/FleetDashboard.jsx'));
const FleetBookings = lazy(() => import('./pages/console/FleetBookings.jsx'));
const FleetVehicles = lazy(() => import('./pages/console/FleetVehicles.jsx'));
const FleetMaintenance = lazy(() => import('./pages/console/FleetMaintenance.jsx'));
const FleetDamage = lazy(() => import('./pages/console/FleetDamage.jsx'));
const VehicleHistoryPage = lazy(() => import('./pages/console/VehicleHistoryPage.jsx'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.jsx'));
const AdminVehicles = lazy(() => import('./pages/admin/AdminVehicles.jsx'));
const AdminBookings = lazy(() => import('./pages/admin/AdminBookings.jsx'));
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments.jsx'));
const AdminReviews = lazy(() => import('./pages/admin/AdminReviews.jsx'));
const AdminReports = lazy(() => import('./pages/admin/AdminReports.jsx'));

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 text-mist-400">
        <Spinner size={18} />
        <span className="text-[14px]">Loading…</span>
      </div>
    </div>
  );
}

export default function App() {
  /**
   * Smooth scrolling is initialised once for the app's lifetime. It is a no-op
   * when the visitor prefers reduced motion.
   */
  useEffect(() => {
    initSmoothScroll();
    const refresh = () => refreshScrollTriggers();
    window.addEventListener('load', refresh);
    return () => {
      window.removeEventListener('load', refresh);
      destroySmoothScroll();
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="fleet" element={<FleetPage />} />
            <Route path="fleet/:vehicleId" element={<VehicleDetailPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route
            element={
              <RequireAuth>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
            <Route path="checkout/:bookingId" element={<CheckoutPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="payments/:paymentId" element={<ReceiptPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="dashboard/notifications" element={<NotificationsPage />} />
          </Route>

          <Route
            element={
              <RequireAuth roles={[ROLES.FLEET_MANAGER, ROLES.ADMIN]}>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="console" element={<FleetDashboard />} />
            <Route path="console/bookings" element={<FleetBookings />} />
            <Route path="console/vehicles" element={<FleetVehicles />} />
            <Route path="console/vehicles/:vehicleId/history" element={<VehicleHistoryPage />} />
            <Route path="console/maintenance" element={<FleetMaintenance />} />
            <Route path="console/damage" element={<FleetDamage />} />
          </Route>

          <Route
            element={
              <RequireAuth roles={[ROLES.ADMIN]}>
                <DashboardLayout />
              </RequireAuth>
            }
          >
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/users" element={<AdminUsers />} />
            <Route path="admin/vehicles" element={<AdminVehicles />} />
            <Route path="admin/bookings" element={<AdminBookings />} />
            <Route path="admin/payments" element={<AdminPayments />} />
            <Route path="admin/reviews" element={<AdminReviews />} />
            <Route path="admin/reports" element={<AdminReports />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
