const express = require("express");
const app = express();

// 환경 변수로 에러 발생률 설정 (기본 10%)
const ERROR_RATE = Number(process.env.ERROR_RATE || 0.1);
const rand = () => Math.random();

// 평점 제공 엔드포인트: 랜덤으로 5xx 에러 발생
app.get("/rate", (_req, res) => {
  // ERROR_RATE 확률로 5xx 에러 반환
  if (rand() < ERROR_RATE) {
    return res.status(500).json({ service: "ratings", error: "랜덤 5xx 오류" });
  }
  // 3~5 사이의 랜덤 평점 생성
  const rating = Math.floor(3 + Math.random() * 3);
  res.json({ service: "ratings", rating, ts: Date.now() });
});

// 헬스체크 엔드포인트
app.get("/healthz", (_req, res) => res.send("ok"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Ratings 서버가 포트 ${PORT}에서 실행 중입니다`));
