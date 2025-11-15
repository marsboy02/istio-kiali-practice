# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains a complete implementation of an Istio + Kiali toy project on Minikube, based on the specification in [istio_kiali_toy_project_minikube_full_markdown_guide.md](istio_kiali_toy_project_minikube_full_markdown_guide.md).

**Purpose**: To demonstrate service mesh observability with a microservices architecture that generates various traffic patterns (fast, slow, error) visible in Kiali.

**Note**: All annotations and comments in the code are in Korean (한국어).

## Architecture

This is a 4-service Node.js application:

```
(ui) ──HTTP──> (api) ──HTTP──> (details)
                    └──HTTP──> (ratings)
```

- **ui**: Web frontend with traffic generation buttons
- **api**: Aggregation service that fans out to downstream services
- **details**: Service with variable response latency (50-200ms)
- **ratings**: Service with configurable error rate (default 10% 5xx)

All services run in the `mesh-demo` namespace with Istio sidecar injection enabled and mTLS STRICT mode.

## Repository Structure

```
istio-kiali-practice/
├── apps/
│   ├── ui/              # 웹 프론트엔드 (트래픽 생성 버튼)
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── public/
│   │   │   └── index.html
│   │   └── Dockerfile
│   ├── api/             # API 집계 서비스
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   ├── details/         # 상세 정보 서비스 (가변 지연)
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   └── ratings/         # 평점 서비스 (랜덤 에러)
│       ├── package.json
│       ├── server.js
│       └── Dockerfile
├── k8s/base/
│   ├── namespace.yaml           # mesh-demo 네임스페이스
│   ├── ui.yaml                  # UI Deployment & Service
│   ├── api.yaml                 # API Deployment & Service
│   ├── details.yaml             # Details Deployment & Service
│   ├── ratings.yaml             # Ratings Deployment & Service
│   └── kustomization.yaml       # Kustomize 설정
├── istio/
│   ├── peer-authentication.yaml      # mTLS STRICT 설정
│   ├── gateway-virtualservice.yaml   # 인그레스 게이트웨이 & 라우팅
│   └── destinationrule-api.yaml      # 서킷 브레이커 (선택사항)
├── Makefile                     # 빌드 & 배포 자동화
└── CLAUDE.md                    # 이 파일
```

## Key Commands

### Quick Start
```bash
# 1. Minikube가 실행 중인지 확인
minikube status

# 2. Istio 설치
make istio

# 3. 관측성 도구 설치 (Prometheus, Jaeger, Kiali)
make addons

# 4. 이미지 빌드 및 애플리케이션 배포
make deploy

# 5. Ingress 접근 설정 (별도 터미널)
minikube tunnel
# 또는
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80

# 6. Kiali 대시보드 열기 (별도 터미널)
make kiali
# 브라우저에서 http://localhost:20001 접속
```

### Building Images
```bash
# Minikube 이미지 캐시에 직접 빌드
minikube image build -t toy/ui:local ./apps/ui
minikube image build -t toy/api:local ./apps/api
minikube image build -t toy/details:local ./apps/details
minikube image build -t toy/ratings:local ./apps/ratings

# 또는 Makefile 사용
make images
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
