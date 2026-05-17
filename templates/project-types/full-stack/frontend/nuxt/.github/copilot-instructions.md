# Nuxt 3 Copilot Instructions

## Framework

Nuxt 3 with Vue 3 Composition API and TypeScript.

## Rules

- Use Composition API with `<script setup>`, not Options API.
- Auto-imports enabled — no need to import ref, computed, onMounted, etc.
- File-based routing in pages/ directory.
- Server routes in server/api/ for BFF patterns.
- Use useFetch/useAsyncData for data fetching (SSR-aware).
- Pinia for state management.
- Components auto-imported from components/ directory.
- Layouts in layouts/ directory.
- Middleware in middleware/ for route guards.
- Runtime config via useRuntimeConfig() for env vars.
- Use NuxtLink for navigation, not `<a>` tags.
- Composables in composables/ directory for shared logic.

## API Integration

Proxy configured in nuxt.config.ts via nitro.devProxy.
Use relative URLs: `useFetch('/api/users')`.
