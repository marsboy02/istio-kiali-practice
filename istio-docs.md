# Istio 설정 파일 설명서

이 문서는 `istio/` 디렉토리에 있는 Istio 설정 파일들을 **Istio를 처음 접하는 분들을 위해** 쉽게 설명합니다.

---

## Istio란?

**Istio**는 마이크로서비스 간의 통신을 관리하는 **서비스 메시(Service Mesh)** 플랫폼입니다.

### 서비스 메시란?

전통적인 방식에서는 각 서비스가 직접 다른 서비스를 호출합니다:

```
서비스 A ──HTTP──> 서비스 B
```

서비스 메시에서는 각 서비스 옆에 **사이드카(Sidecar)** 라는 프록시가 붙어서 모든 네트워크 트래픽을 중간에서 처리합니다:

```
서비스 A → [사이드카] ─암호화──> [사이드카] → 서비스 B
```

### Istio가 제공하는 기능

1. **보안**: 서비스 간 통신 자동 암호화 (mTLS)
2. **트래픽 관리**: 라우팅, 로드 밸런싱, 재시도, 타임아웃 등
3. **관찰성**: 모든 트래픽 모니터링, 로깅, 추적
4. **복원력**: 서킷 브레이커, 장애 격리

이 프로젝트에서는 위 기능들을 실습하기 위해 3개의 YAML 파일을 사용합니다.

---

## 1. peer-authentication.yaml - 서비스 간 암호화 설정

### 파일 위치

[istio/peer-authentication.yaml](istio/peer-authentication.yaml)

### 무엇을 하는가?

이 파일은 **모든 서비스 간 통신을 자동으로 암호화**하도록 설정합니다.

### 설정 내용

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: mesh-demo
spec:
  mtls:
    mode: STRICT # 모든 트래픽에 대해 mutual TLS 강제
```

### 주요 개념 설명

#### mTLS (Mutual TLS)란?

일반적인 HTTPS는 **클라이언트가 서버를 인증**합니다 (웹사이트가 진짜인지 확인).

**mTLS**는 **서로를 인증**합니다:

- 서버: "너는 진짜 API 서비스야?"
- 클라이언트: "맞아, 나는 진짜 UI 서비스야"

#### STRICT 모드의 의미

| 모드           | 설명                                                     |
| -------------- | -------------------------------------------------------- |
| **PERMISSIVE** | 암호화된 연결과 일반 연결 둘 다 허용 (마이그레이션 용도) |
| **STRICT**     | 반드시 암호화된 연결만 허용 (보안 강화)                  |
| **DISABLE**    | 암호화 사용 안 함                                        |

이 프로젝트에서는 `STRICT` 모드를 사용하므로, `mesh-demo` 네임스페이스 안의 모든 서비스는:

- 암호화되지 않은 요청을 거부합니다
- 자동으로 TLS 인증서를 발급받고 갱신합니다
- 서로의 신원을 확인합니다

### 적용 방법

```bash
kubectl apply -f istio/peer-authentication.yaml
```

### 확인 방법

```bash
# PeerAuthentication 리소스 확인
kubectl get peerauthentication -n mesh-demo

# 사이드카 프록시 로그에서 mTLS 활성화 확인
kubectl logs -n mesh-demo <pod-name> -c istio-proxy | grep -i tls
```

---

## 2. gateway-virtualservice.yaml - 외부 트래픽 라우팅

### 파일 위치

[istio/gateway-virtualservice.yaml](istio/gateway-virtualservice.yaml)

### 무엇을 하는가?

이 파일은 **외부에서 들어오는 HTTP 요청을 어느 서비스로 보낼지** 결정합니다.

이 파일에는 2개의 리소스가 포함되어 있습니다:

1. **Gateway**: 외부 트래픽 진입점
2. **VirtualService**: 라우팅 규칙

---

### 2-1. Gateway 리소스

#### 개념 설명

**Gateway**는 쿠버네티스 클러스터의 "정문"입니다. 외부에서 오는 모든 요청은 이 문을 통해 들어옵니다.

```
인터넷 → [Gateway (정문)] → 클러스터 내부 서비스들
```

#### 설정 내용

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: ui-gw
  namespace: mesh-demo
spec:
  selector:
    istio: ingressgateway # Istio Ingress Gateway Pod와 연결
  servers:
    - port: { number: 80, name: http, protocol: HTTP }
      hosts: ["*"] # 모든 도메인 허용
```

#### 주요 필드 설명

