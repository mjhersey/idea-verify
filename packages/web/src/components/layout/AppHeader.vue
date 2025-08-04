<template>
  <header class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <div class="flex items-center">
          <router-link to="/" class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">
              AI Validation
            </h1>
          </router-link>
        </div>
        
        <nav class="hidden md:flex space-x-8">
          <router-link
            to="/"
            class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-gray-900 bg-gray-100': $route.path === '/' }"
          >
            Home
          </router-link>
          <router-link
            to="/dashboard"
            v-if="authStore.isAuthenticated"
            class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            :class="{ 'text-gray-900 bg-gray-100': $route.path === '/dashboard' }"
          >
            Dashboard
          </router-link>
        </nav>
        
        <div class="flex items-center space-x-4">
          <template v-if="authStore.isAuthenticated">
            <span class="text-sm text-gray-700">
              Welcome, {{ authStore.user?.name || authStore.user?.email }}
            </span>
            <button
              @click="handleLogout"
              class="bg-gray-800 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
            >
              Logout
            </button>
          </template>
          <template v-else>
            <router-link
              to="/login"
              class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
            >
              Login
            </router-link>
            <router-link
              to="/register"
              class="bg-indigo-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Sign Up
            </router-link>
          </template>
        </div>
        
        <!-- Mobile menu button -->
        <div class="md:hidden">
          <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="bg-gray-50 p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <span class="sr-only">Open main menu</span>
            <svg
              class="h-6 w-6"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Mobile menu -->
      <div v-if="mobileMenuOpen" class="md:hidden">
        <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          <router-link
            to="/"
            class="text-gray-500 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
            @click="mobileMenuOpen = false"
          >
            Home
          </router-link>
          <router-link
            to="/dashboard"
            v-if="authStore.isAuthenticated"
            class="text-gray-500 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
            @click="mobileMenuOpen = false"
          >
            Dashboard
          </router-link>
          <template v-if="!authStore.isAuthenticated">
            <router-link
              to="/login"
              class="text-gray-500 hover:text-gray-900 block px-3 py-2 rounded-md text-base font-medium"
              @click="mobileMenuOpen = false"
            >
              Login
            </router-link>
            <router-link
              to="/register"
              class="bg-indigo-600 text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-indigo-700"
              @click="mobileMenuOpen = false"
            >
              Sign Up
            </router-link>
          </template>
          <template v-else>
            <button
              @click="handleLogout"
              class="text-gray-500 hover:text-gray-900 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
            >
              Logout
            </button>
          </template>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const mobileMenuOpen = ref(false)

const handleLogout = async () => {
  await authStore.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}
</script>