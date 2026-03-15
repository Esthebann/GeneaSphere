"use client";

import { AuthPanel } from "@/components/AuthPanel";

const LS_TOKEN = "geneasphere.token";
const LS_ROLE = "geneasphere.role";

export default function LoginPage() {
  function onToken(token: string, role: "ADMIN" | "USER") {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_ROLE, role);
    window.location.assign("/tree");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050505", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <AuthPanel onToken={onToken} />
      </div>
    </div>
  );
}
