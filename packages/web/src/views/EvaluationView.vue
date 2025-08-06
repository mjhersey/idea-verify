<template>
  <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Business Idea Evaluation</h1>

      <div class="bg-white shadow rounded-lg p-6">
        <p class="text-gray-600 mb-4">
          Enter your business idea details to get AI-powered analysis and insights.
        </p>

        <form class="space-y-6">
          <div>
            <label for="idea" class="block text-sm font-medium text-gray-700">
              Business Idea Description
            </label>
            <textarea
              id="idea"
              rows="4"
              class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Describe your business idea..."
            ></textarea>
          </div>

          <div>
            <button
              type="submit"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Analyze Business Idea
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Business idea evaluation component
</script>
