"use client";

import { useEffect, useState } from "react";
import { Btn, Field, Select } from "@/components/ui";

type UserRow = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
  isValidated: boolean;
  createdAt: string | null;
};

export function AdminPanel(props: { token: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [msg, setMsg] = useState<string>("");

  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("Password123!");
  const [createRole, setCreateRole] = useState<"ADMIN" | "USER">("USER");
  const [createValidated, setCreateValidated] = useState<"true" | "false">("true");

  const [editId, setEditId] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editValidated, setEditValidated] = useState<"keep" | "true" | "false">("keep");

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${props.token}`,
      },
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }

  async function refresh() {
    setMsg("");
    const r = await api("/api/admin/users", { method: "GET" });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setUsers(r.json.users as UserRow[]);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function validate(id: string) {
    setMsg("");
    const r = await api(`/api/admin/users/${id}/edit`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isValidated: true }),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("Validated.");
    refresh();
  }

  async function del(id: string) {
    setMsg("");
    const r = await api(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("Deleted.");
    refresh();
  }

  async function setRole(id: string, role: "ADMIN" | "USER") {
    setMsg("");
    const r = await api(`/api/admin/users/${id}/role`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("Role updated.");
    refresh();
  }

  async function createUser() {
    setMsg("");
    const r = await api("/api/admin/users/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: createEmail,
        password: createPassword,
        role: createRole,
        isValidated: createValidated === "true",
      }),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("User created.");
    setCreateEmail("");
    refresh();
  }

  async function editUser() {
    setMsg("");
    if (!editId.trim()) return setMsg("Pick a user first.");
    const body: any = {};
    if (editEmail.trim()) body.email = editEmail.trim();
    if (editValidated !== "keep") body.isValidated = editValidated === "true";

    const r = await api(`/api/admin/users/${editId}/edit`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("User updated.");
    setEditEmail("");
    setEditValidated("keep");
    refresh();
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #222", display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 900, color: "#fff" }}>Admin</div>

      <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, border: "1px solid #222", background: "#0b0b0b" }}>
        <div style={{ color: "#fff", fontWeight: 800 }}>Create user</div>
        <Field label="Email" value={createEmail} onChange={setCreateEmail} placeholder="user@x.dev" />
        <Field label="Password" value={createPassword} onChange={setCreatePassword} />
        <Select
          label="Role"
          value={createRole}
          onChange={(v) => setCreateRole(v as any)}
          options={[
            { value: "USER", label: "USER" },
            { value: "ADMIN", label: "ADMIN" },
          ]}
        />
        <Select
          label="Validated"
          value={createValidated}
          onChange={(v) => setCreateValidated(v as any)}
          options={[
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
        />
        <Btn label="Create" variant="primary" onClick={createUser} />
      </div>

      <div style={{ display: "grid", gap: 8, padding: 12, borderRadius: 12, border: "1px solid #222", background: "#0b0b0b" }}>
        <div style={{ color: "#fff", fontWeight: 800 }}>Edit user</div>

        <Select
          label="Select user"
          value={editId}
          onChange={(v) => setEditId(v)}
          options={[
            { value: "", label: "—" },
            ...users.map((u) => ({ value: u.id, label: `${u.email} (${u.role})` })),
          ]}
        />

        <Field label="New email (optional)" value={editEmail} onChange={setEditEmail} placeholder="leave blank to keep" />

        <Select
          label="Validated"
          value={editValidated}
          onChange={(v) => setEditValidated(v as any)}
          options={[
            { value: "keep", label: "keep" },
            { value: "true", label: "true" },
            { value: "false", label: "false" },
          ]}
        />

        <Btn label="Apply changes" variant="secondary" onClick={editUser} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ color: "#fff", fontWeight: 800 }}>Users</div>
        <Btn label="Refresh" variant="secondary" onClick={refresh} />

        <div style={{ display: "grid", gap: 8 }}>
          {users.map((u) => (
            <div key={u.id} style={{ padding: 10, borderRadius: 12, border: "1px solid #222", background: "#0f0f0f", color: "#ddd" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800, color: "#fff", fontSize: 13 }}>{u.email}</div>
                <div style={{ color: "#aaa", fontSize: 12 }}>{u.role} · {u.isValidated ? "validated" : "pending"}</div>
              </div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!u.isValidated ? <Btn label="Validate" variant="primary" onClick={() => validate(u.id)} /> : null}
                <Btn label="Make ADMIN" variant="secondary" onClick={() => setRole(u.id, "ADMIN")} />
                <Btn label="Make USER" variant="secondary" onClick={() => setRole(u.id, "USER")} />
                <Btn label="Delete" variant="danger" onClick={() => del(u.id)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {msg ? <div style={{ color: msg.toLowerCase().includes("error") ? "#ff6b6b" : "#2ea043" }}>{msg}</div> : null}
    </div>
  );
}