| 필드          | 값                      | 의미                                               |
| ------------- | ----------------------- | -------------------------------------------------- |
| `selector`    | `istio: ingressgateway` | Istio가 기본으로 설치한 Ingress Gateway Pod를 사용 |
| `port.number` | 80                      | HTTP 기본 포트로 요청 받음                         |
| `hosts`       | `["*"]`                 | 모든 도메인 허용 (localhost, IP 주소 등)           |

---

### 2-2. VirtualService 리소스

#### 개념 설명

**VirtualService**는 "안내판"입니다. Gateway를 통해 들어온 요청을 **어느 서비스로 보낼지** 결정합니다.

```
Gateway를 통과한 요청
    ↓
VirtualService가 URL 확인
    ↓
/api/* → API 서비스
/*     → UI 서비스
```

#### 설정 내용

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ui-vs
  namespace: mesh-demo
spec:
  hosts: ["*"] # 모든 호스트에 대해
  gateways: ["ui-gw"] # ui-gw Gateway를 통해 들어온 요청을
  http:
    # 규칙 1: /api로 시작하는 경로
    - name: api
      match:
        - uri: { prefix: "/api" }
      route:
        - destination:
            host: api.mesh-demo.svc.cluster.local
            port: { number: 8080 }

    # 규칙 2: 나머지 모든 경로
    - name: ui
      match:
        - uri: { prefix: "/" }
      route:
        - destination:
            host: ui.mesh-demo.svc.cluster.local
            port: { number: 8080 }
```

#### 라우팅 규칙 예시

| 요청 URL                      | 매칭 규칙        | 목적지 서비스 |
| ----------------------------- | ---------------- | ------------- |
| `http://localhost/`           | `prefix: "/"`    | ui 서비스     |
| `http://localhost/index.html` | `prefix: "/"`    | ui 서비스     |
| `http://localhost/api/fast`   | `prefix: "/api"` | api 서비스    |
| `http://localhost/api/slow`   | `prefix: "/api"` | api 서비스    |

#### 중요 포인트

- **순서가 중요합니다**: 위에서 아래로 매칭하므로, `/api` 규칙을 `/` 규칙보다 먼저 배치해야 합니다.
- **host 형식**: `서비스명.네임스페이스.svc.cluster.local` (쿠버네티스 DNS)

### 적용 방법

```bash
kubectl apply -f istio/gateway-virtualservice.yaml
```

### 확인 방법

```bash
# Gateway 확인
kubectl get gateway -n mesh-demo

# VirtualService 확인
kubectl get virtualservice -n mesh-demo

# Ingress Gateway의 외부 IP 확인
kubectl get svc -n istio-system istio-ingressgateway
```

### 접속 테스트

```bash
# Minikube 환경에서는 터널 필요
minikube tunnel

# 또는 포트 포워딩
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80

# 브라우저에서 접속
# http://localhost:8080 → UI 서비스
# http://localhost:8080/api/fast → API 서비스
```

---

## 3. destinationrule-api.yaml - 트래픽 정책 및 복원력

### 파일 위치

[istio/destinationrule-api.yaml](istio/destinationrule-api.yaml)

### 무엇을 하는가?

이 파일은 **API 서비스에 대한 고급 트래픽 관리 정책**을 설정합니다. 특히:

1. **서킷 브레이커**: 문제 있는 서비스 호출 차단
2. **아웃라이어 탐지**: 비정상 인스턴스 자동 격리

### 개념 설명

#### 서킷 브레이커란?

전기 회로의 **차단기**와 같은 개념입니다. 문제가 생기면 자동으로 연결을 끊어서 더 큰 장애를 막습니다.

**예시 시나리오**:

```
1. API 서비스가 과부하 상태
2. 모든 요청이 타임아웃
3. 서킷 브레이커가 작동 → "더 이상 요청 보내지 마!"
4. 즉시 에러 반환 (빠른 실패)
5. 시스템 부하 감소
6. 일정 시간 후 복구 시도
```

#### 아웃라이어 탐지란?

여러 인스턴스(Pod) 중 **비정상적으로 동작하는 것을 찾아서 격리**합니다.

**예시 시나리오**:

```
API Pod 3개가 실행 중:
- api-pod-1: 정상 (응답 시간 100ms)
- api-pod-2: 정상 (응답 시간 120ms)
- api-pod-3: 비정상 (에러 반복 발생)

→ Istio가 api-pod-3를 감지하고 30초간 격리
→ 요청을 api-pod-1, 2에만 보냄
→ 30초 후 api-pod-3 복구 여부 테스트
```

