# Istio + Kiali Toy Project (Minikube)

> **Goal**: With Minikube already running, spin up Istio and Kiali, deploy a tiny web app that generates traffic via buttons, and visualize it in Kiali.
>
> **What you get**: A self-contained repo layout, app code, Dockerfiles, Kubernetes/Istio manifests, and exact commands. You can hand this to an AI to scaffold/build/deploy the whole thing.

---

## 0) Prerequisites (assumed or quick-setup)

- **Minikube**: already started (`minikube start --cpus=4 --memory=8192` recommended)
- **kubectl** and **istioctl** installed
- **Helm** (optional; not required if you use Istio sample Addons)
- **Node.js 18+** (optional, if you build images locally outside Minikube)

> Tip: For Minikube image builds, you can use **`minikube image build`** so you don’t need a registry.

---

## 1) Repository Layout

```
istio-kiali-toy/
├── Makefile
├── README.md  # you can paste this file here
├── apps/
│   ├── ui/
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── public/
│   │   │   └── index.html
│   │   └── Dockerfile
│   ├── api/
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   ├── details/
│   │   ├── package.json
│   │   ├── server.js
│   │   └── Dockerfile
│   └── ratings/
│       ├── package.json
│       ├── server.js
│       └── Dockerfile
├── k8s/
│   └── base/
│       ├── namespace.yaml
│       ├── ui.yaml
│       ├── api.yaml
│       ├── details.yaml
│       ├── ratings.yaml
│       └── kustomization.yaml
└── istio/
    ├── peer-authentication.yaml
    ├── gateway-virtualservice.yaml
    └── destinationrule-api.yaml  # optional tuning
```

**Service graph at a glance**:

```
(ui)  ──HTTP──>  (api)  ──HTTP──>  (details)
                      └──HTTP──>  (ratings)
```

- **ui**: a simple web page with buttons that start/stop traffic loops
- **api**: fan-out endpoints that call **details** and **ratings**
- **details**: responds with small variable delay
- **ratings**: returns a rating with occasional 5xx errors

This gives Kiali a clear graph with success/latency/error edges.

---

## 2) Application Code

### 2.1 ui (Node/Express)

**`apps/ui/package.json`**

```json
{
  "name": "ui",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

**`apps/ui/server.js`**

```js
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`ui listening on ${PORT}`));
```

**`apps/ui/public/index.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Istio-Kiali Toy UI</title>
    <style>
      body {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        margin: 24px;
      }
      h1 {
        margin-bottom: 4px;
      }
      .row {
        display: flex;
        gap: 12px;
        align-items: center;
        margin: 8px 0;
      }
      button {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        cursor: pointer;
      }
      .stat {
        min-width: 120px;
        font-variant-numeric: tabular-nums;
      }
      .ok {
        color: #0a0;
      }
      .err {
        color: #a00;
      }
    </style>
  </head>
  <body>
    <h1>Istio-Kiali Toy</h1>
    <p>
      Use these buttons to generate traffic that will appear in
      <strong>Kiali</strong>.
    </p>

    <div class="row">
      <button id="fastStart">Start FAST</button>
      <button id="fastStop">Stop FAST</button>
      <span class="stat"
        >FAST: <span id="fastOk" class="ok">0</span> /
        <span id="fastErr" class="err">0</span></span
      >
    </div>
    <div class="row">
      <button id="slowStart">Start SLOW</button>
      <button id="slowStop">Stop SLOW</button>
      <span class="stat"
        >SLOW: <span id="slowOk" class="ok">0</span> /
        <span id="slowErr" class="err">0</span></span
      >
    </div>
    <div class="row">
      <button id="errorStart">Start ERROR</button>
      <button id="errorStop">Stop ERROR</button>
      <span class="stat"
        >ERROR: <span id="errorOk" class="ok">0</span> /
        <span id="errorErr" class="err">0</span></span
      >
    </div>

    <script>
      const counters = {
        fast: { ok: 0, err: 0, timer: null, path: "/api/fast", interval: 200 },
        slow: { ok: 0, err: 0, timer: null, path: "/api/slow", interval: 1000 },
        error: {
          ok: 0,
          err: 0,
          timer: null,
          path: "/api/error",
          interval: 250,
        },
      };

      function start(name) {
        const c = counters[name];
        if (c.timer) return;
        c.timer = setInterval(async () => {
          try {
            const res = await fetch(c.path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            c.ok++;
          } catch (e) {
            c.err++;
          } finally {
            document.getElementById(name + "Ok").textContent = c.ok;
            document.getElementById(name + "Err").textContent = c.err;
          }
        }, c.interval);
      }
      function stop(name) {
        const c = counters[name];
        if (c.timer) {
          clearInterval(c.timer);
          c.timer = null;
        }
      }

      document.getElementById("fastStart").onclick = () => start("fast");
      document.getElementById("fastStop").onclick = () => stop("fast");
      document.getElementById("slowStart").onclick = () => start("slow");
      document.getElementById("slowStop").onclick = () => stop("slow");
      document.getElementById("errorStart").onclick = () => start("error");
      document.getElementById("errorStop").onclick = () => stop("error");
    </script>
  </body>
</html>
```

**`apps/ui/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
EXPOSE 8080
CMD ["npm","start"]
```

---

### 2.2 api (Node/Express)

**`apps/api/package.json`**

```json
{
  "name": "api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-fetch": "^3.3.2"
  },
  "type": "module"
}
```

**`apps/api/server.js`**

```js
import express from "express";
import fetch from "node-fetch";

