# Service Level Objectives (SLOs)

## API Availability

| Metric     | Target                      | Measurement                    |
| ---------- | --------------------------- | ------------------------------ |
| Uptime     | 99.9% (8.76h downtime/year) | Health check endpoint          |
| Error rate | < 0.1% of requests          | 5xx responses / total requests |

## API Latency

| Percentile | Target   | Measurement                      |
| ---------- | -------- | -------------------------------- |
| p50        | < 100ms  | Response time from load balancer |
| p95        | < 500ms  | Response time from load balancer |
| p99        | < 1000ms | Response time from load balancer |

## Error Budget

Monthly error budget: 100% - 99.9% = 0.1% = ~43 minutes/month

| Budget used | Action                                            |
| ----------- | ------------------------------------------------- |
| < 50%       | Normal development velocity                       |
| 50-80%      | Increase testing, slower rollouts                 |
| > 80%       | Freeze non-critical changes, focus on reliability |
| 100%        | Incident response, rollback recent changes        |

## Monitoring & Alerting

| Alert                | Threshold              | Channel           |
| -------------------- | ---------------------- | ----------------- |
| Error rate spike     | > 1% for 5 minutes     | PagerDuty + Slack |
| Latency spike (p95)  | > 2s for 5 minutes     | Slack             |
| Health check failure | 3 consecutive failures | PagerDuty         |
| Certificate expiry   | < 30 days              | Email             |