### 설정 내용

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-dr
  namespace: mesh-demo
spec:
  host: api.mesh-demo.svc.cluster.local
  trafficPolicy:
    # 연결 풀 설정
    connectionPool:
      http:
        http1MaxPendingRequests: 10 # 최대 대기 요청 수
        maxRequestsPerConnection: 100 # 연결당 최대 요청 수

    # 아웃라이어 탐지 설정
    outlierDetection:
      consecutiveGatewayErrors: 3 # 연속 3번 에러 발생 시 격리
      interval: 5s # 5초마다 분석
      baseEjectionTime: 30s # 30초간 격리
      maxEjectionPercent: 50 # 최대 50%까지만 격리
```

### 주요 필드 설명

#### connectionPool (연결 풀 설정)

| 필드                       | 값  | 의미                                                              |
| -------------------------- | --- | ----------------------------------------------------------------- |
| `http1MaxPendingRequests`  | 10  | 대기 큐에 쌓일 수 있는 최대 요청 수. 초과 시 즉시 거부 (503 반환) |
| `maxRequestsPerConnection` | 100 | 하나의 TCP 연결에서 처리할 수 있는 최대 요청 수                   |

**실무 의미**:

- 요청이 너무 많이 쌓이면 타임아웃이 발생하는 것보다 빠르게 실패하는 게 낫습니다.
- 이 설정은 **백프레셔(backpressure)** 메커니즘을 제공합니다.

#### outlierDetection (아웃라이어 탐지)

| 필드                       | 값  | 의미                                                              |
| -------------------------- | --- | ----------------------------------------------------------------- |
| `consecutiveGatewayErrors` | 3   | 연속으로 몇 번 에러가 나면 비정상으로 판단할지 (502, 503, 504 등) |
| `interval`                 | 5s  | 얼마나 자주 인스턴스 상태를 분석할지                              |
| `baseEjectionTime`         | 30s | 비정상 인스턴스를 얼마나 격리할지 (첫 번째 격리 시간)             |
| `maxEjectionPercent`       | 50  | 전체 인스턴스 중 최대 몇 %까지 격리할 수 있는지                   |

**실무 의미**:

- 50% 제한이 없으면 모든 Pod가 격리될 수 있습니다 → 서비스 전체 중단
- 격리 시간은 점진적으로 증가합니다 (30s → 60s → 90s ...)

### 동작 예시

#### 시나리오: ratings 서비스가 10% 확률로 500 에러 반환

```
1. api-pod-1이 ratings를 3번 연속 호출
   → 운이 나빠서 3번 모두 500 에러 발생

2. Istio가 api-pod-1을 비정상으로 판단
   → 30초간 격리 (로드 밸런싱에서 제외)

3. 다른 Pod들로만 트래픽 전송

4. 30초 후 api-pod-1에 소량의 트래픽 다시 보냄
   → 정상이면 다시 활성화
   → 여전히 문제면 60초 격리
```

### 적용 방법

```bash
kubectl apply -f istio/destinationrule-api.yaml
```

### 확인 방법

```bash
# DestinationRule 확인
kubectl get destinationrule -n mesh-demo

# 상세 정보 확인
kubectl describe destinationrule api-dr -n mesh-demo

# 격리 통계 확인 (Kiali 또는 Prometheus에서)
# 메트릭: istio_requests_total{response_code="503"}
```

### 테스트 방법

```bash
# 에러 트래픽 발생 (UI에서 "에러 트래픽 시작" 버튼 클릭)
# 또는 직접 호출
for i in {1..100}; do
  curl http://localhost:8080/api/error
  sleep 0.1
done

# Kiali에서 확인:
# - API 서비스의 에러율
# - 격리된 인스턴스 (Ejected hosts)
```

---

## 전체 적용 순서

### 1. Istio 설치 (사전 작업)

```bash
# Istio 설치 (100% 트레이싱 활성화)
istioctl install -y \
  --set profile=default \
  --set meshConfig.defaultConfig.tracing.sampling=100

# 관측성 도구 설치
kubectl apply -f ~/istio-*/samples/addons/prometheus.yaml
kubectl apply -f ~/istio-*/samples/addons/jaeger.yaml
kubectl apply -f ~/istio-*/samples/addons/kiali.yaml
```

### 2. 애플리케이션 배포

```bash
# 네임스페이스 생성 및 사이드카 자동 주입 활성화
kubectl create namespace mesh-demo
kubectl label namespace mesh-demo istio-injection=enabled

