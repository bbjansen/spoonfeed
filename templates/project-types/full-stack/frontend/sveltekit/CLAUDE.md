# CLAUDE.md

## Framework

SvelteKit with Svelte 5 and TypeScript.

## Key Patterns

- Svelte 5 runes ($state, $derived, $effect)
- File-based routing in src/routes/
- +page.server.ts for server load and form actions
- Progressive enhancement with enhance

## API Integration

Proxy configured in vite.config.ts.
Use relative URLs in load functions: `fetch('/api/users')`.

## Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Production build         |
| `pnpm preview` | Preview production build |
