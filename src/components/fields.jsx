import { useState, useEffect, useRef } from "react";
import { C } from "../constants.js";
import { parseCoords, fmt, resolveShortLink } from "../utils.js";

// ─── Basic Input Field ───────────────────────────────────────────────────────
export function InputField({ label, value, onChange, placeholder = "" }) {
  const [focus, setFocus] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>}
      <input value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          background: C.surfaceHigh, border: `1px solid ${focus ? C.accent : C.border}`, borderRadius: 8,
          padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box",
          transition: "border-color .15s",
        }} />
    </div>
  );
}

// ─── Coordinate Input Field ──────────────────────────────────────────────────
export function CoordField({ coords, onChange }) {
  const [raw,    setRaw]    = useState("");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (coords?.lat && coords?.lng && !raw) {
      setRaw(`${coords.lat}, ${coords.lng}`);
      setStatus("ok");
    }
  }, []);

  const handle = async val => {
    setRaw(val);
    if (!val.trim()) { setStatus(null); onChange({ lat: "", lng: "" }); return; }
    const parsed = parseCoords(val);
    if (parsed === "shortlink") {
      setStatus("resolving");
      onChange({ lat: "", lng: "" });
      const resolved = await resolveShortLink(val.trim());
      if (resolved) { setStatus("ok"); onChange(resolved); }
      else          { setStatus("shortlink_fail"); }
    } else if (parsed) {
      setStatus("ok"); onChange(parsed);
    } else {
      setStatus("err"); onChange({ lat: "", lng: "" });
    }
  };

  const isErr = status === "err" || status === "shortlink_fail";
  const borderCol = status === "ok" ? C.green : isErr ? C.red : C.border;
  const focusCol  = status === "ok" ? C.green : isErr ? C.red : C.accent;
  const [focus, setFocus] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Coordinates</label>
      <input
        value={raw}
        placeholder="Paste decimal, DMS or Google Maps link…"
        onChange={e => handle(e.target.value)}
        onFocus={async () => {
          setFocus(true);
          if (raw) return;
          try {
            const text = await navigator.clipboard.readText();
            if (text?.trim()) handle(text.trim());
          } catch { }
        }}
        onBlur={() => setFocus(false)}
        style={{
          background: C.surfaceHigh,
          border: `1px solid ${focus ? focusCol : borderCol}`,
          borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 13,
          outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .15s",
        }}
      />
      {status === "ok"           && <div style={{ fontSize: 11, color: C.green, fontFamily: "monospace" }}>✓ {coords?.lat}, {coords?.lng}</div>}
      {status === "resolving"    && <div style={{ fontSize: 11, color: C.muted }}>⏳ Resolving short link…</div>}
      {status === "err"          && <div style={{ fontSize: 11, color: C.red }}>⚠ Format not recognised — try: 51.5074, -0.1278</div>}
      {status === "shortlink_fail" && <div style={{ fontSize: 11, color: C.red }}>⚠ Couldn't extract coordinates from this link. Open it in your browser and copy the URL from the address bar instead.</div>}
      {status === null           && <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.5 }}>Accepts: <span style={{ fontFamily: "monospace" }}>51.5074, -0.1278</span> · DMS · Google Maps link</div>}
    </div>
  );
}

// ─── Autocomplete Field ──────────────────────────────────────────────────────
export function AutoField({ label, value, onChange, placeholder = "", suggestions = [] }) {
  const [focus, setFocus] = useState(false);
  const [open,  setOpen]  = useState(false);
  const [hi,    setHi]    = useState(-1);
  const wrapRef = useRef(null);

  const filtered = !value
    ? suggestions.slice(0, 8)
    : suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()).slice(0, 8);
  const showDrop = open && filtered.length > 0;

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = val => { onChange(val); setOpen(false); setHi(-1); };
  const onKey = e => {
    if (!showDrop) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, -1)); }
    if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(filtered[hi]); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
      {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>}
      <input value={value ?? ""} placeholder={placeholder} autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => { setFocus(true); setOpen(true); }}
        onBlur={() => setFocus(false)}
        onKeyDown={onKey}
        style={{
          background: C.surfaceHigh, border: `1px solid ${focus ? C.accent : C.border}`, borderRadius: 8,
          padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .15s",
        }} />
      {showDrop && (
        <div style={{ position: "absolute", top: label ? 58 : 38, left: 0, right: 0, zIndex: 100, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {filtered.map((s, i) => (
            <div key={s} onMouseDown={e => { e.preventDefault(); pick(s); }} onMouseEnter={() => setHi(i)}
              style={{ padding: "9px 12px", fontSize: 13, cursor: "pointer", background: i === hi ? C.accentLow : "transparent", color: i === hi ? C.accent : C.text, borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background .1s" }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Address Autocomplete Field ──────────────────────────────────────────────
export function AddressField({ label, value, onChange, onPick, addrBook }) {
  const [focus, setFocus] = useState(false);
  const [open,  setOpen]  = useState(false);
  const [hi,    setHi]    = useState(-1);
  const wrapRef = useRef(null);

  const entries   = Object.values(addrBook);
  const filtered  = !value
    ? entries.slice(0, 8)
    : entries.filter(e => e.name.toLowerCase().includes(value.toLowerCase()) && e.name.toLowerCase() !== value.toLowerCase()).slice(0, 8);
  const showDrop  = open && filtered.length > 0;

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = entry => { onPick(entry); setOpen(false); setHi(-1); };
  const onKey = e => {
    if (!showDrop) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setHi(h => Math.max(h - 1, -1)); }
    if (e.key === "Enter" && hi >= 0) { e.preventDefault(); pick(filtered[hi]); }
    if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative" }}>
      {label && <label style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</label>}
      <input value={value ?? ""} placeholder="12 High Street" autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => { setFocus(true); setOpen(true); }}
        onBlur={() => setFocus(false)}
        onKeyDown={onKey}
        style={{
          background: C.surfaceHigh, border: `1px solid ${focus ? C.accent : C.border}`, borderRadius: 8,
          padding: "8px 10px", color: C.text, fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", transition: "border-color .15s",
        }} />
      {showDrop && (
        <div style={{ position: "absolute", top: label ? 58 : 38, left: 0, right: 0, zIndex: 100, background: C.surface, border: `1px solid ${C.accent}`, borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {filtered.map((entry, i) => (
            <div key={entry.name} onMouseDown={e => { e.preventDefault(); pick(entry); }} onMouseEnter={() => setHi(i)}
              style={{ padding: "9px 12px", cursor: "pointer", background: i === hi ? C.accentLow : "transparent", borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : "none", transition: "background .1s" }}>
              <div style={{ color: i === hi ? C.accent : C.text, fontSize: 13 }}>{entry.name}</div>
              <div style={{ color: C.muted, fontSize: 11, marginTop: 2, fontFamily: "monospace" }}>📍 {entry.coords.lat}, {entry.coords.lng}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
