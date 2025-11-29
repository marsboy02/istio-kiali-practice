# 🚀 Quick Start Guide - 완전 처음부터 시작하기

> 이 가이드는 아무것도 설치되지 않은 상태에서 Istio + Kiali 토이 프로젝트를 처음부터 끝까지 실행하는 방법을 설명합니다.

## 📋 사전 체크리스트

시작하기 전에 다음 항목들을 확인하세요:

- [ ] macOS, Linux, 또는 Windows (WSL2)
- [ ] 최소 8GB RAM (16GB 권장)
- [ ] 20GB 이상의 여유 디스크 공간
- [ ] 인터넷 연결

---

## 1단계: 기본 도구 설치

### 1.1 Docker 설치

**macOS:**

```bash
# Docker Desktop 다운로드 및 설치
# https://www.docker.com/products/docker-desktop

# 또는 Homebrew 사용
brew install --cask docker

# Docker Desktop 실행 및 로그인
```

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

**확인:**

```bash
docker --version
# 출력 예: Docker version 24.0.x
```

### 1.2 kubectl 설치

**macOS:**

```bash
# Homebrew 사용
brew install kubectl

# 또는 직접 다운로드
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

**Linux:**

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

**확인:**

```bash
kubectl version --client
```

### 1.3 Minikube 설치

**macOS:**

```bash
# Homebrew 사용
brew install minikube

# 또는 직접 다운로드
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-darwin-amd64
sudo install minikube-darwin-amd64 /usr/local/bin/minikube
```

**Linux:**

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube
```

**확인:**

```bash
minikube version
# 출력 예: minikube version: v1.32.0
```

---

## 2단계: Minikube 클러스터 시작

### 2.1 Minikube 시작

```bash
# 충분한 리소스로 Minikube 시작
minikube start --cpus=4 --memory=8192 --driver=docker

# 시작하는 데 2-5분 정도 걸립니다
# 출력에서 "Done! kubectl is now configured to use 'minikube'"를 확인하세요
```

**문제 해결:**

- `driver=docker` 오류 시: Docker Desktop이 실행 중인지 확인
- 메모리 부족 오류 시: `--memory=6144`로 줄여보세요
- HyperKit 오류 (macOS): `--driver=hyperkit` 대신 `--driver=docker` 사용

### 2.2 Minikube 상태 확인

```bash
# Minikube 상태 확인
minikube status

# 출력 예:
# minikube
# type: Control Plane
# host: Running
# kubelet: Running
# apiserver: Running
# kubeconfig: Configured

# kubectl이 정상 작동하는지 확인
kubectl get nodes

# 출력 예:
# NAME       STATUS   ROLES           AGE   VERSION
# minikube   Ready    control-plane   1m    v1.28.3
```

---

## 3단계: Istio 다운로드 및 설치

### 3.1 Istio 다운로드

```bash
# 홈 디렉토리로 이동
cd ~

# Istio 최신 버전 다운로드 (특정 버전을 원하면 ISTIO_VERSION 설정)
curl -L https://istio.io/downloadIstio | sh -

# 다운로드된 디렉토리 확인
ls -la | grep istio

# istio-1.20.2 (또는 다른 버전) 디렉토리가 보여야 합니다
```

### 3.2 istioctl PATH에 추가

**임시로 추가 (현재 터미널 세션만):**

```bash
# Istio 버전에 맞게 경로 조정
export PATH=$HOME/istio-1.20.2/bin:$PATH

# 확인
istioctl version
# 출력: no running Istio pods in "istio-system" (아직 설치 안 됨 - 정상)
```

**영구적으로 추가 (권장):**

**zsh 사용자 (macOS 기본):**

```bash
# .zshrc에 추가
echo 'export PATH="$HOME/istio-1.20.2/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**bash 사용자:**

```bash
# .bashrc에 추가
echo 'export PATH="$HOME/istio-1.20.2/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**확인:**

```bash
which istioctl
# 출력: /Users/your-username/istio-1.20.2/bin/istioctl
```

### 3.3 Istio 버전 확인

다운로드한 Istio 디렉토리 이름 확인:

```bash
ls -d ~/istio-*
# 출력 예: /Users/marsboy/istio-1.20.2
```

이 경로를 기억해두세요. 나중에 사용됩니다!