const app = express();
const DETAILS_URL =
  process.env.DETAILS_URL ||
  "http://details.mesh-demo.svc.cluster.local:8080/info";
const RATINGS_URL =
  process.env.RATINGS_URL ||
  "http://ratings.mesh-demo.svc.cluster.local:8080/rate";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.get("/fast", async (_req, res) => {
  try {
    // fan-out to make nice edges in Kiali
    const [d, r] = await Promise.all([
      fetch(DETAILS_URL).then((x) => x.json()),
      fetch(RATINGS_URL).then((x) => x.json()),
    ]);
    res.json({ ok: true, details: d, ratings: r });
  } catch (e) {
    res.status(502).json({ ok: false, error: "upstream error" });
  }
});

app.get("/slow", async (_req, res) => {
  // simulate downstream latency
  await sleep(1000);
  try {
    const d = await fetch(DETAILS_URL).then((x) => x.json());
    res.json({ ok: true, details: d, delayed: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: "details failed" });
  }
});

app.get("/error", async (_req, res) => {
  try {
    const r = await fetch(RATINGS_URL);
    if (!r.ok) return res.status(500).json({ ok: false, error: "ratings 5xx" });
    res.json({ ok: true, ratings: await r.json() });
  } catch (e) {
    res.status(502).json({ ok: false, error: "ratings unreachable" });
  }
});

