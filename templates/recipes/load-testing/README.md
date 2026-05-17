# Load Testing (k6)

Performance and load testing with Grafana k6.

## Links

- [k6 Documentation](https://grafana.com/docs/k6/)
- [k6 Installation](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- [k6 on GitHub](https://github.com/grafana/k6)

## Installation

k6 is a standalone Go binary. It is not an npm dependency.

```bash
# macOS
brew install k6

# Debian / Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - <k6/smoke.js
```

## Usage

### Smoke Test

Verifies the system works under minimal load (1 virtual user, 10 seconds).

```bash
k6 run k6/smoke.js
```

### Stress Test

Ramps load from 50 to 100 virtual users over 9 minutes to find breaking points.

```bash
k6 run k6/stress.js
```

### Spike Test

To create a spike test, copy an existing script and configure a sharp ramp:

```javascript
export const options = {
  stages: [
    { duration: '10s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '10s', target: 0 },
  ],
};
```

## Thresholds

Each test defines thresholds that cause k6 to exit with a non-zero code if they are breached:

| Metric              | Smoke       | Stress       |
| ------------------- | ----------- | ------------ |
| `http_req_duration` | p95 < 500ms | p95 < 1000ms |
| `http_req_failed`   | < 1%        | < 5%         |

## Generated Files

| File           | Description                                  |
| -------------- | -------------------------------------------- |
| `k6/smoke.js`  | Smoke test — minimal load, strict thresholds |
| `k6/stress.js` | Stress test — ramp to 100 VUs over 9 minutes |