---

## 4단계: 프로젝트로 이동 및 Istio 설치

### 4.1 프로젝트 디렉토리로 이동

```bash
cd ~/sources/istio-kiali-practice

# 또는 프로젝트가 다른 위치에 있다면
cd /path/to/istio-kiali-practice
```

### 4.2 Istio 설치

```bash
# Makefile을 사용하여 Istio 설치
make istio

# 또는 수동으로
istioctl x precheck
istioctl install -y --set profile=default --set meshConfig.defaultConfig.tracing.sampling=100

# 설치하는 데 1-2분 정도 걸립니다
```

**출력 확인:**

```
✔ Istio core installed
✔ Istiod installed
✔ Ingress gateways installed
✔ Installation complete
```

### 4.3 Istio 시스템 파드 확인

```bash
# istio-system 네임스페이스의 파드 확인
kubectl get pods -n istio-system

# 다음 파드들이 Running 상태여야 합니다:
# NAME                                    READY   STATUS
# istiod-xxxxx                            1/1     Running
# istio-ingressgateway-xxxxx              1/1     Running
```

**문제 해결:**

- 파드가 Pending 상태: `kubectl describe pod <pod-name> -n istio-system`으로 확인
- 파드가 CrashLoopBackOff: Minikube 메모리 부족일 수 있음

---

## 5단계: 관측성 도구 설치 (Prometheus, Jaeger, Kiali)

### 5.1 애드온 설치

**방법 A - Makefile 사용 (권장):**

```bash
# Istio 버전에 맞게 경로 지정
make addons ISTIO_ADDONS_DIR=~/istio-1.20.2/samples/addons
```

**방법 B - 수동 설치:**

```bash
# Istio 버전에 맞게 경로 조정
kubectl apply -f ~/istio-1.20.2/samples/addons/prometheus.yaml
kubectl apply -f ~/istio-1.20.2/samples/addons/jaeger.yaml
kubectl apply -f ~/istio-1.20.2/samples/addons/kiali.yaml
```

### 5.2 애드온 파드 확인

```bash
# 모든 파드가 Running 상태가 될 때까지 대기
kubectl get pods -n istio-system -w

# 다음 파드들이 추가로 보여야 합니다:
# prometheus-xxxxx                        2/2     Running
# jaeger-xxxxx                            1/1     Running
# kiali-xxxxx                             1/1     Running

# Ctrl+C로 watch 모드 종료
```

**대기 시간:** 모든 파드가 Running 상태가 되는 데 2-5분 걸릴 수 있습니다.

---

## 6단계: 애플리케이션 배포

### 6.1 이미지 빌드 및 애플리케이션 배포

```bash
# 한 번에 모든 것을 배포
make deploy

# 또는 단계별로:
# make images        # 이미지 빌드 (2-3분 소요)
# make app           # 애플리케이션 배포
# make istio-routes  # Istio 라우팅 설정
```

**이미지 빌드 진행 상황:**

```
Building image for ui...
Building image for api...
Building image for details...
Building image for ratings...
```

### 6.2 애플리케이션 파드 확인

```bash
# mesh-demo 네임스페이스의 파드 확인
kubectl get pods -n mesh-demo

# 출력 예:
# NAME                      READY   STATUS    RESTARTS   AGE
# api-xxxxx                 2/2     Running   0          30s
# details-xxxxx             2/2     Running   0          30s
# ratings-xxxxx             2/2     Running   0          30s
# ui-xxxxx                  2/2     Running   0          30s
```

**주의:** `READY` 컬럼이 `2/2`인 것은 정상입니다:

- 1개는 애플리케이션 컨테이너
- 1개는 Istio 사이드카 프록시

### 6.3 서비스 확인

```bash
kubectl get svc -n mesh-demo

# 출력 예:
# NAME      TYPE        CLUSTER-IP      PORT(S)
# api       ClusterIP   10.x.x.x        8080/TCP
# details   ClusterIP   10.x.x.x        8080/TCP
# ratings   ClusterIP   10.x.x.x        8080/TCP
# ui        ClusterIP   10.x.x.x        8080/TCP
```

---

## 7단계: 애플리케이션 접근하기

### 7.1 Ingress Gateway 포트 포워딩 (가장 간단한 방법)

