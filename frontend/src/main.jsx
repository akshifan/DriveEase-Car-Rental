import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { BookingProvider } from './context/BookingContext.jsx';
import './styles/index.css';

/**
 * Application entry point.
 *
 * Provider order matters: toasts are outermost so every other provider can
 * raise one, then auth (it needs to report session problems), then the booking
 * draft state consumed by the search -> checkout flow.
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <BookingProvider>
            <App />
          </BookingProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
