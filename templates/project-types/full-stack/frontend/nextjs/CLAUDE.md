# CLAUDE.md

## Framework

Next.js with App Router and TypeScript.

## Key Patterns

- Server Components by default, 'use client' only when needed
- Server Actions for mutations (form submissions, data changes)
- Fetch data in Server Components, not useEffect
- Use next/image, next/link, next/font

## API Integration

The API backend runs on port 3000. Proxy configured in next.config.ts.
Use relative URLs for API calls: `fetch('/api/users')`.

## Commands

| Command      | Description             |
| ------------ | ----------------------- |
| `pnpm dev`   | Start dev server        |
| `pnpm build` | Production build        |
| `pnpm start` | Start production server |