app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`api listening on ${PORT}`));
```

**`apps/api/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
EXPOSE 8080
CMD ["npm","start"]
```

---

### 2.3 details (Node/Express)

**`apps/details/package.json`**

```json
{
  "name": "details",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

**`apps/details/server.js`**

```js
const express = require("express");
const app = express();

const MIN_MS = Number(process.env.MIN_DELAY_MS || 50);
const MAX_MS = Number(process.env.MAX_DELAY_MS || 200);
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

app.get("/info", async (_req, res) => {
  const ms = rand(MIN_MS, MAX_MS);
  await new Promise((r) => setTimeout(r, ms));
  res.json({ service: "details", delay_ms: ms, ts: Date.now() });
});

app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`details on ${PORT}`));
```

**`apps/details/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
EXPOSE 8080
CMD ["npm","start"]
```

---

### 2.4 ratings (Node/Express)

**`apps/ratings/package.json`**

```json
{
  "name": "ratings",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
```

**`apps/ratings/server.js`**

```js
const express = require("express");
const app = express();

const ERROR_RATE = Number(process.env.ERROR_RATE || 0.1); // 10% 5xx by default
const rand = () => Math.random();

app.get("/rate", (_req, res) => {
  if (rand() < ERROR_RATE) {
    return res.status(500).json({ service: "ratings", error: "random 5xx" });
  }
  const rating = Math.floor(3 + Math.random() * 3); // 3..5
  res.json({ service: "ratings", rating, ts: Date.now() });
});

app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`ratings on ${PORT}`));
```

**`apps/ratings/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm i --omit=dev
COPY . .
EXPOSE 8080
CMD ["npm","start"]
```

---

## 3) Kubernetes Manifests (Kustomize)

**`k8s/base/namespace.yaml`**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mesh-demo
  labels:
    istio-injection: enabled
```

**`k8s/base/ui.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ui
  namespace: mesh-demo
  labels: { app: ui, version: v1 }
spec:
  replicas: 1
  selector: { matchLabels: { app: ui, version: v1 } }
  template:
    metadata:
      labels: { app: ui, version: v1 }
    spec:
      containers:
        - name: ui
          image: toy/ui:local
          imagePullPolicy: IfNotPresent
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            { httpGet: { path: "/", port: 8080 }, initialDelaySeconds: 2 }
          resources:
            {
              requests: { cpu: "50m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            }
---
apiVersion: v1
kind: Service
metadata:
  name: ui
  namespace: mesh-demo
  labels: { app: ui }
spec:
  selector: { app: ui }
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

**`k8s/base/api.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: mesh-demo
  labels: { app: api, version: v1 }
spec:
  replicas: 1
  selector: { matchLabels: { app: api, version: v1 } }
  template:
    metadata:
      labels: { app: api, version: v1 }
    spec:
      containers:
        - name: api
          image: toy/api:local
          imagePullPolicy: IfNotPresent
          env:
            - name: DETAILS_URL
              value: http://details.mesh-demo.svc.cluster.local:8080/info
            - name: RATINGS_URL
              value: http://ratings.mesh-demo.svc.cluster.local:8080/rate
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            {
              httpGet: { path: "/healthz", port: 8080 },
              initialDelaySeconds: 2,
            }
          resources:
            {
              requests: { cpu: "50m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            }
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: mesh-demo
  labels: { app: api }
spec:
  selector: { app: api }
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

**`k8s/base/details.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: details
  namespace: mesh-demo
  labels: { app: details, version: v1 }
spec:
  replicas: 1
  selector: { matchLabels: { app: details, version: v1 } }
  template:
    metadata:
      labels: { app: details, version: v1 }
    spec:
      containers:
        - name: details
          image: toy/details:local
          imagePullPolicy: IfNotPresent
          env:
            - { name: MIN_DELAY_MS, value: "50" }
            - { name: MAX_DELAY_MS, value: "200" }
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            {
              httpGet: { path: "/healthz", port: 8080 },
              initialDelaySeconds: 2,
            }
          resources:
            {
              requests: { cpu: "50m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            }
---
apiVersion: v1
kind: Service
metadata:
  name: details
  namespace: mesh-demo
  labels: { app: details }
spec:
  selector: { app: details }
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

**`k8s/base/ratings.yaml`**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ratings
  namespace: mesh-demo
  labels: { app: ratings, version: v1 }
spec:
  replicas: 1
  selector: { matchLabels: { app: ratings, version: v1 } }
  template:
    metadata:
      labels: { app: ratings, version: v1 }
    spec:
      containers:
        - name: ratings
          image: toy/ratings:local
          imagePullPolicy: IfNotPresent
          env:
            - { name: ERROR_RATE, value: "0.1" } # 10% 5xx
          ports: [{ containerPort: 8080 }]
          readinessProbe:
            {
              httpGet: { path: "/healthz", port: 8080 },
              initialDelaySeconds: 2,
            }
          resources:
            {
              requests: { cpu: "50m", memory: "64Mi" },
              limits: { cpu: "200m", memory: "128Mi" },
            }
---
apiVersion: v1
kind: Service
metadata:
  name: ratings
  namespace: mesh-demo
  labels: { app: ratings }
spec:
  selector: { app: ratings }
  ports:
    - name: http
      port: 8080
      targetPort: 8080
```

**`k8s/base/kustomization.yaml`**

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: mesh-demo
resources:
  - namespace.yaml
  - ui.yaml
  - api.yaml
  - details.yaml
  - ratings.yaml
```

---

## 4) Istio Manifests

**`istio/peer-authentication.yaml`**

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: mesh-demo
spec:
  mtls:
    mode: STRICT
```

**`istio/gateway-virtualservice.yaml`**

```yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: ui-gw
  namespace: mesh-demo
spec:
  selector:
    istio: ingressgateway # matches the default Istio ingressgateway
  servers:
    - port: { number: 80, name: http, protocol: HTTP }
      hosts: ["*"]
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ui-vs
  namespace: mesh-demo
spec:
  hosts: ["*"]
  gateways: ["ui-gw"]
  http:
    - name: api
      match:
        - uri: { prefix: "/api" }
      route:
        - destination:
            { host: api.mesh-demo.svc.cluster.local, port: { number: 8080 } }
    - name: ui
      match:
        - uri: { prefix: "/" }
      route:
        - destination:
            { host: ui.mesh-demo.svc.cluster.local, port: { number: 8080 } }
```

**(Optional)** `istio/destinationrule-api.yaml` — circuit-breaking/outlier example for api

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-dr
  namespace: mesh-demo
spec:
  host: api.mesh-demo.svc.cluster.local
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 100
    outlierDetection:
      consecutive5xx: 3
      interval: 5s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

---

## 5) Build Images (Minikube)

From repo root:

```bash
# Build directly into Minikube’s image cache
minikube image build -t toy/ui:local ./apps/ui
minikube image build -t toy/api:local ./apps/api
minikube image build -t toy/details:local ./apps/details
minikube image build -t toy/ratings:local ./apps/ratings
```

> Alternative: `eval $(minikube docker-env)` then standard `docker build -t toy/ui:local apps/ui` …

---

## 6) Install Istio & Observability

> If you don’t have an Istio release unpacked yet, download one and make sure `istioctl` is on your PATH.

```bash
# precheck & install minimal (default) profile
istioctl x precheck
istioctl install -y \
  --set profile=default \
  --set meshConfig.defaultConfig.tracing.sampling=100

# Apply sample addons for Prometheus / Jaeger / Kiali (path may vary by Istio version)
# E.g., if you unpacked to ~/istio-X.Y.Z/ then:
ISTIO_ADDONS_DIR=~/istio-*/samples/addons
kubectl apply -f $ISTIO_ADDONS_DIR/prometheus.yaml
kubectl apply -f $ISTIO_ADDONS_DIR/jaeger.yaml
kubectl apply -f $ISTIO_ADDONS_DIR/kiali.yaml
```

Wait for pods in `istio-system` to be Ready:

```bash
kubectl get pods -n istio-system -w
```

---

## 7) Deploy the App & Istio Routes

```bash
# App workloads
kubectl apply -k k8s/base

# Istio policies & routing
kubectl apply -f istio/peer-authentication.yaml
kubectl apply -f istio/gateway-virtualservice.yaml
# optional
kubectl apply -f istio/destinationrule-api.yaml
```

Check pods:

```bash
kubectl get pods -n mesh-demo -w
```

---

## 8) Get an Ingress URL

### Option A) Via Minikube Tunnel (LoadBalancer)

```bash
# In a separate terminal
minikube tunnel

# Then get the external IP
kubectl -n istio-system get svc istio-ingressgateway
# Suppose EXTERNAL-IP is 127.0.0.1 or something like 10.XXX
```

Open: `http://<EXTERNAL-IP>/` (UI) — it will call `/api/*` through the same host.

### Option B) Port-forward the IngressGateway

```bash
kubectl -n istio-system port-forward svc/istio-ingressgateway 8080:80
```

Open: `http://localhost:8080/`

---

## 9) Generate Traffic from the UI

- Click **Start FAST / SLOW / ERROR** to begin request loops
- Watch counters tick up; **ERROR** will drive 5xx via `ratings`
- Leave it running for ~1–2 minutes to build up metrics

---

## 10) Open Kiali & Explore

```bash
kubectl -n istio-system port-forward svc/kiali 20001:20001
```

Open **http://localhost:20001** → _Graph_ → Namespace = `mesh-demo`

What to look for:

- Edges from **ui → api → (details/ratings)**
- Toggle Edge Labels: **Requests/sec**, **Error rate**, **Response time**
- **Security** tab shows mTLS (from PeerAuthentication STRICT)
- **Traces** tab (if Jaeger is up & sampling is 100%)

---

## 11) Makefile (optional convenience)

**`Makefile`**

```makefile
ISTIO_ADDONS_DIR ?= ~/istio-*/samples/addons

.PHONY: images deploy istio addons app istio-routes kiali url clean

images:
	minikube image build -t toy/ui:local ./apps/ui
	minikube image build -t toy/api:local ./apps/api
	minikube image build -t toy/details:local ./apps/details
	minikube image build -t toy/ratings:local ./apps/ratings

deploy: images app istio-routes

istio:
	istioctl x precheck
	istioctl install -y --set profile=default --set meshConfig.defaultConfig.tracing.sampling=100

addons:
	kubectl apply -f $(ISTIO_ADDONS_DIR)/prometheus.yaml
	kubectl apply -f $(ISTIO_ADDONS_DIR)/jaeger.yaml
	kubectl apply -f $(ISTIO_ADDONS_DIR)/kiali.yaml

app:
	kubectl apply -k k8s/base

istio-routes:
	kubectl apply -f istio/peer-authentication.yaml
	kubectl apply -f istio/gateway-virtualservice.yaml
	- kubectl apply -f istio/destinationrule-api.yaml

kiali:
	kubectl -n istio-system port-forward svc/kiali 20001:20001

url:
	@echo "If using port-forward: http://localhost:8080" \
	&& echo "If using tunnel, check: kubectl -n istio-system get svc istio-ingressgateway"

clean:
	kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found
	kubectl delete -f istio/gateway-virtualservice.yaml --ignore-not-found
	kubectl delete -f istio/peer-authentication.yaml --ignore-not-found
	kubectl delete ns mesh-demo --ignore-not-found
```

---

## 12) Troubleshooting

- **No graph in Kiali**: Ensure traffic actually flows for ~30–60s. Check Prometheus is running in `istio-system`.
- **503/502 from api**: `ratings` returns 5xx randomly by design; that’s OK. Ensure services resolve: `kubectl exec` into `api` and `curl http://details.mesh-demo:8080/info`.
- **mTLS issues**: If STRICT blocks something, confirm all workloads have sidecars (namespace label `istio-injection=enabled`).
- **Ingress URL**: Prefer `minikube tunnel`; otherwise use port-forward on ingressgateway.
- **Traces missing**: Make sure Jaeger pod is Running and sampling is high (we set 100%). It can still take a minute to show up.

---

## 13) Optional Extensions

- Add a **canary** for `api` with `version: v2` and a `VirtualService` that splits traffic 80/20.
- Add **fault injection** (delay/abort) for the `details`/`ratings` routes to see error/latency spikes.
- Deploy **Grafana** (already included in some addon sets) and import Istio dashboards.

---

## 14) Clean Up

```bash
# Remove app and Istio objects created here
kubectl delete -f istio/destinationrule-api.yaml --ignore-not-found
kubectl delete -f istio/gateway-virtualservice.yaml --ignore-not-found
kubectl delete -f istio/peer-authentication.yaml --ignore-not-found
kubectl delete ns mesh-demo --ignore-not-found

# Optional: remove addons and/or uninstall Istio
# kubectl delete -f $ISTIO_ADDONS_DIR/kiali.yaml
# kubectl delete -f $ISTIO_ADDONS_DIR/jaeger.yaml
# kubectl delete -f $ISTIO_ADDONS_DIR/prometheus.yaml
# istioctl uninstall -y --purge
```

---

## 15) What You’ll See in Kiali

- A clear service graph with edges `ui → api → (details, ratings)`
- **FAST** loop shows stable low-latency, **SLOW** shows increased response times, **ERROR** shows 5xx on `ratings`
- mTLS padlock icons (namespace STRICT)
- Optional tracing if Jaeger is enabled

---

**That’s it.** Paste this markdown into your repo as `README.md`, then follow the steps or hand it to an AI to scaffold the f
