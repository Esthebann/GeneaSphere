"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { TreeView } from "@/components/TreeView";
import { EditorPanel } from "@/components/EditorPanel";
import { Btn, Field } from "@/components/ui";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F" | "X";
  visibility: "PUBLIC" | "PRIVATE";
  unions: string[];
  parentUnion: string | null;
  version: number;

  birthDate?: string | null;
  deathDate?: string | null;

  photoUrl?: string | null;
  professions?: string[];
  addresses?: string[];
  phones?: string[];
  emails?: string[];
  notes?: string | null;
};

type Union = {
  id: string;
  partners: string[];
  children: string[];
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
};

type LayoutNode = { id: string; type: "MEMBER" | "UNION"; x: number; y: number };

type LayoutResponse = { members: Member[]; unions: Union[]; layout: LayoutNode[] };

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F" | "X";
  visibility: "PUBLIC" | "PRIVATE";
  parentUnion: string | null;
};

const LS_TOKEN = "geneasphere.token";
const LS_ROLE = "geneasphere.role";

type ViewMode = "ALL" | "ASC" | "DESC" | "SIB";
type LayoutMode = "generation" | "timeline";

export default function TreePage() {
  const [booted, setBooted] = useState(false);

  const [token, setToken] = useState("");
  const [role, setRole] = useState<"ADMIN" | "USER" | "">("");

  const [data, setData] = useState<LayoutResponse | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ id: string; type: "MEMBER" | "UNION" } | null>(null);

  const [focusMode, setFocusMode] = useState(true);
  const [focusHide, setFocusHide] = useState(true);
  const [focusRadius, setFocusRadius] = useState(2);

  const [expandedUnionIds, setExpandedUnionIds] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");
  const [searchMsg, setSearchMsg] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);

  const [viewMode, setViewMode] = useState<ViewMode>("ALL");

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("generation");
  const [bucket, setBucket] = useState(10);

  const memberMap = useMemo(() => new Map((data?.members ?? []).map((m) => [m.id, m])), [data]);
  const unionMap = useMemo(() => new Map((data?.unions ?? []).map((u) => [u.id, u])), [data]);

  useEffect(() => {
    setBooted(true);
  }, []);

  useEffect(() => {
    if (!booted) return;

    const savedToken = localStorage.getItem(LS_TOKEN) ?? "";
    const savedRole = (localStorage.getItem(LS_ROLE) as any) ?? "";

    if (savedToken && !token) {
      setToken(savedToken);
      setRole(savedRole === "ADMIN" || savedRole === "USER" ? savedRole : "");
      return;
    }

    }, [booted, token]);

  async function load(tk: string) {
    setError("");
    const t = tk.trim();
    if (!t) return;

    const url = `/api/layout?mode=${layoutMode}&bucket=${bucket}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" });
    const json = (await res.json().catch(() => null)) as any;

    if (!res.ok) {
      setError(json?.error ?? "Error");
      setData(null);
      return;
    }
    setData(json as LayoutResponse);
  }

  useEffect(() => {
    if (!booted) return;
    if (!token) return;
    load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, token, layoutMode, bucket]);

  function logout() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_ROLE);
    setToken("");
    setRole("");
    setData(null);
    setSelected(null);
    setExpandedUnionIds(new Set());
    setError("");
    setQ("");
    setResults([]);
    setSearchMsg("");
    setViewMode("ALL");
    window.location.replace("/login");
  }

  function toggleUnion(unionId: string) {
    setExpandedUnionIds((prev) => {
      const next = new Set(prev);
      if (next.has(unionId)) next.delete(unionId);
      else next.add(unionId);
      return next;
    });
  }

  function expandAllUnionsOfSelectedMember() {
    if (!selected || selected.type !== "MEMBER") return;
    const m = memberMap.get(selected.id);
    if (!m) return;
    setExpandedUnionIds((prev) => {
      const next = new Set(prev);
      for (const u of m.unions) next.add(u);
      return next;
    });
  }

  function collapseAll() {
    setExpandedUnionIds(new Set());
  }

  function modeSoutenance() {
    setFocusMode(true);
    setFocusHide(true);
    setFocusRadius(2);
    setViewMode("ALL");
    setLayoutMode("generation");
    setBucket(10);
  }

  async function runSearch() {
    setSearchMsg("");
    setResults([]);
    const s = q.trim();
    if (!s) return;

    const res = await fetch(`/api/search?q=${encodeURIComponent(s)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) return setSearchMsg(json?.error ?? "Error");

    setResults((json?.results ?? []) as SearchResult[]);
    if ((json?.results ?? []).length === 0) setSearchMsg("No results.");
  }

  function pickResult(r: SearchResult) {
    setSelected({ id: r.id, type: "MEMBER" });
    setFocusMode(true);
    setFocusHide(true);
    setFocusRadius(2);
    setViewMode("ALL");
  }

  const visibleOnlyIds = useMemo(() => {
    if (!data) return null;
    if (!selected || selected.type !== "MEMBER") return null;
    if (viewMode === "ALL") return null;

    const out = new Set<string>();
    const startId = selected.id;

    function addMember(id: string) {
      out.add(id);
      const m = memberMap.get(id);
      if (!m) return;
      for (const uid of m.unions) out.add(uid);
      if (m.parentUnion) out.add(m.parentUnion);
    }

    function addUnion(id: string) {
      out.add(id);
      const u = unionMap.get(id);
      if (!u) return;
      for (const p of u.partners) out.add(p);
      for (const c of u.children) out.add(c);
    }

    if (viewMode === "ASC") {
      const seenM = new Set<string>();
      let frontier = [startId];
      for (let depth = 0; depth < 6; depth++) {
        const next: string[] = [];
        for (const mid of frontier) {
          if (seenM.has(mid)) continue;
          seenM.add(mid);
          const m = memberMap.get(mid);
          if (!m) continue;
          addMember(mid);
          if (m.parentUnion) {
            addUnion(m.parentUnion);
            const u = unionMap.get(m.parentUnion);
            if (u) for (const p of u.partners) { addMember(p); next.push(p); }
          }
        }
        frontier = next;
        if (!frontier.length) break;
      }
      return out;
    }

    if (viewMode === "DESC") {
      const seenM = new Set<string>();
      let frontier = [startId];
      for (let depth = 0; depth < 6; depth++) {
        const next: string[] = [];
        for (const mid of frontier) {
          if (seenM.has(mid)) continue;
          seenM.add(mid);
          const m = memberMap.get(mid);
          if (!m) continue;
          addMember(mid);
          for (const uid of m.unions) {
            addUnion(uid);
            const u = unionMap.get(uid);
            if (u) for (const c of u.children) { addMember(c); next.push(c); }
          }
        }
        frontier = next;
        if (!frontier.length) break;
      }
      return out;
    }

    if (viewMode === "SIB") {
      const m = memberMap.get(startId);
      addMember(startId);
      if (!m || !m.parentUnion) return out;
      addUnion(m.parentUnion);
      const u = unionMap.get(m.parentUnion);
      if (!u) return out;
      for (const p of u.partners) addMember(p);
      for (const c of u.children) addMember(c);
      return out;
    }

    return null;
  }, [data, selected, viewMode, memberMap, unionMap]);

  if (!booted) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", color: "#aaa", padding: 18, fontFamily: "system-ui, sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (!token) {
    return (
      <div style={{ minHeight: "100vh", background: "#050505", color: "#aaa", padding: 18, fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center" }}>
        <div style={{ width: 460, border: "1px solid #222", borderRadius: 14, padding: 16, background: "#0b0b0b" }}>
          <div style={{ fontWeight: 900, color: "#fff", marginBottom: 8 }}>No session</div>
          <div style={{ fontSize: 13, color: "#bbb", marginBottom: 12 }}>
            Tu n'es pas connecté (token absent). Va sur /login.
          </div>
          <button
            onClick={() => window.location.href = "/login"}
            style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #1f6feb", background: "#1f6feb", color: "#fff", cursor: "pointer", fontWeight: 700 }}
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }
return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#050505", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ padding: 12, borderBottom: "1px solid #222", display: "flex", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900, color: "#fff" }}>GeneaSphere</div>

        <Btn label="Refresh" variant="secondary" onClick={() => load(token)} />
        <Btn label="Soutenance" variant="secondary" onClick={modeSoutenance} />

        <Btn
          label={layoutMode === "generation" ? "Timeline" : "Generations"}
          variant="secondary"
          onClick={() => setLayoutMode((m) => (m === "generation" ? "timeline" : "generation"))}
        />

        <Btn
          label={`Bucket ${bucket}y`}
          variant="secondary"
          onClick={() => setBucket((b) => (b === 10 ? 5 : 10))}
          disabled={layoutMode !== "timeline"}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ color: "#bbb", fontSize: 12 }}>{role}</div>
          <Btn label="Logout" variant="danger" onClick={logout} />
        
        <a
          href="/stats"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "#111",
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 13,
            display: "inline-block",
          }}
        >
          Stats
        </a>