**새 터미널 창 열기 (이 프로세스는 계속 실행되어야 함):**

```bash
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80
```

**출력:**

```
Forwarding from 127.0.0.1:8080 -> 8080
Forwarding from [::1]:8080 -> 8080
```

### 7.2 브라우저에서 애플리케이션 열기

웹 브라우저를 열고 다음 주소로 이동:

```
http://localhost:8080
```

**보여야 할 화면:**

- **Istio-Kiali 토이 프로젝트** 제목
- 3개의 버튼 행:
  - 빠른 트래픽 시작/중지
  - 느린 트래픽 시작/중지
  - 에러 트래픽 시작/중지

### 7.3 대안: Minikube Tunnel 사용

**새 터미널 창에서:**

```bash
# 관리자 권한 필요 (비밀번호 입력 요구됨)
minikube tunnel
```

**Ingress IP 확인:**

```bash
kubectl -n istio-system get svc istio-ingressgateway

# EXTERNAL-IP 확인 (예: 127.0.0.1)
```

브라우저에서 `http://<EXTERNAL-IP>` 접속

---

## 8단계: 트래픽 생성 및 Kiali에서 확인

### 8.1 트래픽 생성

브라우저에서 UI (`http://localhost:8080`)에 접속하여:

1. **"빠른 트래픽 시작"** 버튼 클릭

   - 초록색 카운터가 올라가기 시작함
   - 200ms마다 요청 전송

2. **"느린 트래픽 시작"** 버튼 클릭

   - 1초마다 느린 요청 전송

3. **"에러 트래픽 시작"** 버튼 클릭
   - 빨간색 에러 카운터가 올라감 (의도된 동작)
   - 250ms마다 요청 전송

**1-2분간 실행 상태로 둡니다.** 메트릭이 축적되는 시간이 필요합니다.

### 8.2 Kiali 대시보드 열기

**새 터미널 창 열기:**

```bash
cd ~/sources/istio-kiali-practice
make kiali

# 또는 수동으로
kubectl -n istio-system port-forward svc/kiali 20001:20001
```

**출력:**

```
Forwarding from 127.0.0.1:20001 -> 20001
```

### 8.3 Kiali 접속

브라우저에서 다음 주소로 이동:

```
http://localhost:20001
```

### 8.4 서비스 그래프 보기

Kiali 대시보드에서:

1. 왼쪽 메뉴에서 **"Graph"** 클릭
2. 상단에서 **Namespace** 선택:
   - "mesh-demo" 선택
3. Display 옵션 조정:
   - **"Traffic Distribution"** 체크
   - **"Security"** 체크 (mTLS 자물쇠 아이콘 표시)
4. Edge Labels 선택:
   - **"Requests per second"**
   - **"Response time"**
   - **"Requests percentage"**

**보여야 할 것:**

```
        ┌──> [details]
        │
[ui] ──> [api]
        │
        └──> [ratings]
```

- 초록색 엣지: 정상 트래픽
- 빨간색 엣지: 에러가 있는 트래픽 (ratings)
- 자물쇠 아이콘: mTLS 활성화됨

---

## 9단계: 추가 관측 (선택사항)

### 9.1 Prometheus 접속

```bash
kubectl -n istio-system port-forward svc/prometheus 9090:9090
```

브라우저: `http://localhost:9090`

### 9.2 Jaeger 추적 접속

```bash
kubectl -n istio-system port-forward svc/jaeger 16686:16686
```

브라우저: `http://localhost:16686`

---

## 10단계: 정리하기

### 10.1 애플리케이션 제거

```bash
make clean
```

### 10.2 Istio 완전 제거 (선택사항)

```bash
istioctl uninstall -y --purge
kubectl delete namespace istio-system
```

### 10.3 Minikube 중지 또는 삭제

```bash
# 일시 중지 (나중에 다시 시작 가능)
minikube stop

# 완전히 삭제
minikube delete
```

---

## 🐛 일반적인 문제 해결

### 문제 1: "istioctl: command not found"

**해결:**

```bash
export PATH=$HOME/istio-1.20.2/bin:$PATH
# Istio 버전에 맞게 경로 조정
```

### 문제 2: "no such file or directory" (애드온 설치 시)

**해결:**

