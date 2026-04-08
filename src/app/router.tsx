import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import AuthGuard from '../components/auth/AuthGuard'
import LoginPage from '../components/auth/LoginPage'
import SignUpPage from '../components/auth/SignUpPage'
import HouseholdSetupPage from '../components/auth/HouseholdSetupPage'
import HomePage from '../components/home/HomePage'
import UploadPage from '../components/upload/UploadPage'
import SwipeDeck from '../components/swipe/SwipeDeck'
import RevealPage from '../components/reveal/RevealPage'
import BetsPage from '../components/bets/BetsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'classify', element: <SwipeDeck /> },
      { path: 'reveal', element: <RevealPage /> },
      { path: 'bets', element: <BetsPage /> },
    ],
  },
  {
    path: '/household',
    element: (
      <AuthGuard requireHousehold={false}>
        <HouseholdSetupPage />
      </AuthGuard>
    ),
  },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignUpPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
])
