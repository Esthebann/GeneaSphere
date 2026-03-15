"use client";

import { useEffect, useMemo, useState } from "react";
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

type LayoutResponse = {
  members: Member[];
  unions: Union[];
  layout: any[];
};

const LS_TOKEN = "geneasphere.token";

function isoToYmd(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return "";
  }
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToApi(v: string) {
  const s = v.trim();
  return s ? s : undefined;
}

async function api(path: string, init?: RequestInit) {
  const token = localStorage.getItem(LS_TOKEN) ?? "";
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as any;
  return { ok: res.ok, status: res.status, json };
}

export function EditorPanel(props: {
  data: LayoutResponse;
  selected: { id: string; type: "MEMBER" | "UNION" } | null;
  onDone: () => void;
}) {
  const [msg, setMsg] = useState("");

  const selectedMember = useMemo(() => {
    if (!props.selected || props.selected.type !== "MEMBER") return null;
    return props.data.members.find((m) => m.id === props.selected!.id) ?? null;
  }, [props.selected, props.data.members]);

  const selectedUnion = useMemo(() => {
    if (!props.selected || props.selected.type !== "UNION") return null;
    return props.data.unions.find((u) => u.id === props.selected!.id) ?? null;
  }, [props.selected, props.data.unions]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [sex, setSex] = useState<"M" | "F" | "X">("X");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [unionStatus, setUnionStatus] = useState("MARRIED");

  const [fatherFirst, setFatherFirst] = useState("Father");
  const [fatherLast, setFatherLast] = useState("Family");
  const [motherFirst, setMotherFirst] = useState("Mother");
  const [motherLast, setMotherLast] = useState("Family");
  const [parentsVisibility, setParentsVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  useEffect(() => {
    setMsg("");
    if (!selectedMember) return;
    setFirstName(selectedMember.firstName ?? "");
    setLastName(selectedMember.lastName ?? "");
    setSex(selectedMember.sex ?? "X");
    setVisibility(selectedMember.visibility ?? "PUBLIC");
    setBirthDate(isoToYmd(selectedMember.birthDate));
    setDeathDate(isoToYmd(selectedMember.deathDate));
  }, [selectedMember?.id]);

  async function refreshSelected() {
    setMsg("");
    if (!props.selected) return;

    if (props.selected.type === "MEMBER") {
      const r = await api(`/api/members/${props.selected.id}`, { method: "GET" });
      if (!r.ok) return setMsg(r.json?.error ?? "Error");
      setFirstName(r.json.firstName ?? "");
      setLastName(r.json.lastName ?? "");
      setSex(r.json.sex ?? "X");
      setVisibility(r.json.visibility ?? "PUBLIC");
      setBirthDate(isoToYmd(r.json.birthDate));
      setDeathDate(isoToYmd(r.json.deathDate));
      setMsg("Loaded.");
      return;
    }

    const r = await api(`/api/unions/${props.selected.id}`, { method: "GET" });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setUnionStatus(r.json.status ?? "MARRIED");
    setMsg("Loaded.");
  }

  async function createMember() {
    setMsg("");
    const body: any = {
      firstName: firstName.trim() || "New",
      lastName: lastName.trim() || "Member",
      sex,
      visibility,
      birthDate: ymdToApi(birthDate),
      deathDate: ymdToApi(deathDate),
    };

    const r = await api("/api/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");

    setMsg("Member created.");
    props.onDone();
  }

  async function saveMember() {
    setMsg("");
    if (!props.selected || props.selected.type !== "MEMBER") return;

    const current = await api(`/api/members/${props.selected.id}`, { method: "GET" });
    if (!current.ok) return setMsg(current.json?.error ?? "Error");

    const body: any = {
      version: current.json.version,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      sex,
      visibility,
      birthDate: ymdToApi(birthDate),
      deathDate: ymdToApi(deathDate),
    };

    const r = await api(`/api/members/${props.selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");

    setMsg("Saved.");
    props.onDone();
  }

  async function addParents() {
    setMsg("");
    if (!props.selected || props.selected.type !== "MEMBER") return;

    const child = await api(`/api/members/${props.selected.id}`, { method: "GET" });
    if (!child.ok) return setMsg(child.json?.error ?? "Error");

    const r = await api(`/api/members/${props.selected.id}/parents`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        father: {
          firstName: fatherFirst,
          lastName: fatherLast,
          sex: "M",
          visibility: parentsVisibility,
        },
        mother: {
          firstName: motherFirst,
          lastName: motherLast,
          sex: "F",
          visibility: parentsVisibility,
        },
        childVersion: child.json.version,
        status: "PARENTS",
      }),
    });

    if (!r.ok) return setMsg(r.json?.error ?? "Error");
    setMsg("Parents added.");
    props.onDone();
  }

  async function addPartner() {
    setMsg("");
    if (!props.selected || props.selected.type !== "MEMBER") return;

    const spouse = await api("/api/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim() || "Partner",
        lastName: lastName.trim() || "Partner",
        sex,
        visibility,
        birthDate: ymdToApi(birthDate),
        deathDate: ymdToApi(deathDate),
      }),
    });
    if (!spouse.ok) return setMsg(spouse.json?.error ?? "Error");

    const u = await api("/api/unions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        partnerIds: [props.selected.id, spouse.json.id],
        status: unionStatus || "MARRIED",
      }),
    });
    if (!u.ok) return setMsg(u.json?.error ?? "Error");

    setMsg("Partner added.");
    props.onDone();
  }

  async function addChild() {
    setMsg("");
    if (!props.selected || props.selected.type !== "UNION") return;

    const currentUnion = await api(`/api/unions/${props.selected.id}`, { method: "GET" });
    if (!currentUnion.ok) return setMsg(currentUnion.json?.error ?? "Error");

    const child = await api("/api/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim() || "Child",
        lastName: lastName.trim() || "Child",
        sex,
        visibility,
        birthDate: ymdToApi(birthDate),
        deathDate: ymdToApi(deathDate),
      }),
    });
    if (!child.ok) return setMsg(child.json?.error ?? "Error");

    const r = await api(`/api/unions/${props.selected.id}/children`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        childId: child.json.id,
        version: currentUnion.json.version,
      }),
    });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");

    setMsg("Child added.");
    props.onDone();
  }

  async function deleteMember() {
    setMsg("");
    if (!props.selected || props.selected.type !== "MEMBER") return;

    const r = await api(`/api/members/${props.selected.id}`, { method: "DELETE" });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");

    setMsg("Member deleted.");
    props.onDone();
  }

  async function deleteUnion() {
    setMsg("");
    if (!props.selected || props.selected.type !== "UNION") return;

    const r = await api(`/api/unions/${props.selected.id}`, { method: "DELETE" });
    if (!r.ok) return setMsg(r.json?.error ?? "Error");

    setMsg("Union deleted.");
    props.onDone();
  }

  if (!props.selected) {
    return (
      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Create member</div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="First name" value={firstName} onChange={setFirstName} placeholder="First name" />
          <Field label="Last name" value={lastName} onChange={setLastName} placeholder="Last name" />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Sex (M/F/X)" value={sex} onChange={(v) => setSex((v as any) || "X")} placeholder="M/F/X" />
          <Field label="Visibility (PUBLIC/PRIVATE)" value={visibility} onChange={(v) => setVisibility((v as any) || "PUBLIC")} placeholder="PUBLIC/PRIVATE" />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Birth date (YYYY-MM-DD)" value={birthDate} onChange={setBirthDate} placeholder="1999-04-12" />
          <Field label="Death date (YYYY-MM-DD)" value={deathDate} onChange={setDeathDate} placeholder="2020-01-01" />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn label="Create new member" variant="primary" onClick={createMember} />
        </div>

        {msg ? (
          <div style={{ fontSize: 13, color: msg.toLowerCase().includes("error") ? "#ff6b6b" : "#2ea043" }}>{msg}</div>
        ) : null}
      </div>
    );
  }

  if (props.selected.type === "UNION") {
    return (
      <div style={{ padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 800 }}>Union</div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Child first name" value={firstName} onChange={setFirstName} placeholder="Child first name" />
          <Field label="Child last name" value={lastName} onChange={setLastName} placeholder="Child last name" />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Child sex (M/F/X)" value={sex} onChange={(v) => setSex((v as any) || "X")} placeholder="M/F/X" />
          <Field label="Child visibility (PUBLIC/PRIVATE)" value={visibility} onChange={(v) => setVisibility((v as any) || "PUBLIC")} placeholder="PUBLIC/PRIVATE" />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Child birth date (YYYY-MM-DD)" value={birthDate} onChange={setBirthDate} placeholder="1999-04-12" />
          <Field label="Union status" value={unionStatus} onChange={setUnionStatus} placeholder="MARRIED" />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn label="Refresh" variant="secondary" onClick={refreshSelected} />
          <Btn label="Add child" variant="primary" onClick={addChild} />
          <Btn label="Delete union" variant="danger" onClick={deleteUnion} />
        </div>

        {msg ? (
          <div style={{ fontSize: 13, color: msg.toLowerCase().includes("error") ? "#ff6b6b" : "#2ea043" }}>{msg}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>
        Member · {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : props.selected.id}
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="First name" value={firstName} onChange={setFirstName} placeholder="First name" />
        <Field label="Last name" value={lastName} onChange={setLastName} placeholder="Last name" />
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Sex (M/F/X)" value={sex} onChange={(v) => setSex((v as any) || "X")} placeholder="M/F/X" />
        <Field label="Visibility (PUBLIC/PRIVATE)" value={visibility} onChange={(v) => setVisibility((v as any) || "PUBLIC")} placeholder="PUBLIC/PRIVATE" />
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Birth date (YYYY-MM-DD)" value={birthDate} onChange={setBirthDate} placeholder="1999-04-12" />
        <Field label="Death date (YYYY-MM-DD)" value={deathDate} onChange={setDeathDate} placeholder="2020-01-01" />
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Partner first name" value={firstName} onChange={setFirstName} placeholder="Partner first name" />
        <Field label="Union status" value={unionStatus} onChange={setUnionStatus} placeholder="MARRIED" />
      </div>

      <div style={{ fontWeight: 700, marginTop: 6 }}>Parents</div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <Field label="Father first name" value={fatherFirst} onChange={setFatherFirst} placeholder="Father first name" />
        <Field label="Father last name" value={fatherLast} onChange={setFatherLast} placeholder="Father last name" />
        <Field label="Mother first name" value={motherFirst} onChange={setMotherFirst} placeholder="Mother first name" />
        <Field label="Mother last name" value={motherLast} onChange={setMotherLast} placeholder="Mother last name" />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Btn label="Refresh" variant="secondary" onClick={refreshSelected} />
        <Btn label="Save member" variant="primary" onClick={saveMember} />
        <Btn label="Add parents" variant="secondary" onClick={addParents} />
        <Btn label="Add partner" variant="secondary" onClick={addPartner} />
        <Btn label="Delete member" variant="danger" onClick={deleteMember} />
      </div>

      {msg ? (
        <div style={{ fontSize: 13, color: msg.toLowerCase().includes("error") ? "#ff6b6b" : "#2ea043" }}>{msg}</div>
      ) : null}
    </div>
  );
}
