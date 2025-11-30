# Apps 디렉토리 구조 및 서비스 설명

이 문서는 `apps/` 디렉토리에 포함된 마이크로서비스들에 대한 상세 설명을 제공합니다.

## 전체 아키텍처

```
(ui) ──HTTP──> (api) ──HTTP──> (details)
                    └──HTTP──> (ratings)
```

4개의 Node.js 기반 마이크로서비스가 Istio 서비스 메시 환경에서 실행되며, Kiali를 통해 서비스 간 트래픽과 관측성을 시각화할 수 있습니다.

---

## 1. UI 서비스 (`apps/ui/`)

### 목적

웹 프론트엔드를 제공하며, 사용자가 다양한 트래픽 패턴을 생성할 수 있는 대시보드를 제공합니다.

### 기술 스택

- **런타임**: Node.js
- **프레임워크**: Express 4.18.2
- **포트**: 8080 (기본값)

### 주요 기능

- 정적 HTML 페이지 제공 ([public/index.html](apps/ui/public/index.html))
- 3가지 트래픽 생성 패턴 제공:
  - **빠른 트래픽** (FAST): 200ms 간격으로 `/api/fast` 호출
  - **느린 트래픽** (SLOW): 1000ms 간격으로 `/api/slow` 호출
  - **에러 트래픽** (ERROR): 250ms 간격으로 `/api/error` 호출

### 파일 구조

```
ui/
├── server.js           # Express 서버 (정적 파일 제공)
├── package.json        # 의존성 정의
├── Dockerfile          # 컨테이너 이미지 빌드 설정
└── public/
    └── index.html      # 트래픽 생성 대시보드 UI
```

### 코드 하이라이트

