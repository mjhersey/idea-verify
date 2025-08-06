/**
 * Router guards for authentication and authorization
 */

import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

/**
 * Authentication guard - requires user to be logged in
 */
export const authGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    // Store intended destination for redirect after login
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  } else {
    next()
  }
}

/**
 * Guest guard - redirects authenticated users away from auth pages
 */
export const guestGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  const authStore = useAuthStore()

  if (authStore.isAuthenticated) {
    // Redirect to dashboard if already authenticated
    next('/dashboard')
  } else {
    next()
  }
}

/**
 * Optional auth guard - sets user context if available but doesn't require authentication
 */
export const optionalAuthGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  // Always allow navigation, auth is optional
  next()
}

/**
 * Admin guard - requires admin role (for future use)
 */
export const adminGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  } else {
    // For now, all authenticated users are considered admins
    // In the future, check user.role === 'admin'
    next()
  }
}

/**
 * Route meta interface for TypeScript
 */
declare module 'vue-router' {
  // eslint-disable-next-line no-unused-vars
  interface RouteMeta {
    requiresAuth?: boolean
    requiresGuest?: boolean
    requiresAdmin?: boolean
    title?: string
  }
}

/**
 * Global navigation guard that checks route meta properties
 */
export const globalGuard = (
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): void => {
  const authStore = useAuthStore()

  // Set page title if provided in route meta
  if (to.meta.title) {
    document.title = `${to.meta.title} - AI Validation Platform`
  } else {
    document.title = 'AI Validation Platform'
  }

  // Check authentication requirements
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({
      path: '/login',
      query: { redirect: to.fullPath },
    })
    return
  }

  // Check guest requirements (redirect if authenticated)
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/dashboard')
    return
  }

  // Check admin requirements
  if (to.meta.requiresAdmin) {
    if (!authStore.isAuthenticated) {
      next({
        path: '/login',
        query: { redirect: to.fullPath },
      })
      return
    }
    // For now, all authenticated users have admin access
    // In the future, check user role here
  }

  next()
}
