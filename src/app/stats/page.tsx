"use client";

import { useEffect, useState } from "react";

const LS_TOKEN = "geneasphere.token";

export default function StatsPage() {
  const [token, setToken] = useState("");
  const [json, setJson] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = localStorage.getItem(LS_TOKEN) ?? "";
    if (!t) {
      window.location.replace("/login");
      return;
    }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setErr("");
      const res = await fetch("/api/stats", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErr(j?.error ?? "Error");
        setJson(null);
        return;
      }
      setJson(j);
    })();
  }, [token]);

  return (
    <div style={{ minHeight: "100vh", background: "#050505", color: "#ddd", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>Stats</div>
        <a href="/tree" style={{ color: "#9db7ff", textDecoration: "none" }}>← Retour arbre</a>
      </div>

      {err ? <div style={{ marginTop: 12, color: "#ff6b6b" }}>{err}</div> : null}

      <div style={{ marginTop: 14, border: "1px solid #222", borderRadius: 14, background: "#0b0b0b", padding: 14 }}>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 8 }}>Réponse brute /api/stats</div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#ddd" }}>
{JSON.stringify(json, null, 2)}
        </pre>
      </div>
    </div>
  );
}
