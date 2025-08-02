<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <!-- Header -->
      <div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Create your account
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Or
          <router-link
            to="/login"
            class="font-medium text-indigo-600 hover:text-indigo-500"
          >
            sign in to your existing account
          </router-link>
        </p>
      </div>

      <!-- Error Alert -->
      <div v-if="error" class="bg-red-50 border border-red-200 rounded-md p-4">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <p class="text-sm text-red-800">{{ error }}</p>
          </div>
          <div class="ml-auto pl-3">
            <button
              class="inline-flex text-red-400 hover:text-red-600"
              @click="clearError"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Form -->
      <form class="mt-8 space-y-6" @submit.prevent="handleSubmit">
        <div class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              id="name"
              v-model="form.name"
              name="name"
              type="text"
              autocomplete="name"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': nameError }"
              placeholder="Enter your full name"
            />
            <p v-if="nameError" class="mt-1 text-sm text-red-600">{{ nameError }}</p>
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              id="email"
              v-model="form.email"
              name="email"
              type="email"
              autocomplete="email"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': emailError }"
              placeholder="Enter your email address"
            />
            <p v-if="emailError" class="mt-1 text-sm text-red-600">{{ emailError }}</p>
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              v-model="form.password"
              name="password"
              type="password"
              autocomplete="new-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': passwordError }"
              placeholder="Create a strong password"
            />
            <p v-if="passwordError" class="mt-1 text-sm text-red-600">{{ passwordError }}</p>
            
            <!-- Password Requirements -->
            <div class="mt-2 text-xs text-gray-600">
              <p>Password must contain:</p>
              <ul class="mt-1 space-y-1">
                <li :class="{ 'text-green-600': form.password.length >= 8 }">• At least 8 characters</li>
                <li :class="{ 'text-green-600': /[A-Z]/.test(form.password) }">• One uppercase letter</li>
                <li :class="{ 'text-green-600': /[a-z]/.test(form.password) }">• One lowercase letter</li>
                <li :class="{ 'text-green-600': /\d/.test(form.password) }">• One number</li>
                <li :class="{ 'text-green-600': /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(form.password) }">• One special character</li>
              </ul>
            </div>
          </div>

          <div>
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input
              id="confirmPassword"
              v-model="form.confirmPassword"
              name="confirmPassword"
              type="password"
              autocomplete="new-password"
              required
              class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              :class="{ 'border-red-300': confirmPasswordError }"
              placeholder="Confirm your password"
            />
            <p v-if="confirmPasswordError" class="mt-1 text-sm text-red-600">{{ confirmPasswordError }}</p>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="isRegistering || !isFormValid"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isRegistering" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
            {{ isRegistering ? 'Creating account...' : 'Create account' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useAuth } from '../composables/useAuth.js';

// Auth composable
const {
  register,
  error,
  isRegistering,
  clearError,
  validateEmail,
  validatePassword,
  validateName,
  validateConfirmPassword,
  redirectIfAuthenticated
} = useAuth();

// Form data
const form = ref({
  name: '',
  email: '',
  password: '',
  confirmPassword: ''
});

// Form validation
const nameError = computed(() => form.value.name ? validateName(form.value.name) : null);
const emailError = computed(() => form.value.email ? validateEmail(form.value.email) : null);
const passwordError = computed(() => form.value.password ? validatePassword(form.value.password) : null);
const confirmPasswordError = computed(() => 
  form.value.confirmPassword ? validateConfirmPassword(form.value.password, form.value.confirmPassword) : null
);

const isFormValid = computed(() => 
  !nameError.value && 
  !emailError.value && 
  !passwordError.value && 
  !confirmPasswordError.value &&
  form.value.name && 
  form.value.email && 
  form.value.password && 
  form.value.confirmPassword
);

// Handle form submission
const handleSubmit = async () => {
  if (!isFormValid.value) {
    return;
  }

  try {
    await register({
      name: form.value.name,
      email: form.value.email,
      password: form.value.password
    });
  } catch (err) {
    // Error is handled by the auth store and displayed in the template
    // eslint-disable-next-line no-console
    console.error('Registration failed:', err);
  }
};

// Redirect if already authenticated
onMounted(() => {
  redirectIfAuthenticated();
});
</script>