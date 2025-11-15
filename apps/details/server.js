const express = require("express");
const app = express();

// 환경 변수로 지연 시간 범위 설정
const MIN_MS = Number(process.env.MIN_DELAY_MS || 50);
const MAX_MS = Number(process.env.MAX_DELAY_MS || 200);

// 랜덤 숫자 생성 함수
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

// 정보 제공 엔드포인트: 랜덤 지연 후 응답
app.get("/info", async (_req, res) => {
  const ms = rand(MIN_MS, MAX_MS);
  // 지연 시뮬레이션
  await new Promise((r) => setTimeout(r, ms));
  res.json({ service: "details", delay_ms: ms, ts: Date.now() });
});

// 헬스체크 엔드포인트
app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Details 서버가 포트 ${PORT}에서 실행 중입니다`));