# 애플리케이션 배포
kubectl apply -k k8s/base
```

### 3. Istio 정책 적용 (순서 주의!)

```bash
# 1단계: mTLS 설정 (먼저 적용)
kubectl apply -f istio/peer-authentication.yaml

# 2단계: Gateway 및 라우팅 설정
kubectl apply -f istio/gateway-virtualservice.yaml

# 3단계: 트래픽 정책 (선택사항)
kubectl apply -f istio/destinationrule-api.yaml
```

### 4. 동작 확인

```bash
# 모든 Pod가 Running 상태인지 확인 (각 Pod에 2개 컨테이너)
kubectl get pods -n mesh-demo

# Gateway 외부 IP 확인
kubectl get svc -n istio-system istio-ingressgateway

# Kiali 대시보드 열기
kubectl port-forward -n istio-system svc/kiali 20001:20001
# 브라우저: http://localhost:20001
```

---

## Kiali에서 확인 가능한 것들

### 1. mTLS 동작 확인

- **Graph** 탭에서 서비스 간 연결에 **자물쇠 아이콘** 표시
- 모든 통신이 암호화되고 있음을 시각적으로 확인

### 2. 라우팅 동작 확인

- UI에서 트래픽 생성 버튼 클릭
- Kiali Graph에서 실시간 트래픽 흐름 관찰:
  - `istio-ingressgateway` → `ui` 서비스
  - `istio-ingressgateway` → `api` 서비스
  - `api` → `details` + `ratings` (병렬 호출)

### 3. 에러 및 서킷 브레이커 확인

- "에러 트래픽 시작" 버튼 클릭
- Graph에서 빨간색 선 (에러 발생)
- **Applications** 탭에서:
  - `api` 서비스의 Success Rate 하락 (90% 정도)
  - Outlier Detection 통계 확인

---

## 문제 해결 (Troubleshooting)

### 503 Service Unavailable 발생

```bash
# 원인 1: mTLS 설정 불일치
kubectl get peerauthentication -n mesh-demo
# 모든 Pod에 사이드카가 있는지 확인 (READY 2/2)
kubectl get pods -n mesh-demo

# 원인 2: DestinationRule의 connectionPool 제한 초과
# http1MaxPendingRequests를 늘리거나 트래픽 감소
```

### Gateway에 접속 안 됨

```bash
# Ingress Gateway Pod 상태 확인
kubectl get pods -n istio-system -l istio=ingressgateway

# 포트 포워딩 또는 터널 설정 확인
kubectl port-forward -n istio-system svc/istio-ingressgateway 8080:80

# Gateway 리소스 확인
kubectl get gateway -n mesh-demo
kubectl describe gateway ui-gw -n mesh-demo
```

### Kiali에서 트래픽이 안 보임

```bash
# Prometheus가 정상 동작하는지 확인
kubectl get pods -n istio-system -l app=prometheus

# 트래픽 생성 (최소 30초 이상)
curl http://localhost:8080/api/fast
```

---

## 추가 학습 자료

### 공식 문서

- [Istio 공식 문서](https://istio.io/latest/docs/)
- [Istio Security (mTLS)](https://istio.io/latest/docs/concepts/security/)
- [Traffic Management](https://istio.io/latest/docs/concepts/traffic-management/)

### 이 프로젝트에서 사용하지 않은 고급 기능

- **카나리 배포**: 신버전에 10%만 트래픽 보내기
- **A/B 테스트**: 특정 헤더를 가진 요청만 신버전으로
- **타임아웃 및 재시도**: 자동 재시도 정책 설정
- **레이트 리미팅**: 초당 요청 수 제한
- **JWT 인증**: 토큰 기반 인증 추가

---

## 정리

| 파일                                                             | 목적                  | 핵심 개념                                       |
| ---------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| [peer-authentication.yaml](istio/peer-authentication.yaml)       | 서비스 간 통신 암호화 | mTLS STRICT 모드                                |
| [gateway-virtualservice.yaml](istio/gateway-virtualservice.yaml) | 외부 트래픽 라우팅    | Gateway (진입점) + VirtualService (라우팅 규칙) |
| [destinationrule-api.yaml](istio/destinationrule-api.yaml)       | 트래픽 정책 및 복원력 | 서킷 브레이커 + 아웃라이어 탐지                 |

이 3개의 파일만으로도 **보안, 라우팅, 복원력**이라는 Istio의 핵심 기능을 경험할 수 있습니다!
