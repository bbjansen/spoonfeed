# Runbook: [Service/Issue Name]

## Overview

- **Service:** [Service name]
- **Severity:** [P1/P2/P3/P4]
- **On-call team:** [Team name]
- **Last updated:** YYYY-MM-DD

## Symptoms

- [What does the user/monitoring see?]
- [Which alerts fire?]
- [What metrics change?]

## Diagnosis

### Step 1: Check service health

```bash
curl https://api.example.com/health/ready
```

### Step 2: Check logs

```bash
# CloudWatch
aws logs filter-log-events --log-group-name /ecs/app --filter-pattern "ERROR"

# Kubernetes
kubectl logs -l app=api --tail=100 | grep ERROR
```

### Step 3: Check database

```bash
# Connection count
SELECT count(*) FROM pg_stat_activity;

# Slow queries
SELECT * FROM pg_stat_activity WHERE state = 'active' AND duration > interval '5 seconds';
```

## Mitigation

### Quick fix

[What can be done immediately to restore service?]

### Rollback

```bash
# Kubernetes
kubectl rollout undo deployment/api

# ECS
aws ecs update-service --cluster prod --service api --task-definition api:PREVIOUS_VERSION
```

## Resolution

[Steps to permanently fix the issue]

## Post-Incident

- [ ] Incident documented
- [ ] Root cause identified
- [ ] Prevention measures implemented
- [ ] Monitoring/alerting updated
- [ ] Team notified

## Escalation

| Level | Contact             | When               |
| ----- | ------------------- | ------------------ |
| L1    | On-call engineer    | First response     |
| L2    | Team lead           | After 30 minutes   |
| L3    | Engineering manager | After 1 hour or P1 |