```bash
# Istio 디렉토리 확인
ls -d ~/istio-*

# 올바른 경로로 다시 시도
make addons ISTIO_ADDONS_DIR=~/istio-<version>/samples/addons
```

### 문제 3: Minikube가 시작되지 않음

**해결:**

```bash
# 기존 클러스터 삭제하고 재시작
minikube delete
minikube start --cpus=4 --memory=8192 --driver=docker
```

### 문제 4: 파드가 Pending 상태

**해결:**

```bash
# 리소스 확인
kubectl describe pod <pod-name> -n mesh-demo

# Minikube 리소스 부족 시
minikube stop
minikube start --cpus=4 --memory=10240
```

### 문제 5: Kiali에 그래프가 안 보임

**해결:**

1. UI에서 트래픽이 생성 중인지 확인
2. 30-60초 대기 (메트릭 수집 시간 필요)
3. Prometheus가 실행 중인지 확인:
   ```bash
   kubectl get pods -n istio-system | grep prometheus
   ```

### 문제 6: 브라우저에서 "Connection refused"

**해결:**

```bash
# 포트 포워딩이 실행 중인지 확인
ps aux | grep "port-forward"

# 포트 포워딩 재시작
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80
```

### 문제 7: DestinationRule 생성 시 "unknown field" 에러

**에러 메시지:**

```text
Error from server (BadRequest): error when creating "istio/destinationrule-api.yaml":
DestinationRule in version "v1beta1" cannot be handled as a DestinationRule:
strict decoding error: unknown field "spec.trafficPolicy.outlierDetection.consecutive5xx"
```

**원인:** Istio 최신 버전에서 API 필드명이 변경되었습니다.

**해결:** 이 에러는 이미 수정되었습니다. 만약 여전히 발생한다면:

```bash
# 기존 리소스 삭제
kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found

# 다시 적용
kubectl apply -f istio/destinationrule-api.yaml
```

**참고:** DestinationRule은 선택사항이므로, 이 에러가 발생해도 애플리케이션은 정상 작동합니다.

---

## 📚 유용한 명령어 모음

```bash
# 전체 상태 확인
minikube status
kubectl get pods -n istio-system
kubectl get pods -n mesh-demo
kubectl get svc -n istio-system
kubectl get svc -n mesh-demo

# 로그 확인
kubectl logs <pod-name> -n mesh-demo
kubectl logs <pod-name> -n mesh-demo -c istio-proxy  # 사이드카 로그

# 파드 상세 정보
kubectl describe pod <pod-name> -n mesh-demo

# 네임스페이스의 모든 리소스 확인
kubectl get all -n mesh-demo

# Istio 설정 확인
istioctl analyze -n mesh-demo

# 특정 파드에 접속 (디버깅)
kubectl exec -it <pod-name> -n mesh-demo -- /bin/sh
```

---

## ✅ 성공 체크리스트

모든 것이 정상 작동하면:

- [ ] `minikube status`에서 모든 항목이 "Running"
- [ ] `kubectl get pods -n istio-system`에서 모든 파드가 "Running"
- [ ] `kubectl get pods -n mesh-demo`에서 4개 파드 모두 "2/2 Running"
- [ ] `http://localhost:8080`에서 UI 접근 가능
- [ ] UI에서 버튼 클릭 시 카운터 증가
- [ ] `http://localhost:20001`에서 Kiali 대시보드 접근 가능
- [ ] Kiali Graph에서 서비스 그래프 표시
- [ ] 자물쇠 아이콘으로 mTLS 확인

---

## 🎉 완료!

축하합니다! Istio 서비스 메시와 Kiali 관측성을 성공적으로 실행했습니다.

**다음 단계:**

- Kiali에서 다양한 메트릭 탐색
- Jaeger에서 분산 추적 확인
- `istio/` 디렉토리의 설정 파일 수정 및 실험
- 추가 트래픽 패턴 생성 및 관찰

**질문이나 문제가 있으면:**

- [CLAUDE.md](CLAUDE.md) - AI 어시스턴트용 참조 문서
- [README.md](README.md) - 전체 프로젝트 문서
- Istio 공식 문서: https://istio.io/latest/docs/
- Kiali 공식 문서: https://kiali.io/docs/

즐거운 학습 되세요! 🚀