</div>
      </div>

      <div style={{ flex: 1, display: "flex", gap: 16, padding: 16 }}>
        <div style={{ width: 460, border: "1px solid #222", borderRadius: 14, padding: 14, background: "#0b0b0b", overflow: "auto" }}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 800, color: "#fff" }}>Navigation</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn label="All" variant={viewMode === "ALL" ? "primary" : "secondary"} onClick={() => setViewMode("ALL")} />
              <Btn label="Asc" variant={viewMode === "ASC" ? "primary" : "secondary"} onClick={() => setViewMode("ASC")} disabled={!selected || selected.type !== "MEMBER"} />
              <Btn label="Desc" variant={viewMode === "DESC" ? "primary" : "secondary"} onClick={() => setViewMode("DESC")} disabled={!selected || selected.type !== "MEMBER"} />
              <Btn label="Sib" variant={viewMode === "SIB" ? "primary" : "secondary"} onClick={() => setViewMode("SIB")} disabled={!selected || selected.type !== "MEMBER"} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <Field label="Search" value={q} onChange={setQ} placeholder="Durand" />
              <Btn label="Go" variant="primary" onClick={runSearch} />
            </div>

            {searchMsg ? <div style={{ fontSize: 12, color: "#bbb" }}>{searchMsg}</div> : null}

            {results.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {results.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => pickResult(r)}
                    style={{ padding: 10, borderRadius: 12, border: "1px solid #222", background: "#111", cursor: "pointer", color: "#fff", display: "flex", justifyContent: "space-between", gap: 10 }}
                  >
                    <div>{r.firstName} {r.lastName}</div>
                    <div style={{ fontSize: 12, color: "#bbb" }}>{r.sex} · {r.visibility}</div>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ borderTop: "1px solid #222", paddingTop: 12, marginTop: 4, display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 800, color: "#fff" }}>Focus</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn label={focusMode ? "Focus ON" : "Focus OFF"} variant={focusMode ? "primary" : "secondary"} onClick={() => setFocusMode((v) => !v)} />
                <Btn label={focusHide ? "Hide outside" : "Dim outside"} variant={focusHide ? "primary" : "secondary"} onClick={() => setFocusHide((v) => !v)} disabled={!focusMode} />
                <Btn label={`Radius ${focusRadius}`} variant="secondary" onClick={() => setFocusRadius((r) => (r >= 4 ? 1 : r + 1))} disabled={!focusMode} />
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn label="Expand unions" variant="secondary" onClick={expandAllUnionsOfSelectedMember} disabled={!selected || selected.type !== "MEMBER"} />
                <Btn label="Collapse all" variant="secondary" onClick={collapseAll} />
              </div>
            </div>

            {role === "ADMIN" ? (
              <div style={{ borderTop: "1px solid #222", paddingTop: 12 }}>
                <AdminPanel token={token} />
              </div>
            ) : null}

            {data ? <EditorPanel data={data} selected={selected} onDone={() => load(token)} /> : null}

            {error ? <div style={{ color: "#ff6b6b" }}>{error}</div> : null}
          </div>
        </div>

        <div style={{ flex: 1, border: "1px solid #222", borderRadius: 14, overflow: "hidden", background: "#0b0b0b" }}>
          {data ? (
            <TreeView
              data={data}
              selected={selected}
              onSelect={setSelected}
              focusMode={focusMode}
              focusHideOutside={focusHide}
              focusRadius={focusRadius}
              expandedUnionIds={expandedUnionIds}
              onToggleUnion={toggleUnion}
              visibleOnlyIds={visibleOnlyIds}
            />
          ) : (
            <div style={{ padding: 18, color: "#aaa" }}>Loading tree...</div>
          )}
        </div>
      </div>
    </div>
  );
}
