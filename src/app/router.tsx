import { createBrowserRouter, Navigate } from 'react-router-dom'
import AnalysisRoute from '../components/analysis/AnalysisRoute'
import AuthGuard from '../components/auth/AuthGuard'
import ForgotPasswordPage from '../components/auth/ForgotPasswordPage'
import HouseholdSetupPage from '../components/auth/HouseholdSetupPage'
import LoginPage from '../components/auth/LoginPage'
import ResetPasswordPage from '../components/auth/ResetPasswordPage'
import SignUpPage from '../components/auth/SignUpPage'
import BetsRoute from '../components/bets/BetsRoute'
import AnimationTestPage from '../components/dev/AnimationTestPage'
import AnimateImprovementsPage from '../components/dev/AnimateImprovementsPage'
import AppleImprovementsPage from '../components/dev/AppleImprovementsPage'
import EmilImprovementsPage from '../components/dev/EmilImprovementsPage'
import GptTasteImprovementsPage from '../components/dev/GptTasteImprovementsPage'
import HighEndImprovementsPage from '../components/dev/HighEndImprovementsPage'
import ImagegenMobileImprovementsPage from '../components/dev/ImagegenMobileImprovementsPage'
import CategoryPickerTestPage from '../components/dev/CategoryPickerTestPage'
import DevIndexPage from '../components/dev/DevIndexPage'
import AppShell from '../components/layout/AppShell'
import DesktopAwareHome from '../components/layout/DesktopAwareHome'
import RevealRoute from '../components/reveal/RevealRoute'
import SettingsPage from '../components/settings/SettingsPage'
import SwipeDeck from '../components/swipe/SwipeDeck'
import UploadPage from '../components/upload/UploadPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppShell />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DesktopAwareHome /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'classify/no-idea', element: <SwipeDeck /> },
      { path: 'classify', element: <SwipeDeck /> },
      { path: 'reveal', element: <RevealRoute /> },
      { path: 'analysis', element: <AnalysisRoute /> },
      { path: 'bets', element: <BetsRoute /> },
      { path: 'settings', element: <SettingsPage /> },
      ...(import.meta.env.DEV
        ? [{ path: 'dev/category-picker', element: <CategoryPickerTestPage /> }]
        : []),
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
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  ...(import.meta.env.DEV
    ? [{
        path: '/dev',
        element: (
          <AuthGuard requireHousehold={false}>
            <DevIndexPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/animations',
        element: (
          <AuthGuard requireHousehold={false}>
            <AnimationTestPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/emil-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <EmilImprovementsPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/apple-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <AppleImprovementsPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/animate-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <AnimateImprovementsPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/gpt-taste-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <GptTasteImprovementsPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/high-end-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <HighEndImprovementsPage />
          </AuthGuard>
        ),
      }, {
        path: '/dev/imagegen-mobile-improvements',
        element: (
          <AuthGuard requireHousehold={false}>
            <ImagegenMobileImprovementsPage />
          </AuthGuard>
        ),
      }]
    : []),
  { path: '*', element: <Navigate to="/" replace /> },
])