- [server.js:6](apps/ui/server.js#L6): 정적 파일 제공 설정
- [index.html:86-102](apps/ui/public/index.html#L86-L102): 각 트래픽 패턴별 fetch 로직

### 환경 변수

| 변수   | 기본값 | 설명           |
| ------ | ------ | -------------- |
| `PORT` | 8080   | HTTP 서버 포트 |

---

## 2. API 서비스 (`apps/api/`)

### 목적

다운스트림 서비스(details, ratings)를 호출하는 집계(aggregation) 레이어입니다. 다양한 트래픽 패턴을 시뮬레이션하여 Kiali에서 서비스 메시 동작을 관찰할 수 있습니다.

### 기술 스택

- **런타임**: Node.js (ES Module)
- **프레임워크**: Express 4.18.2
- **HTTP 클라이언트**: node-fetch 3.3.2
- **포트**: 8080 (기본값)

### 엔드포인트

#### `GET /fast`

- **동작**: details와 ratings를 **병렬로** 호출 (`Promise.all`)
- **용도**: 정상적인 팬아웃(fan-out) 패턴 시연
- **응답**:
  ```json
  {
    "ok": true,
    "details": { ... },
    "ratings": { ... }
  }
  ```
- **에러 처리**: 다운스트림 실패 시 502 반환

#### `GET /slow`

- **동작**: 1초 지연 후 details 호출
- **용도**: 높은 레이턴시 시뮬레이션
- **응답**:
  ```json
  {
    "ok": true,
    "details": { ... },
    "delayed": true
  }
  ```

#### `GET /error`

- **동작**: ratings 호출 (5xx 에러 유발 가능)
- **용도**: 에러율 및 서킷 브레이커 동작 테스트
- **응답**: 성공 시 ratings 데이터, 실패 시 500/502 반환

#### `GET /healthz`

- **동작**: 헬스체크 엔드포인트
- **응답**: `"ok"`

### 파일 구조

```
api/
├── server.js      # Express 서버 (3가지 엔드포인트 구현)
├── package.json   # 의존성 정의 (type: "module")
└── Dockerfile     # 컨테이너 이미지 빌드 설정
```

### 코드 하이라이트

- [server.js:18-29](apps/api/server.js#L18-L29): 병렬 호출 로직 (`/fast`)
- [server.js:32-41](apps/api/server.js#L32-L41): 지연 시뮬레이션 (`/slow`)
- [server.js:44-52](apps/api/server.js#L44-L52): 에러 전파 로직 (`/error`)

### 환경 변수

| 변수          | 기본값                                                 | 설명               |
| ------------- | ------------------------------------------------------ | ------------------ |
| `PORT`        | 8080                                                   | HTTP 서버 포트     |
| `DETAILS_URL` | `http://details.mesh-demo.svc.cluster.local:8080/info` | Details 서비스 URL |
| `RATINGS_URL` | `http://ratings.mesh-demo.svc.cluster.local:8080/rate` | Ratings 서비스 URL |

---

## 3. Details 서비스 (`apps/details/`)

### 목적

가변적인 응답 지연을 시뮬레이션하여 레이턴시 분석을 돕습니다.

### 기술 스택

- **런타임**: Node.js
- **프레임워크**: Express 4.18.2
- **포트**: 8080 (기본값)

### 엔드포인트

#### `GET /info`

- **동작**: MIN_MS ~ MAX_MS 범위의 랜덤 지연 후 응답
- **응답**:
  ```json
  {
    "service": "details",
    "delay_ms": 127,
    "ts": 1732896000000
  }
  ```
- **용도**: P50/P99 레이턴시 분포 관찰

#### `GET /healthz`

- **동작**: 헬스체크 엔드포인트
- **응답**: `"ok"`

### 파일 구조

```
details/
├── server.js      # Express 서버 (랜덤 지연 로직)
├── package.json   # 의존성 정의
└── Dockerfile     # 컨테이너 이미지 빌드 설정
```

### 코드 하이라이트

- [server.js:9](apps/details/server.js#L9): 랜덤 숫자 생성 함수
- [server.js:12-17](apps/details/server.js#L12-L17): 지연 후 응답 반환

### 환경 변수

| 변수           | 기본값 | 설명                    |
| -------------- | ------ | ----------------------- |
| `PORT`         | 8080   | HTTP 서버 포트          |
| `MIN_DELAY_MS` | 50     | 최소 지연 시간 (밀리초) |
| `MAX_DELAY_MS` | 200    | 최대 지연 시간 (밀리초) |

---

## 4. Ratings 서비스 (`apps/ratings/`)

### 목적

랜덤으로 5xx 에러를 발생시켜 에러율과 서킷 브레이커 동작을 시연합니다.

### 기술 스택

- **런타임**: Node.js
- **프레임워크**: Express 4.18.2
- **포트**: 8080 (기본값)

### 엔드포인트

#### `GET /rate`

- **동작**: ERROR_RATE 확률로 500 에러 반환, 그 외에는 정상 응답
- **성공 응답**:
  ```json
  {
    "service": "ratings",
    "rating": 4,
    "ts": 1732896000000
  }
  ```
- **에러 응답** (500):
  ```json
  {
    "service": "ratings",
    "error": "랜덤 5xx 오류"
  }
  ```
- **용도**: 에러율 및 재시도 로직 테스트

#### `GET /healthz`

- **동작**: 헬스체크 엔드포인트
- **응답**: `"ok"`

### 파일 구조

```
ratings/
├── server.js      # Express 서버 (랜덤 에러 생성)
├── package.json   # 의존성 정의
└── Dockerfile     # 컨테이너 이미지 빌드 설정
```

### 코드 하이라이트

- [server.js:9-17](apps/ratings/server.js#L9-L17): 확률적 에러 발생 로직

### 환경 변수

| 변수         | 기본값 | 설명                       |
| ------------ | ------ | -------------------------- |
| `PORT`       | 8080   | HTTP 서버 포트             |
| `ERROR_RATE` | 0.1    | 에러 발생 확률 (0.1 = 10%) |

---

## 빌드 및 배포

### 이미지 빌드 (Minikube 환경)

```bash
# 개별 빌드
minikube image build -t toy/ui:local ./apps/ui
minikube image build -t toy/api:local ./apps/api
minikube image build -t toy/details:local ./apps/details
minikube image build -t toy/ratings:local ./apps/ratings

# 또는 Makefile 사용
make images
```

### 로컬 실행 (개발용)

```bash
# UI 서비스
cd apps/ui && npm install && npm start

# API 서비스 (환경 변수 설정 필요)
cd apps/api && npm install && npm start

# Details 서비스
cd apps/details && npm install && npm start

# Ratings 서비스
cd apps/ratings && npm install && npm start
```

---

## Kiali에서 관찰 가능한 패턴

1. **빠른 트래픽**: UI → API → (Details + Ratings) 병렬 호출 그래프
2. **느린 트래픽**: API → Details 경로에서 높은 P99 레이턴시
3. **에러 트래픽**: API → Ratings 경로에서 5xx 에러율 (기본 10%)

모든 서비스는 `mesh-demo` 네임스페이스에 배포되며, Istio 사이드카가 자동 주입됩니다.
