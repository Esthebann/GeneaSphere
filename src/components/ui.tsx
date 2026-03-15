"use client";

import React from "react";

export function Btn(props: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const v = props.variant ?? "secondary";
  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid",
    cursor: props.disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 13,
    opacity: props.disabled ? 0.6 : 1,
    userSelect: "none",
  };

  const style =
    v === "primary"
      ? { ...base, background: "#1f6feb", borderColor: "#1f6feb", color: "#fff" }
      : v === "danger"
      ? { ...base, background: "#d73a49", borderColor: "#d73a49", color: "#fff" }
      : { ...base, background: "#111", borderColor: "#333", color: "#fff" };

  return (
    <button type={props.type ?? "button"} onClick={props.disabled ? undefined : props.onClick} style={style}>
      {props.label}
    </button>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#bbb" }}>{props.label}</div>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        type={props.type ?? "text"}
        placeholder={props.placeholder ?? ""}
        style={{
          padding: "10px 12px",
          border: "1px solid #333",
          borderRadius: 10,
          background: "#0b0b0b",
          color: "#fff",
          outline: "none",
        }}
      />
    </label>
  );
}

export function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, color: "#bbb" }}>{props.label}</div>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          border: "1px solid #333",
          borderRadius: 10,
          background: "#0b0b0b",
          color: "#fff",
          outline: "none",
        }}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
