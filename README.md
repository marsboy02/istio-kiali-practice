# Istio + Kiali 토이 프로젝트 (Minikube)

> **목표**: Minikube 환경에서 Istio와 Kiali를 구동하고, 버튼을 통해 트래픽을 생성하는 작은 웹 앱을 배포하여 Kiali에서 시각화합니다.

## 🎯 프로젝트 개요

이 프로젝트는 마이크로서비스 아키텍처에서 서비스 메시의 관측성을 시연하기 위한 완전한 구현체입니다.

**서비스 구조**:
```
(ui) ──HTTP──> (api) ──HTTP──> (details)
                    └──HTTP──> (ratings)
```

- **ui**: 트래픽 생성 버튼이 있는 웹 프론트엔드
- **api**: 다운스트림 서비스로 팬아웃하는 집계 서비스
- **details**: 가변 응답 지연 시간을 가진 서비스 (50-200ms)
- **ratings**: 설정 가능한 에러율을 가진 서비스 (기본 10% 5xx)

모든 서비스는 `mesh-demo` 네임스페이스에서 실행되며, Istio 사이드카 주입과 mTLS STRICT 모드가 활성화됩니다.

## 📋 사전 요구사항

- **Minikube**: 실행 중 (권장: `minikube start --cpus=4 --memory=8192`)
- **kubectl**: CLI 설치됨
- **istioctl**: CLI 설치됨
- **Helm**: (선택사항)
- **Node.js 18+**: (Minikube 외부에서 로컬 빌드 시)

## 🚀 빠른 시작

### 1단계: Istio 설치
```bash
make istio
```

### 2단계: 관측성 도구 설치
```bash
make addons
```

Prometheus, Jaeger, Kiali가 `istio-system` 네임스페이스에 설치됩니다.

```bash
# 파드가 준비될 때까지 대기
kubectl get pods -n istio-system -w
```

### 3단계: 애플리케이션 배포
```bash
# 이미지 빌드 + 앱 배포 + Istio 라우팅 설정
make deploy
```

또는 단계별로:
```bash
make images        # 이미지만 빌드
make app           # 앱만 배포
make istio-routes  # Istio 라우팅만 적용
```

### 4단계: 애플리케이션 접근

**옵션 A) Minikube 터널 사용 (LoadBalancer)**
```bash
# 별도 터미널에서 실행
minikube tunnel

# 외부 IP 확인
kubectl -n istio-system get svc istio-ingressgateway
# EXTERNAL-IP (예: 127.0.0.1 또는 10.XXX)로 접근
```

**옵션 B) 포트 포워딩 사용**
```bash
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80
```

브라우저에서 `http://localhost:8080/` 열기

### 5단계: 트래픽 생성

UI에서 다음 버튼을 클릭하여 트래픽 생성:
- **빠른 트래픽 시작**: 200ms 간격, details + ratings 병렬 호출
- **느린 트래픽 시작**: 1000ms 간격, 1초 지연 + details 호출
- **에러 트래픽 시작**: 250ms 간격, ratings 서비스 5xx 에러 유발

약 1-2분간 실행하여 메트릭을 축적하세요.

### 6단계: Kiali에서 확인

```bash
make kiali
```

또는:
```bash
kubectl -n istio-system port-forward svc/kiali 20001:20001
```

브라우저에서 **http://localhost:20001** 열기

**Graph 메뉴**에서 Namespace를 `mesh-demo`로 선택하면 다음을 확인할 수 있습니다:
- **ui → api → (details/ratings)** 엣지
- 엣지 레이블: **요청/초**, **에러율**, **응답 시간**
- **Security** 탭에서 mTLS 확인
- **Traces** 탭에서 Jaeger 트레이스 (샘플링 100%)

## 🛠️ Makefile 명령어

```bash
make images       # 모든 컨테이너 이미지를 Minikube에 빌드
make istio        # Istio 설치
make addons       # Prometheus, Jaeger, Kiali 배포
make app          # 애플리케이션 워크로드 배포
make istio-routes # Istio 라우팅 설정 적용
make deploy       # 전체 배포 (images + app + routes)
make kiali        # Kiali 대시보드 포트 포워딩
make url          # 접근 URL 안내 표시
make clean        # 배포된 모든 리소스 제거
```

## 📁 프로젝트 구조

```
istio-kiali-practice/
├── apps/
│   ├── ui/              # 웹 프론트엔드
│   ├── api/             # API 집계 서비스
│   ├── details/         # 상세 정보 서비스
│   └── ratings/         # 평점 서비스
├── k8s/base/            # Kubernetes 매니페스트
│   ├── namespace.yaml
│   ├── ui.yaml
│   ├── api.yaml
│   ├── details.yaml
│   ├── ratings.yaml
│   └── kustomization.yaml
├── istio/               # Istio 설정
│   ├── peer-authentication.yaml
│   ├── gateway-virtualservice.yaml
│   └── destinationrule-api.yaml
├── Makefile             # 빌드 & 배포 자동화
└── README.md            # 이 파일
```

