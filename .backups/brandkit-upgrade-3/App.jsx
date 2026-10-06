import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AccessDenied from './pages/AccessDenied';
import BrandKit from './pages/BrandKit';
import Clients from './pages/Clients';
import Dashboard from './pages/Dashboard';
import Generate from './pages/Generate';
import Home from './pages/Home';
import HowItWorks from './pages/HowItWorks';
import Login from './pages/Login';
import Templates from './pages/Templates';
import Users from './pages/Users';

const History = React.lazy(() => import('./pages/History'));
const PosterStudioTest = React.lazy(() => import('./pages/PosterStudioTest'));

function PageFallback() {
  return (
    <div className="container-page section-pad space-y-6">
      <div className="pb-6 border-b border-line space-y-2">
        <div className="h-7 w-40 rounded bg-section animate-pulse" />
        <div className="h-3.5 w-64 rounded bg-section animate-pulse" />
      </div>
      <div className="h-10 w-full rounded-card bg-section animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="card-surface overflow-hidden">
            <div className="w-full bg-preview animate-pulse" style={{ aspectRatio: '0.8' }} />
            <div className="p-4 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-section animate-pulse" />
              <div className="h-2.5 w-1/3 rounded bg-section animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'var(--color-canvas)',
            color: 'var(--color-heading)',
            border: '1px solid var(--color-line)',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: 'var(--color-success)', secondary: 'var(--color-canvas)' } },
          error: { iconTheme: { primary: 'var(--color-danger)', secondary: 'var(--color-canvas)' } },
        }}
      />
      <div className="min-h-screen bg-canvas text-body flex flex-col font-sans">
        <Navbar />
        <main className="flex-1 w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Navigate to="/#pricing" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/access-denied" element={<ProtectedRoute><AccessDenied /></ProtectedRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['superadmin', 'clientadmin']}><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute allowedRoles={['superadmin']}><Clients /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute allowedRoles={['superadmin']}><Users /></ProtectedRoute>} />
            <Route path="/team" element={<ProtectedRoute allowedRoles={['clientadmin']}><Users /></ProtectedRoute>} />

            <Route path="/brand-kit" element={<ProtectedRoute allowedRoles={['superadmin', 'clientadmin']} requireActiveClient><BrandKit /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute allowedRoles={['superadmin', 'clientadmin']} requireActiveClient><Templates /></ProtectedRoute>} />
            <Route path="/create" element={<ProtectedRoute allowedRoles={['superadmin', 'clientadmin', 'user']} requireActiveClient><Generate /></ProtectedRoute>} />
            <Route
              path="/posters"
              element={
                <ProtectedRoute allowedRoles={['superadmin', 'clientadmin', 'user']} requireActiveClient>
                  <React.Suspense fallback={<PageFallback />}>
                    <History />
                  </React.Suspense>
                </ProtectedRoute>
              }
            />

            {import.meta.env.DEV ? (
              <Route
                path="/preview-test"
                element={
                  <React.Suspense fallback={<PageFallback />}>
                    <PosterStudioTest />
                  </React.Suspense>
                }
              />
            ) : null}

            <Route path="/history" element={<Navigate to="/posters" replace />} />
            <Route path="/generate" element={<Navigate to="/create" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
