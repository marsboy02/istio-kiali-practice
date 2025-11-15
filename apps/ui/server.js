const express = require("express");
const path = require("path");
const app = express();

// 정적 파일 제공 (public 디렉토리)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`UI 서버가 포트 ${PORT}에서 실행 중입니다`));
