import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()], // 기존에 있던 리액트 설정 (그대로 유지)

  // 👇 새로 추가된 부분: 서버 실행 시 브라우저 자동 열기
  server: {
    open: "/src/pages/main/main.html",
  },
});
