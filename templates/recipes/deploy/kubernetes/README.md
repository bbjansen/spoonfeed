# Kubernetes Deployment

Kubernetes manifests for deploying the NestJS application.

## Links

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Reference](https://kubernetes.io/docs/reference/kubectl/)

## Manifests

| File                  | Description                                |
| --------------------- | ------------------------------------------ |
| `k8s/deployment.yaml` | App Deployment (2 replicas, health probes) |
| `k8s/service.yaml`    | ClusterIP Service (port 80 -> 3000)        |
| `k8s/configmap.yaml`  | Environment configuration                  |
| `k8s/ingress.yaml`    | Ingress with TLS                           |
| `k8s/hpa.yaml`        | HorizontalPodAutoscaler (2-10 replicas)    |

## Usage

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=app
kubectl get svc app
kubectl get ingress app

# View logs
kubectl logs -l app=app -f

# Scale manually
kubectl scale deployment app --replicas=3
```

## Configuration

1. Replace `REGISTRY/IMAGE:TAG` in deployment.yaml with your container registry
2. Create the `app-secrets` Secret with sensitive env vars
3. Update `app.example.com` in ingress.yaml with your domain
4. Update TLS secret name if using cert-manager
