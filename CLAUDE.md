# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a comprehensive guide for building an Istio + Kiali toy project on Minikube. Currently, the repo contains only the specification document ([istio_kiali_toy_project_minikube_full_markdown_guide.md](istio_kiali_toy_project_minikube_full_markdown_guide.md)) - the actual implementation has not been created yet.

**Purpose**: To demonstrate service mesh observability with a microservices architecture that generates various traffic patterns (fast, slow, error) visible in Kiali.

## Target Architecture

When implemented, this will be a 4-service Node.js application:

```
(ui) ──HTTP──> (api) ──HTTP──> (details)
                    └──HTTP──> (ratings)
```

- **ui**: Web frontend with traffic generation buttons
- **api**: Aggregation service that fans out to downstream services
- **details**: Service with variable response latency (50-200ms)
- **ratings**: Service with configurable error rate (default 10% 5xx)

All services run in the `mesh-demo` namespace with Istio sidecar injection enabled and mTLS STRICT mode.

## Implementation Plan

The guide describes this structure to be created:
- `apps/` - Four Node.js Express microservices (ui, api, details, ratings)
- `k8s/base/` - Kubernetes manifests using Kustomize
- `istio/` - Istio configuration (Gateway, VirtualService, PeerAuthentication, DestinationRule)
- `Makefile` - Build and deployment automation

## Key Commands (when implemented)

### Building Images
```bash
# Build directly into Minikube's image cache
minikube image build -t toy/ui:local ./apps/ui
minikube image build -t toy/api:local ./apps/api
minikube image build -t toy/details:local ./apps/details
minikube image build -t toy/ratings:local ./apps/ratings
```

### Istio Installation
```bash
# Install Istio with 100% tracing
istioctl x precheck
istioctl install -y \
  --set profile=default \
  --set meshConfig.defaultConfig.tracing.sampling=100

# Deploy observability addons
ISTIO_ADDONS_DIR=~/istio-*/samples/addons
kubectl apply -f $ISTIO_ADDONS_DIR/prometheus.yaml
kubectl apply -f $ISTIO_ADDONS_DIR/jaeger.yaml
kubectl apply -f $ISTIO_ADDONS_DIR/kiali.yaml
```

### Application Deployment
```bash
# Deploy application workloads
kubectl apply -k k8s/base

# Apply Istio policies and routing
kubectl apply -f istio/peer-authentication.yaml
kubectl apply -f istio/gateway-virtualservice.yaml
kubectl apply -f istio/destinationrule-api.yaml
```

### Accessing Services
```bash
# Option A: Minikube tunnel (LoadBalancer)
minikube tunnel
kubectl -n istio-system get svc istio-ingressgateway

# Option B: Port-forward
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80

# Access Kiali dashboard
kubectl -n istio-system port-forward svc/kiali 20001:20001
# Open http://localhost:20001
```

### Verification
```bash
# Check Istio system pods
kubectl get pods -n istio-system -w

# Check application pods
kubectl get pods -n mesh-demo -w

# Verify services
kubectl get svc -n mesh-demo
```

### Makefile Targets
```bash
make images          # Build all container images
make istio           # Install Istio
make addons          # Deploy Prometheus, Jaeger, Kiali
make app             # Deploy application workloads
make istio-routes    # Apply Istio routing configuration
make deploy          # Full deployment (images + app + routes)
make kiali           # Port-forward to Kiali dashboard
make clean           # Remove all deployed resources
```

## Service Configuration

### Environment Variables
- **details**: `MIN_DELAY_MS` (default: 50), `MAX_DELAY_MS` (default: 200)
- **ratings**: `ERROR_RATE` (default: 0.1 for 10% errors)
- **api**: `DETAILS_URL`, `RATINGS_URL` (cluster DNS endpoints)

### Traffic Patterns in UI
- **FAST**: 200ms interval, fan-out calls to details + ratings
- **SLOW**: 1000ms interval, 1s simulated delay + details call
- **ERROR**: 250ms interval, triggers rating service errors

## Istio Features Demonstrated

1. **mTLS**: STRICT mode enforced via PeerAuthentication
2. **Gateway/VirtualService**: Ingress routing to ui and api services
3. **DestinationRule**: Circuit breaking and outlier detection on api service
4. **Observability**: Full metrics, traces (100% sampling), and service graph in Kiali

## Prerequisites

- Minikube running (recommended: `minikube start --cpus=4 --memory=8192`)
- `kubectl` CLI installed
- `istioctl` CLI installed
- `helm` (optional)
- Node.js 18+ (if building locally outside Minikube)

## Troubleshooting Tips

- **No graph in Kiali**: Ensure traffic flows for 30-60s and Prometheus is running
- **503/502 from api**: Expected behavior - ratings service returns 5xx by design
- **mTLS issues**: Verify namespace has `istio-injection: enabled` label
- **Missing traces**: Confirm Jaeger pod is running and sampling is set to 100%

## Cleanup

```bash
kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found
kubectl delete -f istio/gateway-virtualservice.yaml --ignore-not-found
kubectl delete -f istio/peer-authentication.yaml --ignore-not-found
kubectl delete ns mesh-demo --ignore-not-found

# Optional: Remove Istio completely
# istioctl uninstall -y --purge
```
