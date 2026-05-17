# Next.js Copilot Instructions

## Framework

Next.js with App Router and TypeScript.

## Rules

- Use App Router (app/) not Pages Router (pages/).
- Server Components by default — add 'use client' only when needed (state, effects, browser APIs).
- Use Server Actions for form submissions and mutations.
- Fetch data in Server Components with async/await, not useEffect.
- Use next/image for images, next/link for navigation, next/font for fonts.
- Route handlers go in app/api/route.ts files.
- Loading states via loading.tsx, error boundaries via error.tsx.
- Use generateMetadata for SEO.
- Environment variables: NEXT*PUBLIC* prefix for client-side, no prefix for server-only.
- CSS: Tailwind CSS or CSS Modules, no global styles in components.

## API Integration

The API backend runs on port 3000. Proxy configured in next.config.ts.
Use relative URLs for API calls: `fetch('/api/users')`.
