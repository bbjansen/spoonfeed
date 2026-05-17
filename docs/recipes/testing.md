# Testing Recipes

Performance and load testing tools for validating NestJS applications under realistic traffic conditions.

## Available Recipes

| Recipe       | Tool                           | Best For                                            | Recipe README                                                           |
| ------------ | ------------------------------ | --------------------------------------------------- | ----------------------------------------------------------------------- |
| Load Testing | [k6](https://k6.io/) (Grafana) | HTTP load tests, stress tests, soak tests, CI gates | [load-testing](../../packages/templates/recipes/load-testing/README.md) |

## When to Use

- **Pre-release validation** — confirm your API meets latency and throughput SLAs before deploying.
- **Capacity planning** — determine how many concurrent users your infrastructure supports.
- **Regression detection** — run load tests in CI to catch performance regressions early.
- **Stress testing** — find the breaking point of your service under extreme load.

## Test Types

| Type   | Goal                              | Duration  | Load Shape           |
| ------ | --------------------------------- | --------- | -------------------- |
| Smoke  | Verify the script works           | 1-2 min   | 1-5 VUs              |
| Load   | Validate normal traffic           | 5-15 min  | Ramp to expected VUs |
| Stress | Find the breaking point           | 10-30 min | Ramp beyond capacity |
| Soak   | Detect memory leaks / degradation | 1-4 hours | Steady moderate load |
| Spike  | Test sudden traffic bursts        | 5-10 min  | Sudden ramp + drop   |

## Quick Start

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp up
    { duration: '1m', target: 20 }, // hold
    { duration: '10s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95th percentile < 300ms
    http_req_failed: ['rate<0.01'], // error rate < 1%
  },
};

export default function () {
  const res = http.get('http://localhost:3000/health');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  sleep(1);
}
```

Run with:

```bash
k6 run load-test.js
```

## External Documentation

- [k6 Documentation](https://grafana.com/docs/k6/latest/)
- [k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/)
- [k6 GitHub](https://github.com/grafana/k6)
