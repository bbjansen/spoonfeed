# Full-Stack Project Type

## When to Use

Choose `full-stack` when you need a backend API and frontend application in a single repository with shared types and coordinated development. Best for teams that own both layers and want a unified dev experience, shared type safety, and simplified deployment.

## Frontend Framework Options

The scaffolder supports four frontend frameworks:

| Framework  | Directory  | Dev Port | Strengths                           |
| ---------- | ---------- | -------- | ----------------------------------- |
| Next.js    | `apps/web` | 3001     | SSR, RSC, file-based routing, React |
| Vite React | `apps/web` | 5173     | Fast HMR, SPA, lightweight          |
| Nuxt       | `apps/web` | 3001     | SSR, Vue ecosystem, auto-imports    |
| SvelteKit  | `apps/web` | 5173     | Compiled, small bundles, full-stack |

### Project Structure

```
my-app/
  apps/
    api/                     # NestJS backend
      src/
      package.json
    web/                     # Frontend (Next.js / Vite / Nuxt / SvelteKit)
      src/
      package.json
  libs/
    shared-types/            # Shared TypeScript types
      src/
        index.ts
        models/
          user.ts
          order.ts
        api/
          requests.ts
          responses.ts
      package.json
  package.json               # Workspace root
  pnpm-workspace.yaml
```

## Shared Types Library

The `libs/shared-types` package provides type definitions used by both the API and frontend, ensuring request/response contracts stay in sync.

### Defining Shared Types

```typescript
// libs/shared-types/src/models/order.ts
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered';
```

```typescript
// libs/shared-types/src/api/requests.ts
export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[];
}

// libs/shared-types/src/api/responses.ts
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### Using in the API

```typescript
import { Order, CreateOrderRequest } from '@my-app/shared-types';

@Controller('orders')
export class OrderController {
  @Post()
  create(@Body() dto: CreateOrderRequest): Promise<Order> {
    return this.orderService.create(dto);
  }
}
```

### Using in the Frontend

```typescript
import type { Order, PaginatedResponse } from '@my-app/shared-types';

async function fetchOrders(page: number): Promise<PaginatedResponse<Order>> {
  const res = await fetch(`/api/orders?page=${page}`);
  return res.json();
}
```

## Proxy Configuration for Development

During development, the frontend dev server proxies API requests to the backend to avoid CORS issues and simulate production routing.

### Vite (vite.config.ts)

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### Next.js (next.config.js)

```javascript
module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
};
```

### Concurrent Development

The root `package.json` includes scripts to start both apps:

```json
{
  "scripts": {
    "dev": "concurrently \"pnpm --filter api start:dev\" \"pnpm --filter web dev\"",
    "build": "pnpm --filter shared-types build && pnpm --filter api build && pnpm --filter web build",
    "test": "pnpm -r test"
  }
}
```

```bash
# Start both API and frontend
pnpm dev
```

## Deployment Strategies

### Strategy 1: Separate Deployments

Deploy the API and frontend independently. Best for scaling each layer separately.

| Component | Platform Options                     |
| --------- | ------------------------------------ |
| API       | Docker, AWS ECS, Kubernetes, Railway |
| Frontend  | Vercel, Netlify, Cloudflare Pages    |

Set the frontend's API base URL via environment variable:

```
NEXT_PUBLIC_API_URL=https://api.example.com
```

### Strategy 2: Unified Docker Deployment

Serve both from a single container. The API serves the frontend's static build.

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/web/dist ./public
COPY --from=build /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

Configure the API to serve static files:

```typescript
// main.ts
app.useStaticAssets({ root: join(__dirname, '..', 'public') });
```

### Strategy 3: Monorepo CI with Selective Builds

In CI, only build and deploy the components that changed:

```yaml
# GitHub Actions example
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      api: ${{ steps.filter.outputs.api }}
      web: ${{ steps.filter.outputs.web }}
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            api: 'apps/api/**'
            web: 'apps/web/**'
            shared: 'libs/shared-types/**'

  deploy-api:
    needs: changes
    if: needs.changes.outputs.api == 'true'
    # ... deploy API

  deploy-web:
    needs: changes
    if: needs.changes.outputs.web == 'true'
    # ... deploy frontend
```
