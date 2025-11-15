import express from "express";
import fetch from "node-fetch";

const app = express();

// 환경 변수로 다운스트림 서비스 URL 설정
const DETAILS_URL =
  process.env.DETAILS_URL ||
  "http://details.mesh-demo.svc.cluster.local:8080/info";
const RATINGS_URL =
  process.env.RATINGS_URL ||
  "http://ratings.mesh-demo.svc.cluster.local:8080/rate";

// 지연 함수
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 빠른 엔드포인트: details와 ratings를 병렬로 호출
app.get("/fast", async (_req, res) => {
  try {
    // Kiali에서 명확한 엣지를 만들기 위한 팬아웃 호출
    const [d, r] = await Promise.all([
      fetch(DETAILS_URL).then((x) => x.json()),
      fetch(RATINGS_URL).then((x) => x.json()),
    ]);
    res.json({ ok: true, details: d, ratings: r });
  } catch (e) {
    res.status(502).json({ ok: false, error: "업스트림 오류" });
  }
});

// 느린 엔드포인트: 다운스트림 지연 시뮬레이션
app.get("/slow", async (_req, res) => {
  // 1초 지연
  await sleep(1000);
  try {
    const d = await fetch(DETAILS_URL).then((x) => x.json());
    res.json({ ok: true, details: d, delayed: true });
  } catch (e) {
    res.status(502).json({ ok: false, error: "details 실패" });
  }
});

// 에러 엔드포인트: ratings 서비스의 5xx 오류 유발
app.get("/error", async (_req, res) => {
  try {
    const r = await fetch(RATINGS_URL);
    if (!r.ok) return res.status(500).json({ ok: false, error: "ratings 5xx 오류" });
    res.json({ ok: true, ratings: await r.json() });
  } catch (e) {
    res.status(502).json({ ok: false, error: "ratings 접근 불가" });
  }
});

// 헬스체크 엔드포인트
app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API 서버가 포트 ${PORT}에서 실행 중입니다`));
