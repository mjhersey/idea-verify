<template>
  <AppLayout>
    <div class="max-w-4xl mx-auto">
      <!-- Hero Section -->
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
          Validate Your Business Ideas
        </h1>
        <p class="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
          Get AI-powered insights and market research to evaluate your business concept
          before you invest time and money.
        </p>
      </div>
      
      <!-- Main Content -->
      <div class="grid md:grid-cols-2 gap-8 items-start">
        <!-- Idea Submission Form -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h2 class="text-2xl font-semibold text-gray-900 mb-4">
            Submit Your Business Idea
          </h2>
          <p class="text-gray-600 mb-6">
            Describe your business idea and get comprehensive AI analysis including
            market research, competitive landscape, and viability assessment.
          </p>
          
          <IdeaInput />
        </div>
        
        <!-- Features/Benefits -->
        <div class="space-y-6">
          <div class="bg-white rounded-lg shadow-md p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">
              What You'll Get
            </h3>
            <ul class="space-y-3 text-gray-600">
              <li class="flex items-start">
                <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Market size and opportunity analysis
              </li>
              <li class="flex items-start">
                <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Competitive landscape overview
              </li>
              <li class="flex items-start">
                <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Business viability score (0-100)
              </li>
              <li class="flex items-start">
                <svg class="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
                Actionable recommendations
              </li>
            </ul>
          </div>
          
          <div class="bg-indigo-50 rounded-lg p-6">
            <h3 class="text-lg font-semibold text-indigo-900 mb-3">
              Quick Start
            </h3>
            <ol class="list-decimal list-inside space-y-2 text-indigo-800">
              <li>Describe your business idea (50-5000 characters)</li>
              <li>Submit for AI analysis</li>
              <li>Get your comprehensive evaluation report</li>
              <li>Access your results anytime from the dashboard</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/components/layout/AppLayout.vue'
import IdeaInput from '@/components/evaluation/IdeaInput.vue'
</script>