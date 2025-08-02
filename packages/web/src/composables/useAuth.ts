/**
 * Authentication composable for reusable auth logic
 */

import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import type { RegistrationData, LoginData, ProfileUpdateData } from '../services/auth.js';

export function useAuth() {
  const authStore = useAuthStore();
  const router = useRouter();
  const route = useRoute();

  // Local loading states for specific operations
  const isRegistering = ref(false);
  const isLoggingIn = ref(false);
  const isLoggingOut = ref(false);

  // Computed properties
  const user = computed(() => authStore.user);
  const isAuthenticated = computed(() => authStore.isAuthenticated);
  const isLoading = computed(() => authStore.isLoading);
  const error = computed(() => authStore.error);

  // Register new user
  const register = async (data: RegistrationData) => {
    isRegistering.value = true;

    try {
      await authStore.register(data);
      
      // Redirect to dashboard or intended route after registration
      const redirectTo = (route.query.redirect as string) || '/dashboard';
      await router.push(redirectTo);
      
    } finally {
      isRegistering.value = false;
    }
  };

  // Login user
  const login = async (data: LoginData) => {
    isLoggingIn.value = true;

    try {
      await authStore.login(data);
      
      // Redirect to dashboard or intended route after login
      const redirectTo = (route.query.redirect as string) || '/dashboard';
      await router.push(redirectTo);
      
    } finally {
      isLoggingIn.value = false;
    }
  };

  // Logout user
  const logout = async () => {
    isLoggingOut.value = true;

    try {
      await authStore.logout();
      
      // Redirect to home page after logout
      await router.push('/');
      
    } finally {
      isLoggingOut.value = false;
    }
  };

  // Update user profile
  const updateProfile = async (data: ProfileUpdateData) => {
    await authStore.updateProfile(data);
  };

  // Require authentication - redirect to login if not authenticated
  const requireAuth = () => {
    if (!isAuthenticated.value) {
      router.push({
        path: '/login',
        query: { redirect: route.fullPath }
      });
      return false;
    }
    return true;
  };

  // Redirect if already authenticated
  const redirectIfAuthenticated = (redirectTo: string = '/dashboard') => {
    if (isAuthenticated.value) {
      router.push(redirectTo);
      return true;
    }
    return false;
  };

  // Clear error state
  const clearError = () => {
    authStore.clearError();
  };

  // Initialize auth on app start
  const initializeAuth = async () => {
    try {
      await authStore.initializeAuth();
    } catch {
      // Auth initialization failed - handled by store
    }
  };

  // Form validation helpers
  const validateEmail = (email: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required';
    }
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const validatePassword = (password: string): string | null => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?]/.test(password)) {
      return 'Password must contain at least one special character';
    }
    return null;
  };

  const validateName = (name: string): string | null => {
    if (!name) {
      return 'Name is required';
    }
    if (name.length < 2) {
      return 'Name must be at least 2 characters long';
    }
    if (name.length > 50) {
      return 'Name must be less than 50 characters long';
    }
    return null;
  };

  const validateConfirmPassword = (password: string, confirmPassword: string): string | null => {
    if (!confirmPassword) {
      return 'Please confirm your password';
    }
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  };

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    isRegistering,
    isLoggingIn,
    isLoggingOut,

    // Actions
    register,
    login,
    logout,
    updateProfile,
    requireAuth,
    redirectIfAuthenticated,
    clearError,
    initializeAuth,

    // Validation helpers
    validateEmail,
    validatePassword,
    validateName,
    validateConfirmPassword
  };
}