import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { LoginPage } from '../pages/LoginPage';
import { AssetsPage } from '../pages/AssetsPage';
import { TasksPage } from '../pages/TasksPage';
import { AgentsPage } from '../pages/AgentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { useAuthStore } from '../stores/authStore';
import React from 'react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/assets" replace /> },
      { path: 'assets', element: <AssetsPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
]);
