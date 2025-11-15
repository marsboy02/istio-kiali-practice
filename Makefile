# Istio 애드온 디렉토리 경로 (Istio 다운로드 위치에 따라 조정)
ISTIO_ADDONS_DIR ?= ~/istio-*/samples/addons

.PHONY: images deploy istio addons app istio-routes kiali url clean

# 모든 서비스의 컨테이너 이미지를 Minikube에 빌드
images:
	minikube image build -t toy/ui:local ./apps/ui
	minikube image build -t toy/api:local ./apps/api
	minikube image build -t toy/details:local ./apps/details
	minikube image build -t toy/ratings:local ./apps/ratings

# 전체 배포: 이미지 빌드 + 애플리케이션 배포 + Istio 라우팅 설정
deploy: images app istio-routes

# Istio 설치 (기본 프로파일 + 100% 트레이싱)
istio:
	istioctl x precheck
	istioctl install -y --set profile=default --set meshConfig.defaultConfig.tracing.sampling=100

# 관측성 도구 설치 (Prometheus, Jaeger, Kiali)
addons:
	kubectl apply -f $(ISTIO_ADDONS_DIR)/prometheus.yaml
	kubectl apply -f $(ISTIO_ADDONS_DIR)/jaeger.yaml
	kubectl apply -f $(ISTIO_ADDONS_DIR)/kiali.yaml

# 애플리케이션 워크로드 배포
app:
	kubectl apply -k k8s/base

# Istio 라우팅 규칙 적용
istio-routes:
	kubectl apply -f istio/peer-authentication.yaml
	kubectl apply -f istio/gateway-virtualservice.yaml
	- kubectl apply -f istio/destinationrule-api.yaml

# Kiali 대시보드 포트 포워딩 (http://localhost:20001)
kiali:
	kubectl -n istio-system port-forward svc/kiali 20001:20001

# 애플리케이션 접근 URL 안내
url:
	@echo "포트 포워딩 사용 시: http://localhost:8080" \
	&& echo "터널 사용 시 확인: kubectl -n istio-system get svc istio-ingressgateway"

# 모든 리소스 정리
clean:
	kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found
	kubectl delete -f istio/gateway-virtualservice.yaml --ignore-not-found
	kubectl delete -f istio/peer-authentication.yaml --ignore-not-found
	kubectl delete ns mesh-demo --ignore-not-found
