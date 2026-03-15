"use client";

import { useState } from "react";
import { Btn, Field } from "@/components/ui";

type RegisterResponse = { userId: string; role: "ADMIN" | "USER"; isValidated: boolean };
type LoginResponse = { token: string; user: { userId: string; role: "ADMIN" | "USER" } };

export function AuthPanel(props: { onToken: (token: string, role: "ADMIN" | "USER") => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>("");

  async function register() {
    setMsg("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) return setMsg(json?.error ?? "Error");

    const r = json as RegisterResponse;
    if (r.role === "ADMIN" && r.isValidated) setMsg("Compte créé (ADMIN). Connecte-toi.");
    else setMsg("Compte créé. Attente validation ADMIN.");
    setMode("login");
  }

  async function login() {
    setMsg("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) return setMsg(json?.error ?? "Error");

    const r = json as LoginResponse;
    if (!r?.token || !r?.user?.role) return setMsg("Login response invalid");
    props.onToken(r.token, r.user.role);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, color: "#fff" }}>GeneaSphere</div>
        <div style={{ fontSize: 12, color: "#bbb" }}>
          Mode:&nbsp;
          <span
            onClick={() => setMode("login")}
            style={{ cursor: "pointer", color: mode === "login" ? "#fff" : "#888", fontWeight: 700 }}
          >
            Login
          </span>
          &nbsp;·&nbsp;
          <span
            onClick={() => setMode("register")}
            style={{ cursor: "pointer", color: mode === "register" ? "#fff" : "#888", fontWeight: 700 }}
          >
            Register
          </span>
        </div>
      </div>

      <Field label="Email" value={email} onChange={setEmail} placeholder="email" />
      <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="password" />

      {mode === "register" ? (
        <Btn label="Create account" variant="primary" onClick={register} />
      ) : (
        <Btn label="Login" variant="primary" onClick={login} />
      )}

      {msg ? (
        <div style={{ fontSize: 13, color: msg.toLowerCase().includes("error") ? "#ff6b6b" : "#2ea043" }}>{msg}</div>
      ) : null}
    </div>
  );
}