## ⚙️ 서비스 설정

### 환경 변수
- **details**: `MIN_DELAY_MS` (기본: 50), `MAX_DELAY_MS` (기본: 200)
- **ratings**: `ERROR_RATE` (기본: 0.1 = 10% 에러)
- **api**: `DETAILS_URL`, `RATINGS_URL` (클러스터 DNS 엔드포인트)

### UI 트래픽 패턴
- **빠른 트래픽**: 200ms 간격, details + ratings 병렬 호출
- **느린 트래픽**: 1000ms 간격, 1초 지연 + details 호출
- **에러 트래픽**: 250ms 간격, ratings 서비스 에러 유발

## 🔍 Istio 기능 시연

1. **mTLS**: PeerAuthentication을 통한 STRICT 모드 강제
2. **Gateway/VirtualService**: ui 및 api 서비스로의 인그레스 라우팅
3. **DestinationRule**: api 서비스에 대한 서킷 브레이킹 및 아웃라이어 탐지
4. **관측성**: 완전한 메트릭, 트레이스 (100% 샘플링), Kiali 서비스 그래프

## 🐛 트러블슈팅

### Kiali에 그래프가 표시되지 않음
- 트래픽이 30-60초간 흐르는지 확인
- Prometheus가 `istio-system`에서 실행 중인지 확인
  ```bash
  kubectl get pods -n istio-system | grep prometheus
  ```

### api에서 503/502 에러 발생
- 예상된 동작입니다 - ratings 서비스가 의도적으로 5xx를 반환합니다
- 서비스가 해석되는지 확인:
  ```bash
  kubectl exec -n mesh-demo deploy/api -- curl http://details.mesh-demo:8080/info
  ```

### mTLS 문제
- STRICT 모드가 무언가를 차단하는 경우, 모든 워크로드에 사이드카가 있는지 확인
- 네임스페이스 레이블 확인:
  ```bash
  kubectl get namespace mesh-demo -o yaml | grep istio-injection
  ```

### 트레이스 누락
- Jaeger 파드가 실행 중인지 확인
- 샘플링이 높게 설정되어 있는지 확인 (100%로 설정됨)
- 표시되는 데 1분 정도 걸릴 수 있습니다

### Ingress URL
- `minikube tunnel` 선호
- 그렇지 않으면 ingressgateway에서 포트 포워딩 사용

### DestinationRule 에러
- 최신 Istio 버전에서 `consecutive5xx` 필드가 `consecutiveGatewayErrors`로 변경됨
- 이미 수정된 버전이 포함되어 있습니다
- DestinationRule은 선택사항이므로 에러가 발생해도 앱은 정상 작동

## 🔄 선택적 확장

- **Canary 배포**: `version: v2`로 `api`에 대한 카나리 추가 및 트래픽 80/20 분할 VirtualService
- **장애 주입**: `details`/`ratings` 경로에 지연/중단 추가하여 에러/지연 스파이크 확인
- **Grafana**: Istio 대시보드를 가져와서 배포 (일부 애드온 세트에 포함)

## 🧹 정리

```bash
# make를 사용하여 모든 리소스 제거
make clean

# 또는 수동으로
kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found
kubectl delete -f istio/gateway-virtualservice.yaml --ignore-not-found
kubectl delete -f istio/peer-authentication.yaml --ignore-not-found
kubectl delete ns mesh-demo --ignore-not-found

# 선택사항: 애드온 및/또는 Istio 제거
# kubectl delete -f ~/istio-*/samples/addons/kiali.yaml
# kubectl delete -f ~/istio-*/samples/addons/jaeger.yaml
# kubectl delete -f ~/istio-*/samples/addons/prometheus.yaml
# istioctl uninstall -y --purge
```

## 📝 참고 사항

- 모든 코드 주석과 애노테이션은 **한국어**로 작성되었습니다
- 원본 가이드는 [istio_kiali_toy_project_minikube_full_markdown_guide.md](istio_kiali_toy_project_minikube_full_markdown_guide.md)를 참조하세요
- Claude Code 사용 시 [CLAUDE.md](CLAUDE.md)를 참조하세요

## 📚 Kiali에서 확인할 내용

- `ui → api → (details, ratings)` 엣지가 있는 명확한 서비스 그래프
- **빠른 트래픽**: 안정적인 저지연
- **느린 트래픽**: 증가된 응답 시간
- **에러 트래픽**: `ratings`에서 5xx 에러
- mTLS 자물쇠 아이콘 (네임스페이스 STRICT)
- Jaeger가 활성화된 경우 선택적 트레이싱

---

**완료!** 이제 Minikube에서 Istio 서비스 메시와 Kiali 관측성을 경험할 수 있습니다.
