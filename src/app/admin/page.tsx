"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";

const LS_TOKEN = "geneasphere.token";
const LS_ROLE = "geneasphere.role";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER" | "">("");

  useEffect(() => {
    const t = localStorage.getItem(LS_TOKEN) ?? "";
    const r = (localStorage.getItem(LS_ROLE) as any) ?? "";
    if (!t) {
      window.location.href = "/login";
      return;
    }
    setToken(t);
    setRole(r === "ADMIN" || r === "USER" ? r : "");
  }, []);

  if (!token) return null;

  if (role !== "ADMIN") {
    return (
      <div style={{ padding: 18, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ color: "#ff6b6b", fontWeight: 800 }}>Forbidden (ADMIN only)</div>
        <div style={{ marginTop: 10 }}>
          <a href="/tree" style={{ color: "#1f6feb" }}>Back to tree</a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", background: "#050505", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", border: "1px solid #222", borderRadius: 14, padding: 14, background: "#0b0b0b" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#fff", fontWeight: 900 }}>Admin</div>
          <a href="/tree" style={{ color: "#1f6feb" }}>Back</a>
        </div>
        <div style={{ marginTop: 12 }}>
          <AdminPanel token={token} />
        </div>
      </div>
    </div>
  );
}
