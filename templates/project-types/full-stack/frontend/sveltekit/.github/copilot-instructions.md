# SvelteKit Copilot Instructions

## Framework

SvelteKit with Svelte 5 and TypeScript.

## Rules

- Use Svelte 5 runes ($state, $derived, $effect) not legacy reactive declarations.
- File-based routing in src/routes/.
- +page.svelte for pages, +layout.svelte for layouts.
- +page.server.ts for server-side load functions and form actions.
- +page.ts for universal load functions.
- Use form actions for mutations, not API routes.
- Stores for shared state ($app/stores).
- Error handling via +error.svelte.
- Loading states via +page.ts load function.
- Environment variables: $env/static/private and $env/static/public.
- Use enhance for progressive enhancement of forms.

## API Integration

Proxy configured in vite.config.ts.
Use relative URLs in load functions: `fetch('/api/users')`.
