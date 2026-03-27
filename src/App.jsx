// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import LoginCard from "./pages/LoginCard";
import SignupCard from "./pages/SignupCard";
import SignupComplete from "./pages/SignupComplete";

function App() {
  return (
    <Routes>
      {/* ✅ 수정: /login으로 리다이렉트 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginCard />} />
      <Route path="/signup" element={<SignupCard />} />
      <Route path="/signup-complete" element={<SignupComplete />} />
      {/* 404 처리 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;