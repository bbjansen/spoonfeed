# CLAUDE.md

## Framework

React with Vite and TypeScript.

## Key Patterns

- Functional components with hooks
- Custom hooks for shared logic
- React.lazy for code splitting

## API Integration

Proxy configured in vite.config.ts.
Use relative URLs: `fetch('/api/users')`.

## Commands

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Production build         |
| `pnpm preview` | Preview production build |
