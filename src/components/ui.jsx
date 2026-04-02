import { Check } from "lucide-react";
import { C } from "../constants.js";

// ─── Pill Badge ──────────────────────────────────────────────────────────────
export function Pill({ label, done, blue }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99,
      textTransform: "uppercase", letterSpacing: "0.06em",
      background: done ? C.greenLow : blue ? C.blueLow : C.surfaceHigh,
      color: done ? C.green : blue ? C.blue : C.muted,
      border: `1px solid ${done ? C.green + "55" : blue ? C.blue + "55" : C.border}`,
    }}>{label}</span>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, disabled, variant = "primary", full = false, small = false }) {
  const V = {
    primary:   { bg: C.accent,      color: "#fff", border: "none" },
    secondary: { bg: C.surfaceHigh, color: C.text, border: `1px solid ${C.border}` },
    danger:    { bg: "transparent", color: C.red,  border: `1px solid ${C.red}55` },
    green:     { bg: C.green,       color: "#000", border: "none" },
    blue:      { bg: C.blue,        color: "#fff", border: "none" },
  }[variant] || {};
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: V.bg, color: V.color, border: V.border,
      padding: small ? "6px 12px" : "9px 14px", borderRadius: 10,
      fontWeight: 700, fontSize: small ? 11 : 12, cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center",
      gap: 6, width: full ? "100%" : "auto", transition: "opacity .15s", flexShrink: 0,
    }}>{children}</button>
  );
}

// ─── Checkbox ────────────────────────────────────────────────────────────────
export function Checkbox({ done }) {
  return (
    <div style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${done ? C.green : C.muted}`, background: done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {done && <Check size={9} color="#000" strokeWidth={3} />}
    </div>
  );
}

// ─── Section Header ──────────────────────────────────────────────────────────
export function Section({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Two-Column Grid ─────────────────────────────────────────────────────────
export function Grid2({ children }) { 
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>; 
}
