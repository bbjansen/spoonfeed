# CLAUDE.md

## Framework

Nuxt 3 with Vue 3 Composition API and TypeScript.

## Key Patterns

- <script setup> with Composition API
- Auto-imports (ref, computed, useFetch, etc.)
- File-based routing in pages/
- useFetch for SSR-aware data fetching

## API Integration

Proxy configured in nuxt.config.ts via nitro.devProxy.
Use relative URLs: `useFetch('/api/users')`.

## Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Production build         |
| `pnpm preview` | Preview production build |
