import React, { useState, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom/client";
import { MapPin, Plus, Trash2, Navigation, Check, ChevronRight, ChevronLeft, RotateCw, X, Edit2, ChevronDown, ChevronUp, Building2 } from "lucide-react";

const SUPABASE_URL = "https://kmfprxbfafbquilgchtv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttZnByeGJmYWZicXVpbGdjaHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODUxODYsImV4cCI6MjA4ODM2MTE4Nn0.09WBWLQMfo_rYhN9MO2fukbd-YLNZMghFf0dCdjs5Jc";

async function storeLoad(key) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${key}&select=value`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return data?.[0]?.value ? JSON.parse(data[0].value) : null;
  } catch { return null; }
}

async function storeSave(key, val) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
      },
      body: JSON.stringify({ key, value: JSON.stringify(val) })
    });
  } catch { }
}

const COMPLETION_FIELDS = [
  { key: "added",      label: "Added" },
  { key: "fieldWork",  label: "Field work" },
  { key: "officeWork", label: "Office work" },
  { key: "sent",       label: "Sent" },
  { key: "invoice",    label: "Invoice" },
  { key: "payment",    label: "Payment" },
];

const VOCAB_FIELDS = ["surveyType", "company", "city", "diameter", "branchDiameter", "volume"];

// ─── Coordinate parser ────────────────────────────────────────────────────────
// Returns {lat, lng} as strings, or null if unrecognised
function parseCoords(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // ── Short links — resolved by caller asynchronously ─────────────────────
  if (/goo\.gl\/maps|maps\.app\.goo\.gl/i.test(s)) return "shortlink";

  // ── Google Maps URLs ──────────────────────────────────────────────────────
  // https://maps.google.com/?q=51.5074,-0.1278
  // https://www.google.com/maps?q=51.5074,-0.1278
  // https://www.google.com/maps/@51.5074,-0.1278,15z
  // https://maps.google.com/maps?ll=51.5074,-0.1278
  let m;
  m = s.match(/[?&@](?:q|ll)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (m) return fmt(m[1], m[2]);
  m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return fmt(m[1], m[2]);

  // ── Decimal degrees — "51.5074, -0.1278" or "51.5074 -0.1278" ────────────
  m = s.match(/^(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (m) return fmt(m[1], m[2]);

  // ── DMS — 51°30'26.4"N 0°7'39.6"W  (various separators) ─────────────────
  const dms = /(\d{1,3})[°d]\s*(\d{1,2})['′m]\s*([\d.]+)["″s]?\s*([NS])[,\s]+(\d{1,3})[°d]\s*(\d{1,2})['′m]\s*([\d.]+)["″s]?\s*([EW])/i;
  m = s.match(dms);
  if (m) {
    const lat = dmsToDecimal(+m[1], +m[2], +m[3], m[4]);
    const lng = dmsToDecimal(+m[5], +m[6], +m[7], m[8]);
    return fmt(lat, lng);
  }

  // ── DMS compact — 51 30 26.4 N, 0 7 39.6 W ───────────────────────────────
  const dms2 = /(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([NS])[,\s]+(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([EW])/i;
  m = s.match(dms2);
  if (m) {
    const lat = dmsToDecimal(+m[1], +m[2], +m[3], m[4]);
    const lng = dmsToDecimal(+m[5], +m[6], +m[7], m[8]);
    return fmt(lat, lng);
  }

  return null;
}

function dmsToDecimal(deg, min, sec, dir) {
  const d = deg + min / 60 + sec / 3600;
  return (dir === "S" || dir === "W") ? -d : d;
}

function fmt(lat, lng) {
  const la = parseFloat(lat), lo = parseFloat(lng);
  if (isNaN(la) || isNaN(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la.toFixed(6), lng: lo.toFixed(6) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function haversine(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function tsp(items, pinStartId, pinFirstId, pinLastId, pinEndId) {
  if (items.length <= 1) return [...items];
  const pinStart = items.find(i => i.id === pinStartId);
  const pinFirst = items.find(i => i.id === pinFirstId);
  const pinLast  = items.find(i => i.id === pinLastId);
  const pinEnd   = items.find(i => i.id === pinEndId);
  let pool = items.filter(i => i.id !== pinStartId && i.id !== pinFirstId && i.id !== pinLastId && i.id !== pinEndId);

  let result = [];
  if (pinStart) result.push(pinStart);
  if (pinFirst) result.push(pinFirst);

  let current = result.length > 0 ? result[result.length - 1] : pool.shift();
  if (result.length === 0 && current) result.push(current);

  while (pool.length > 0) {
    if (!current?.coords?.lat) { result.push(...pool); break; }
    let best = null, bestD = Infinity;
    for (const j of pool) {
      if (!j.coords?.lat) continue;
      const d = haversine(current.coords, j.coords);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (!best) { result.push(...pool); break; }
    pool = pool.filter(j => j.id !== best.id);
    result.push(best); current = best;
  }

  if (pinLast)  result.push(pinLast);
  if (pinEnd)   result.push(pinEnd);
  return result;
}


function mergeVocab(vocab, job) {
  const next = { ...vocab };
  for (const field of VOCAB_FIELDS) {
    const val = (job[field] ?? "").toString().trim();
    if (!val) continue;
    const existing = next[field] ?? [];
    if (!existing.includes(val)) next[field] = [val, ...existing].slice(0, 200);
  }
  return next;
}

function mergeAddress(addrBook, job) {
  const name = (job.name ?? "").trim();
  const lat  = (job.coords?.lat ?? "").toString().trim();
  const lng  = (job.coords?.lng ?? "").toString().trim();
  if (!name || !lat || !lng) return addrBook;
  return { ...addrBook, [name.toLowerCase()]: { name, coords: { lat, lng } } };
}

// ─── Primitive UI ─────────────────────────────────────────────────────────────
function Pill({ label, done, blue }) {
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

function InputField({ label, value, onChange, placeholder = "" }) {
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

// Resolve a Google Maps short link via CORS proxy → extract coords from final URL
async function resolveShortLink(url) {
  try {
    const proxy = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const res   = await fetch(proxy, { method: "GET", redirect: "follow" });
    const html  = await res.text();
    // The redirected page HTML contains the canonical URL in several places
    // Try to find coords in the response URL or embedded JSON
    const finalUrl = res.url ?? "";
    let coords = parseCoords(finalUrl);
    if (coords && coords !== "shortlink") return coords;
    // Fallback: scan the HTML for coordinate patterns
    const m = html.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
    if (m) return fmt(m[1], m[2]);
    const m2 = html.match(/"(-?\d{1,3}\.\d{5,})",\s*"(-?\d{1,3}\.\d{5,})"/);
    if (m2) return fmt(m2[1], m2[2]);
    return null;
  } catch {
    return null;
  }
}

// Single smart coordinate paste field
function CoordField({ coords, onChange }) {
  const [raw,    setRaw]    = useState("");
  const [status, setStatus] = useState(null); // null | "ok" | "err" | "shortlink" | "resolving"

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
          if (raw) return; // already has content
          try {
            const text = await navigator.clipboard.readText();
            if (text?.trim()) handle(text.trim());
          } catch { /* permission denied or unavailable — silent */ }
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

function AutoField({ label, value, onChange, placeholder = "", suggestions = [] }) {
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

function AddressField({ label, value, onChange, onPick, addrBook }) {
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

function Btn({ children, onClick, disabled, variant = "primary", full = false, small = false }) {
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

function Checkbox({ done }) {
  return (
    <div style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${done ? C.green : C.muted}`, background: done ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {done && <Check size={9} color="#000" strokeWidth={3} />}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      {children}
    </div>
  );
}
function Grid2({ children }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>; }

// ─── Nav Modal ────────────────────────────────────────────────────────────────
// ─── Route Map (Leaflet) ──────────────────────────────────────────────────────
function RouteMap({ stops }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; }

    const validStops = stops.filter(s => s.coords?.lat && s.coords?.lng);
    if (validStops.length === 0) return;

    const map = window.L.map(mapRef.current, { zoomControl: true });
    instanceRef.current = map;

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const latlngs = [];
    validStops.forEach((stop, i) => {
      const lat = parseFloat(stop.coords.lat), lng = parseFloat(stop.coords.lng);
      latlngs.push([lat, lng]);
      const color = stop._type === "place" ? "#3b82f6" : "#f97316";
      const marker = window.L.circleMarker([lat, lng], {
        radius: 10, fillColor: color, color: "#fff",
        weight: 2, fillOpacity: 1
      }).addTo(map);
      marker.bindPopup(`<b>${i + 1}. ${stop.name || stop.address || "Stop"}</b>`);
    });

    if (latlngs.length > 1) {
      window.L.polyline(latlngs, { color: "#f97316", weight: 3, opacity: 0.7, dashArray: "6,6" }).addTo(map);
    }

    const bounds = window.L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [24, 24] });

    return () => { if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; } };
  }, [stops]);

  return (
    <div ref={mapRef} style={{ width: "100%", height: 280, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }} />
  );
}

// ─── Build Google Maps share URL ──────────────────────────────────────────────
function buildGoogleMapsUrl(stops) {
  const waypoints = stops.map(s => {
    if (s.coords?.lat && s.coords?.lng) return `${s.coords.lat},${s.coords.lng}`;
    return encodeURIComponent([s.address, s.city].filter(Boolean).join(", "));
  });
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) return `https://www.google.com/maps/search/?api=1&query=${waypoints[0]}`;
  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(1, -1).slice(0, 8); // max 8 waypoints in URL
  const waypointParam = middle.length > 0 ? `&waypoints=${middle.join("|")}` : "";
  return `https://www.google.com/maps/dir/${origin}/${destination}${waypointParam.replace("&waypoints=", "/")}`;
}

function NavModal({ item, onClose }) {
  const hasCoords = item.coords?.lat && item.coords?.lng;
  const label = item.name ?? "";
  const city  = item.city ?? "";
  const gq = hasCoords ? `${item.coords.lat},${item.coords.lng}` : encodeURIComponent(`${label} ${city}`);
  const wq = hasCoords ? `${item.coords.lat},${item.coords.lng}` : encodeURIComponent(`${label} ${city}`);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 380, padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ color: C.text, fontWeight: 700, textAlign: "center", margin: 0, fontSize: 14 }}>Navigate to</p>
        <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: 0 }}>{label}{city ? `, ${city}` : ""}</p>
        <a href={`https://maps.google.com/?q=${gq}`} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1a73e8", color: "#fff", fontWeight: 700, padding: "13px 16px", borderRadius: 12, textDecoration: "none", fontSize: 14 }}>
          <Map size={15} /> Google Maps
        </a>
        <a href={`https://waze.com/ul?${hasCoords ? `ll=${wq}` : `q=${wq}`}&navigate=yes`} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#05c8f7", color: "#000", fontWeight: 700, padding: "13px 16px", borderRadius: 12, textDecoration: "none", fontSize: 14 }}>
          <Navigation size={15} /> Waze
        </a>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: "6px 0" }}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLACES TAB
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_PLACE = { name: "", address: "", city: "", coords: { lat: "", lng: "" } };

function PlaceModal({ place, onSave, onClose }) {
  const [f, setF] = useState(place ? { ...EMPTY_PLACE, ...place, coords: { lat: "", lng: "", ...place.coords } } : { ...EMPTY_PLACE });
  const s = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 480, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{place ? "Edit Place" : "New Place"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <InputField label="Place name *" value={f.name} onChange={v => s("name", v)} placeholder="e.g. Home, Office, Depot" />
        <InputField label="Address"      value={f.address} onChange={v => s("address", v)} placeholder="Street address" />
        <InputField label="City"         value={f.city}    onChange={v => s("city", v)}    placeholder="Town / City" />
        <CoordField coords={f.coords} onChange={v => setF(p => ({ ...p, coords: v }))} />
        <Btn onClick={() => { if (f.name.trim()) { onSave(f); onClose(); } }} disabled={!f.name.trim()} full>
          {place ? "Save Changes" : "Add Place"}
        </Btn>
      </div>
    </div>
  );
}

function PlacesTab({ places, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Places</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Home base, depot, offices — route anchors</div>
        </div>
        <Btn onClick={() => setModal("new")}><Plus size={14} /> Add</Btn>
      </div>

      {places.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", color: C.muted }}>
          <Building2 size={44} color={C.muted} style={{ margin: "0 auto 14px", opacity: 0.25, display: "block" }} />
          <div style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>No places yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Add your home base or common start/end points</div>
        </div>
      )}

      {places.map(pl => {
        const hasCoords = !!(pl.coords?.lat && pl.coords?.lng);
        return (
          <div key={pl.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, background: C.blueLow, border: `1px solid ${C.blue}44`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Building2 size={15} color={C.blue} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{pl.name}</div>
              {pl.address && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{pl.address}{pl.city ? `, ${pl.city}` : ""}</div>}
              <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
                {hasCoords
                  ? <a href={`https://www.google.com/maps/search/?api=1&query=${pl.coords.lat},${pl.coords.lng}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}><Pill label="📍 coords" done /></a>
                  : <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>⚠ No coords</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Btn onClick={() => setModal(pl)} variant="secondary" small><Edit2 size={11} /></Btn>
              <Btn onClick={() => onDelete(pl.id)} variant="danger" small><Trash2 size={11} /></Btn>
            </div>
          </div>
        );
      })}

      {modal && (
        <PlaceModal
          place={modal === "new" ? null : modal}
          onSave={f => modal === "new" ? onAdd({ ...f, id: genId() }) : onUpdate(modal.id, f)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const EMPTY_JOB = {
  name: "", city: "", company: "", surveyType: "",
  diameter: "", approxLength: "", branchDiameter: "", volume: "",
  coords: { lat: "", lng: "" }, completion: {},
};

function JobModal({ job, vocab, addrBook, onSave, onClose }) {
  const [f, setF] = useState(() =>
    job
      ? { ...EMPTY_JOB, ...job, coords: { lat: "", lng: "", ...job.coords }, completion: { ...job.completion } }
      : { ...EMPTY_JOB }
  );
  const s  = (k, v) => setF(p => ({ ...p, [k]: v }));
  const sk = (k, v) => setF(p => ({ ...p, completion: { ...p.completion, [k]: v } }));
  const V  = field => vocab[field] ?? [];

  const handleAddressPick = entry => {
    setF(p => ({ ...p, name: entry.name, coords: { lat: entry.coords.lat, lng: entry.coords.lng } }));
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{job ? "Edit Job" : "New Job"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <Section label="Location">
          <InputField
            label="Address / Site name *"
            value={f.name}
            onChange={v => s("name", v)}
            placeholder="12 High Street"
          />
          <Grid2>
            <AutoField label="City"    value={f.city}    onChange={v => s("city", v)}    placeholder="Town / City" suggestions={V("city")} />
            <AutoField label="Company" value={f.company} onChange={v => s("company", v)} placeholder="Client name" suggestions={V("company")} />
          </Grid2>
          <CoordField
            coords={f.coords}
            onChange={v => setF(p => ({ ...p, coords: v }))}
          />
        </Section>

        <Section label="Survey Details">
          <AutoField label="Survey type"         value={f.surveyType}     onChange={v => s("surveyType", v)}     placeholder="e.g. CCTV drain survey"  suggestions={V("surveyType")} />
          <Grid2>
            <AutoField label="Diameter (mm)"      value={f.diameter}      onChange={v => s("diameter", v)}      placeholder="150" suggestions={V("diameter")} />
            <AutoField label="Approx. length (m)" value={f.approxLength}  onChange={v => s("approxLength", v)}  placeholder="80"  suggestions={V("approxLength")} />
          </Grid2>
          <Grid2>
            <AutoField label="Branch diam. (mm)"  value={f.branchDiameter} onChange={v => s("branchDiameter", v)} placeholder="100" suggestions={V("branchDiameter")} />
            <AutoField label="Volume (m³)"         value={f.volume}         onChange={v => s("volume", v)}         placeholder="1.5" suggestions={V("volume")} />
          </Grid2>
        </Section>

        {job && (
          <Section label="Completion">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {COMPLETION_FIELDS.map(({ key, label }) => {
                const done = !!f.completion[key];
                return (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 9, cursor: "pointer", background: done ? C.greenLow : C.surfaceHigh, border: `1px solid ${done ? C.green + "55" : C.border}` }}>
                    <input type="checkbox" checked={done} style={{ display: "none" }} onChange={e => sk(key, e.target.checked)} />
                    <Checkbox done={done} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: done ? C.green : C.muted }}>{label}</span>
                  </label>
                );
              })}
            </div>
          </Section>
        )}

        <Btn onClick={() => { if (f.name.trim()) { onSave(f); onClose(); } }} disabled={!f.name.trim()} full>
          {job ? "Save Changes" : "Add Job"}
        </Btn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOBS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function JobCard({ job, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const doneCount = COMPLETION_FIELDS.filter(f => job.completion?.[f.key]).length;
  const allDone   = doneCount === COMPLETION_FIELDS.length;
  const hasCoords = !!(job.coords?.lat && job.coords?.lng);
  const specs = [
    { label: "Diameter",       value: job.diameter,       unit: "mm" },
    { label: "Approx. length", value: job.approxLength,   unit: "m"  },
    { label: "Branch diam.",   value: job.branchDiameter, unit: "mm" },
    { label: "Volume",         value: job.volume,          unit: "m³" },
  ].filter(d => d.value);

  return (
    <div style={{ background: C.surface, border: `1px solid ${allDone ? C.green + "44" : C.border}`, borderRadius: 14, overflow: "hidden" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
        <MapPin size={14} color={C.accent} style={{ marginTop: 3, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{job.name}</div>
          {(job.city || job.company) && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{[job.company, job.city].filter(Boolean).join(" · ")}</div>}
          <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
            {job.surveyType && <Pill label={job.surveyType} />}
            <Pill label={`${doneCount}/${COMPLETION_FIELDS.length}`} done={allDone} />
            {hasCoords && <Pill label="📍" done />}
          </div>
        </div>
        {open ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {specs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
              {specs.map(({ label, value, unit }) => (
                <div key={label} style={{ background: C.surfaceHigh, borderRadius: 8, padding: "7px 10px" }}>
                  <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginTop: 2 }}>{value} <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>{unit}</span></div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {COMPLETION_FIELDS.map(({ key, label }) => {
              const done = !!job.completion?.[key];
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderRadius: 8, background: done ? C.greenLow : C.surfaceHigh, border: `1px solid ${done ? C.green + "44" : C.border}` }}>
                  <Checkbox done={done} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: done ? C.green : C.muted }}>{label}</span>
                </div>
              );
            })}
          </div>
          {hasCoords && <a href={`https://www.google.com/maps/search/?api=1&query=${job.coords.lat},${job.coords.lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", textDecoration: "none" }}>📍 {job.coords.lat}, {job.coords.lng}</a>}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => onEdit(job)} variant="secondary" small><Edit2 size={12} /> Edit</Btn>
            <Btn onClick={() => onDelete(job.id)} variant="danger" small><Trash2 size={12} /> Delete</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function JobsTab({ jobs, vocab, addrBook, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Jobs</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{jobs.length} total · {jobs.filter(j => j.completion?.payment).length} invoiced</div>
        </div>
        <Btn onClick={() => setModal("new")}><Plus size={14} /> New Job</Btn>
      </div>

      {jobs.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", color: C.muted }}>
          <MapPin size={44} color={C.muted} style={{ margin: "0 auto 14px", opacity: 0.25, display: "block" }} />
          <div style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>No jobs yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Tap New Job to create your first survey</div>
        </div>
      )}

      {jobs.map(job => <JobCard key={job.id} job={job} onEdit={j => setModal(j)} onDelete={onDelete} />)}

      {modal && (
        <JobModal
          job={modal === "new" ? null : modal}
          vocab={vocab} addrBook={addrBook}
          onSave={f => modal === "new" ? onAdd({ ...f, id: genId(), completion: {} }) : onUpdate(modal.id, f)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function RoutingTab({ jobs, places, vocab, addrBook, onUpdateJob, initRoute, initStop }) {
  const [selJobs,    setSelJobs]    = useState(new Set());
  const [selPlaces,  setSelPlaces]  = useState([]); // array of {id, uid} — allows duplicates
  const [pinStartId, setPinStartId] = useState(null);
  const [pinFirstId, setPinFirstId] = useState(null);
  const [pinLastId,  setPinLastId]  = useState(null);
  const [pinEndId,   setPinEndId]   = useState(null);
  const [route,      setRoute]      = useState(() => initRoute ?? []);
  const [stop,       setStop]       = useState(() => initStop  ?? 0);
  const [phase,      setPhase]      = useState(() => (initRoute?.length > 0) ? "run" : "select");
  const [navModal,   setNavModal]   = useState(null);
  const [editModal,  setEditModal]  = useState(null);

  // Persist route and stop position
  useEffect(() => { storeSave("srp6-route", route); }, [route]);
  useEffect(() => { storeSave("srp6-stop",  stop);  }, [stop]);

  useEffect(() => {
    if (route.length > 0)
      setRoute(r => r.map(ri => ri._type === "job" ? { ...ri, ...(jobs.find(j => j.id === ri.id) ?? ri) } : ri));
  }, [jobs]);

  const toggleJob     = id  => setSelJobs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const addPlace      = id  => setSelPlaces(p => [...p, { id, uid: genId() }]);
  const removePlace   = uid => setSelPlaces(p => p.filter(e => e.uid !== uid));

  const PINS = ["start", "first", "last", "end"];
  const pinState = { start: pinStartId, first: pinFirstId, last: pinLastId, end: pinEndId };
  const pinSetters = { start: setPinStartId, first: setPinFirstId, last: setPinLastId, end: setPinEndId };

  const togglePin = (pinName, uid) => {
    const setter = pinSetters[pinName];
    const current = pinState[pinName];
    PINS.forEach(p => { if (p !== pinName && pinState[p] === uid) pinSetters[p](null); });
    const newVal = current === uid ? null : uid;
    setter(newVal);
    if (pinName === "start" && newVal && !pinEndId) setPinEndId(newVal);
    if (pinName === "start" && !newVal && pinEndId === uid) setPinEndId(null);
  };

  const allItems = [
    ...selPlaces.map(({ id, uid }) => {
      const pl = places.find(p => p.id === id);
      return pl ? { ...pl, id: uid, _origId: id, _type: "place" } : null;
    }).filter(Boolean),
    ...jobs.filter(j => selJobs.has(j.id)).map(j => ({ ...j, _type: "job" })),
  ];

  const optimise = () => { setRoute(tsp(allItems, pinStartId, pinFirstId, pinLastId, pinEndId)); setStop(0); setPhase("run"); };
  const clearRoute = () => { setRoute([]); setStop(0); setPhase("select"); storeSave("srp6-route", []); storeSave("srp6-stop", 0); window.__savedRoute = null; };
  const itemLabel = item => item.name ?? "—";
  const itemSub   = item => [item.company, item.city].filter(Boolean).join(" · ");

  if (phase === "run" && route.length > 0) {
    const item  = route[stop];
    const isJob = item._type === "job";
    const pct   = (stop / route.length) * 100;
    const fDone = route.filter(i => i._type === "job" && i.completion?.fieldWork).length;
    const nJobs = route.filter(i => i._type === "job").length;
    const mapsUrl = buildGoogleMapsUrl(route);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => { if (window.confirm("Clear the current route and start a new one?")) clearRoute(); }} style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: "pointer", padding: "5px 11px", fontSize: 12, fontWeight: 600 }}>✕ New Route</button>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 18 }}>Today's Run</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {mapsUrl && (
              <button onClick={() => navigator.clipboard?.writeText(mapsUrl).then(() => alert("Link copied!")).catch(() => window.open(mapsUrl, "_blank"))}
                style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer", padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
                🔗 Share
              </button>
            )}
            {mapsUrl && (
              <button onClick={() => window.open(mapsUrl, "_blank")}
                style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer", padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
                🗺 Maps
              </button>
            )}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 5 }}>
            <span>Stop {stop + 1} of {route.length}</span><span>{fDone}/{nJobs} field done</span>
          </div>
          <div style={{ height: 4, background: C.surfaceHigh, borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: C.accent, borderRadius: 99, transition: "width .3s" }} />
          </div>
        </div>
        <RouteMap stops={route} />
        <div style={{ background: C.surface, border: `2px solid ${isJob ? C.accent : C.blue}`, borderRadius: 18, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: isJob ? C.accent : C.blue, color: "#fff", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{stop + 1}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>{itemLabel(item)}</span>
                <Pill label={isJob ? "job" : "place"} blue={!isJob} />
              </div>
              {itemSub(item) && <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{itemSub(item)}</div>}
              {isJob && item.surveyType && <div style={{ color: C.accent, fontSize: 12, marginTop: 3 }}>{item.surveyType}</div>}
              {isJob && (item.diameter || item.approxLength || item.volume) && (
                <div style={{ color: C.muted, fontSize: 12, marginTop: 3 }}>
                  {[item.diameter && `⌀${item.diameter}mm`, item.approxLength && `~${item.approxLength}m`, item.volume && `${item.volume}m³`].filter(Boolean).join("  ·  ")}
                </div>
              )}
              {item.id === pinStartId && <div style={{ color: C.green, fontSize: 11, marginTop: 3, fontWeight: 700 }}>🟢 Start</div>}
              {item.id === pinFirstId && <div style={{ color: C.green, fontSize: 11, marginTop: 3, fontWeight: 700 }}>1️⃣ First</div>}
              {item.id === pinLastId  && <div style={{ color: C.green, fontSize: 11, marginTop: 3, fontWeight: 700 }}>🔚 Last</div>}
              {item.id === pinEndId   && <div style={{ color: C.green, fontSize: 11, marginTop: 3, fontWeight: 700 }}>🏁 End</div>}
            </div>
          </div>
          <Btn onClick={() => setNavModal(item)} full><Navigation size={15} /> Navigate Here</Btn>
          {isJob && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Btn variant="secondary" onClick={() => setEditModal(item)}><Edit2 size={12} /> Edit Job</Btn>
              <Btn variant="green" onClick={() => {
                onUpdateJob(item.id, { completion: { ...item.completion, fieldWork: true } });
                if (stop < route.length - 1) setStop(s => s + 1);
              }}><Check size={12} /> Field Done</Btn>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Btn variant="secondary" disabled={stop === 0} onClick={() => setStop(s => s - 1)}><ChevronLeft size={14} /> Prev</Btn>
          <Btn variant="secondary" disabled={stop === route.length - 1} onClick={() => setStop(s => s + 1)}>Next <ChevronRight size={14} /></Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>All Stops</div>
          {route.map((it, i) => {
            const active = i === stop, done = it._type === "job" && !!it.completion?.fieldWork;
            const col = it._type === "job" ? C.accent : C.blue;
            return (
              <button key={it.id + i} onClick={() => setStop(i)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, textAlign: "left", width: "100%", cursor: "pointer", transition: "all .15s", background: active ? (it._type === "job" ? C.accentLow : C.blueLow) : C.surface, border: `1px solid ${active ? col : C.border}` }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? C.green : active ? col : C.surfaceHigh, fontSize: 10, fontWeight: 800, color: (done || active) ? (done ? "#000" : "#fff") : C.muted }}>
                  {done ? <Check size={11} strokeWidth={3} /> : i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: done ? C.muted : C.text, fontSize: 13, fontWeight: 600, textDecoration: done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemLabel(it)}</div>
                  {it.city && <div style={{ color: C.muted, fontSize: 11 }}>{it.city}</div>}
                </div>
                {[pinStartId, pinFirstId, pinLastId, pinEndId].includes(it.id) && (
                  <span style={{ fontSize: 11 }}>
                    {it.id === pinStartId ? "🟢" : it.id === pinFirstId ? "1️⃣" : it.id === pinLastId ? "🔚" : "🏁"}
                  </span>
                )}
                <Pill label={it._type} blue={it._type === "place"} />
              </button>
            );
          })}
        </div>
        {navModal  && <NavModal item={navModal} onClose={() => setNavModal(null)} />}
        {editModal && <JobModal job={editModal} vocab={vocab} addrBook={addrBook} onSave={f => { onUpdateJob(editModal.id, f); setEditModal(null); }} onClose={() => setEditModal(null)} />}
      </div>
    );
  }

  const noCoords = allItems.filter(i => !i.coords?.lat || !i.coords?.lng);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Route Planner</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Pick places &amp; jobs · pin start/end · optimise</div>
      </div>

      {places.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={13} color={C.blue} />
            <span style={{ fontSize: 12, color: C.blue, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Places</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{selPlaces.length} selected</span>
          </div>
          {places.map(pl => {
            const instances = selPlaces.filter(e => e.id === pl.id);
            const count = instances.length;
            return (
              <div key={pl.id} style={{ background: C.surface, border: `1px solid ${count > 0 ? C.blue : C.border}`, borderRadius: 12, transition: "border-color .15s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{pl.name}</div>
                    {(pl.address || pl.city) && <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{[pl.address, pl.city].filter(Boolean).join(", ")}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {count > 0 && (
                      <button onClick={() => removePlace(instances[instances.length - 1].uid)}
                        style={{ width: 28, height: 28, borderRadius: 8, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    )}
                    {count > 0 && (
                      <span style={{ color: C.blue, fontWeight: 800, fontSize: 14, minWidth: 16, textAlign: "center" }}>{count}</span>
                    )}
                    <button onClick={() => addPlace(pl.id)}
                      style={{ width: 28, height: 28, borderRadius: 8, background: count > 0 ? C.blueLow : C.surfaceHigh, border: `1px solid ${count > 0 ? C.blue : C.border}`, color: count > 0 ? C.blue : C.muted, cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
                {/* Pin buttons per instance */}
                {instances.length > 0 && (
                  <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 13px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {instances.map(({ uid }, i) => {
                      return (
                        <div key={uid} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>#{i + 1}</span>
                          {[
                            { name: "start", label: "🟢", title: "Start" },
                            { name: "first", label: "1️⃣", title: "First" },
                            { name: "last",  label: "🔚", title: "Last"  },
                            { name: "end",   label: "🏁", title: "End"   },
                          ].map(({ name, label, title }) => {
                            const active = pinState[name] === uid;
                            return (
                              <button key={name} onClick={() => togglePin(name, uid)}
                                title={title}
                                style={{ background: active ? C.green : C.surfaceHigh, border: `1px solid ${active ? C.green : C.border}`, borderRadius: 7, padding: "3px 7px", cursor: "pointer", fontSize: 12, color: active ? "#000" : C.muted, fontWeight: 700 }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 12, color: C.muted }}>
          No places saved — add home base or depot in the <strong style={{ color: C.text }}>Places</strong> tab.
        </div>
      )}

      {jobs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={13} color={C.accent} />
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Jobs</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setSelJobs(new Set(jobs.map(j => j.id)))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>All</button>
              <span style={{ color: C.border }}>·</span>
              <button onClick={() => setSelJobs(new Set())} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>None</button>
              <span style={{ color: C.muted, fontSize: 11 }}>· {selJobs.size} selected</span>
            </div>
          </div>
          {jobs.map(job => {
            const sel = selJobs.has(job.id);
            const hasCoords = !!(job.coords?.lat && job.coords?.lng);
            return (
              <div key={job.id} style={{ background: C.surface, border: `1px solid ${sel ? C.accent : C.border}`, borderRadius: 12, transition: "border-color .15s" }}>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleJob(job.id)} style={{ marginTop: 3, accentColor: C.accent, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>{job.name}{job.city ? `, ${job.city}` : ""}</div>
                    {job.company && <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{job.company}</div>}
                    <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                      {job.surveyType && <Pill label={job.surveyType} />}
                      {hasCoords ? <Pill label="📍" done /> : <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>⚠ no coords</span>}
                      {job.completion?.fieldWork && <Pill label="✓ field" done />}
                    </div>
                  </div>
                  {sel && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 2, flexWrap: "wrap" }}>
                      {[
                        { name: "start", label: "🟢" },
                        { name: "first", label: "1️⃣" },
                        { name: "last",  label: "🔚" },
                        { name: "end",   label: "🏁" },
                      ].map(({ name, label }) => {
                        const active = pinState[name] === job.id;
                        return (
                          <button key={name} onClick={e => { e.preventDefault(); togglePin(name, job.id); }}
                            style={{ background: active ? C.green : C.surfaceHigh, border: `1px solid ${active ? C.green : C.border}`, borderRadius: 7, padding: "3px 7px", cursor: "pointer", fontSize: 12, color: active ? "#000" : C.muted, fontWeight: 700 }}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </label>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 12, color: C.muted }}>
          No jobs yet — add them in the <strong style={{ color: C.text }}>Jobs</strong> tab.
        </div>
      )}

      {allItems.length > 0 && (
        <div style={{ fontSize: 11, color: C.muted, background: C.surfaceHigh, borderRadius: 10, padding: "9px 12px", lineHeight: 1.6 }}>
          🟢 <strong style={{color: C.text}}>Start</strong> &amp; 🏁 <strong style={{color: C.text}}>End</strong> are required · 1️⃣ <strong style={{color: C.text}}>First</strong> &amp; 🔚 <strong style={{color: C.text}}>Last</strong> are optional<br/>
          End auto-fills to match Start — tap 🏁 to change it
        </div>
      )}
      {noCoords.length > 0 && (
        <div style={{ background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.3)", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: C.red }}>
          ⚠ {noCoords.length} stop{noCoords.length > 1 ? "s" : ""} without coordinates — optimisation will be approximate.
        </div>
      )}
      {allItems.length > 0 && (!pinStartId || !pinEndId) && (
        <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: C.accent }}>
          ⚠ Pin a 🟢 Start and 🏁 End stop before optimising.
        </div>
      )}
      <Btn onClick={optimise} disabled={allItems.length < 1 || !pinStartId || !pinEndId} full>
        <RotateCw size={14} /> Optimise & Start Run ({allItems.length} stop{allItems.length !== 1 ? "s" : ""})
      </Btn>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEOJSON VOCAB IMPORTER
// ═══════════════════════════════════════════════════════════════════════════════
const APP_VOCAB_FIELDS = [
  { key: "surveyType",     label: "Survey type" },
  { key: "company",        label: "Company" },
  { key: "city",           label: "City" },
  { key: "diameter",       label: "Diameter" },
  { key: "branchDiameter", label: "Branch diameter" },
  { key: "volume",         label: "Volume" },
];

// Extract lat/lng from a GeoJSON feature geometry
function coordsFromFeature(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  let coords = null;
  if (geom.type === "Point") coords = geom.coordinates;
  else if (geom.type === "MultiPoint") coords = geom.coordinates[0];
  else if (geom.type === "LineString") coords = geom.coordinates[0];
  else if (geom.type === "MultiLineString") coords = geom.coordinates[0][0];
  else if (geom.type === "Polygon") coords = geom.coordinates[0][0];
  else if (geom.type === "MultiPolygon") coords = geom.coordinates[0][0][0];
  if (!coords) return null;
  const [lng, lat] = coords;
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
}

function GeoJSONImporter({ onImportVocab, onImportAddresses, onClose }) {
  const [step,    setStep]    = useState("upload");  // upload | map | preview | done
  const [fields,  setFields]  = useState([]);        // field names found in GeoJSON
  const [mapping, setMapping] = useState({});        // { geoField: appVocabKey | "ignore" }
  const [samples, setSamples] = useState({});        // { geoField: [val, val, ...] }
  const [counts,  setCounts]  = useState({});        // { appVocabKey: n } after import
  const [error,   setError]   = useState(null);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const geo = JSON.parse(ev.target.result);
        if (!geo.features?.length) throw new Error("No features found");
        // Collect all property keys and sample values
        const allKeys = new Set();
        geo.features.forEach(f => Object.keys(f.properties ?? {}).forEach(k => allKeys.add(k)));
        const keyList = [...allKeys];
        const sampleMap = {};
        keyList.forEach(k => {
          const vals = [...new Set(
            geo.features.map(f => (f.properties?.[k] ?? "").toString().trim()).filter(Boolean)
          )].slice(0, 5);
          sampleMap[k] = vals;
        });
        // Auto-suggest mapping by fuzzy matching field names
        const autoMap = {};
        keyList.forEach(gk => {
          const lower = gk.toLowerCase().replace(/[^a-z]/g, "");
          const match = APP_VOCAB_FIELDS.find(af => {
            const al = af.key.toLowerCase();
            const ll = af.label.toLowerCase().replace(/[^a-z]/g, "");
            return lower === al || lower === ll || lower.includes(al) || al.includes(lower);
          });
          autoMap[gk] = match ? match.key : "ignore";
        });
        setFields(keyList);
        setSamples(sampleMap);
        setMapping(autoMap);
        setStep("map");
        setError(null);
      } catch (err) {
        setError("Couldn't read file — make sure it's a valid GeoJSON export from QGIS.");
      }
    };
    reader.readAsText(file);
  };

  const doImport = () => {
    // Build vocab additions: { appKey: Set of unique values }
    const additions = {};
    APP_VOCAB_FIELDS.forEach(af => { additions[af.key] = new Set(); });
    Object.entries(mapping).forEach(([geoKey, appKey]) => {
      if (appKey === "ignore" || !additions[appKey]) return;
      (samples[geoKey] ?? []).forEach(v => additions[appKey].add(v));
    });
    // For full import we need all values, not just samples — re-read is not needed
    // since we stored all unique values in samples already (up to 5 shown, but we need all)
    // We'll pass the full mapping and let parent handle it with the file
    const countMap = {};
    Object.entries(additions).forEach(([k, s]) => { countMap[k] = s.size; });
    onImportVocab(Object.fromEntries(
      Object.entries(additions).map(([k, s]) => [k, [...s]])
    ));
    setCounts(countMap);
    setStep("done");
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "88vh", overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Import from QGIS</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* STEP: upload */}
        {step === "upload" && (
          <>
            <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              Export your QGIS layer as <strong style={{ color: C.text }}>GeoJSON</strong> (Layer → Export → Save Features As → Format: GeoJSON). Then pick the file below.
            </p>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 16px", borderRadius: 14, border: `2px dashed ${C.accent}`, cursor: "pointer", background: C.accentLow }}>
              <MapPin size={28} color={C.accent} />
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>Tap to pick GeoJSON file</span>
              <span style={{ color: C.muted, fontSize: 12 }}>.geojson or .json</span>
              <input type="file" accept=".geojson,.json" onChange={handleFile} style={{ display: "none" }} />
            </label>
            {error && <div style={{ fontSize: 12, color: C.red }}>{error}</div>}
          </>
        )}

        {/* STEP: map fields */}
        {step === "map" && (
          <>
            <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              Map your QGIS fields to app vocabulary fields. Unneeded fields set to <em>Ignore</em>.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {fields.map(geoKey => (
                <div key={geoKey} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{geoKey}</span>
                    <select
                      value={mapping[geoKey] ?? "ignore"}
                      onChange={e => setMapping(m => ({ ...m, [geoKey]: e.target.value }))}
                      style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: "5px 8px", color: C.text, fontSize: 12, cursor: "pointer", flexShrink: 0 }}
                    >
                      <option value="ignore">— Ignore —</option>
                      {APP_VOCAB_FIELDS.map(af => (
                        <option key={af.key} value={af.key}>{af.label}</option>
                      ))}
                    </select>
                  </div>
                  {samples[geoKey]?.length > 0 && (
                    <div style={{ fontSize: 11, color: C.muted }}>
                      e.g. {samples[geoKey].join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Btn onClick={doImport} full>Import Vocabulary</Btn>
          </>
        )}

        {/* STEP: done */}
        {step === "done" && (
          <>
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <Check size={44} color={C.green} style={{ display: "block", margin: "0 auto 12px" }} />
              <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Vocabulary updated!</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, textAlign: "left", marginTop: 16 }}>
                {APP_VOCAB_FIELDS.map(af => counts[af.key] > 0 && (
                  <div key={af.key} style={{ display: "flex", justifyContent: "space-between", background: C.surfaceHigh, borderRadius: 8, padding: "7px 12px" }}>
                    <span style={{ color: C.muted, fontSize: 13 }}>{af.label}</span>
                    <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>+{counts[af.key]} values</span>
                  </div>
                ))}
              </div>
            </div>
            <Btn onClick={onClose} full variant="secondary">Done</Btn>
          </>
        )}
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// VOCAB EDITOR
// ═══════════════════════════════════════════════════════════════════════════════
function VocabEditor({ vocab, onSave, onClose }) {
  const [local, setLocal] = useState(() =>
    Object.fromEntries(APP_VOCAB_FIELDS.map(f => [f.key, (vocab[f.key] ?? []).join("\n")]))
  );
  const [tab, setTab] = useState(APP_VOCAB_FIELDS[0].key);

  const current = APP_VOCAB_FIELDS.find(f => f.key === tab);
  const lineCount = local[tab].split("\n").filter(l => l.trim()).length;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, width: "100%", maxWidth: 500, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Vocabulary Editor</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        {/* Field tabs — scrollable */}
        <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${C.border}`, paddingLeft: 12 }}>
          {APP_VOCAB_FIELDS.map(f => (
            <button key={f.key} onClick={() => setTab(f.key)} style={{
              flexShrink: 0, padding: "8px 12px", background: "none", border: "none", cursor: "pointer",
              borderBottom: `2px solid ${tab === f.key ? C.accent : "transparent"}`,
              color: tab === f.key ? C.accent : C.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
            }}>{f.label}</button>
          ))}
        </div>

        {/* Editor area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 11, color: C.muted }}>One value per line · {lineCount} entries</div>
          <textarea
            value={local[tab]}
            onChange={e => setLocal(l => ({ ...l, [tab]: e.target.value }))}
            rows={12}
            style={{
              width: "100%", boxSizing: "border-box", background: C.surfaceHigh,
              border: `1px solid ${C.border}`, borderRadius: 8,
              padding: "10px", color: C.text, fontSize: 13,
              outline: "none", resize: "none", lineHeight: 1.6, fontFamily: "inherit",
            }}
          />
        </div>

        {/* Save */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${C.border}` }}>
          <Btn onClick={() => {
            const updated = {};
            APP_VOCAB_FIELDS.forEach(f => {
              updated[f.key] = local[f.key].split("\n").map(l => l.trim()).filter(Boolean);
            });
            onSave(updated);
            onClose();
          }} full>Save Vocabulary</Btn>
        </div>
      </div>
    </div>
  );
}

function SyncTab({ jobs, places, vocab, addrBook, onImport, onImportVocab, onImportAddresses, onSaveVocab }) {
  const [importText, setImportText]   = useState("");
  const [exportDone, setExportDone]   = useState(false);
  const [importState, setImportState] = useState(null); // null | "ok" | "err"
  const [importFocus, setImportFocus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [geoOpen,     setGeoOpen]     = useState(false);
  const [vocabOpen,   setVocabOpen]   = useState(false);

  const encode = data => btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const decode = str  => JSON.parse(decodeURIComponent(escape(atob(str.trim()))));

  const handleExport = async () => {
    const payload = encode({ jobs, places, vocab, addrBook, exportedAt: new Date().toISOString() });
    try {
      await navigator.clipboard.writeText(payload);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
      // fallback: select the text from a temp textarea
      const ta = document.createElement("textarea");
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    }
  };

  const handleImport = () => {
    try {
      const data = decode(importText);
      if (!data.jobs || !data.places) throw new Error("invalid");
      setConfirmOpen(true);
    } catch {
      setImportState("err");
    }
  };

  const confirmImport = () => {
    try {
      const data = decode(importText);
      onImport(data);
      setImportState("ok");
      setImportText("");
      setConfirmOpen(false);
    } catch {
      setImportState("err");
      setConfirmOpen(false);
    }
  };

  const stats = {
    jobs:    jobs.length,
    places:  places.length,
    vocab:   Object.values(vocab).reduce((s, a) => s + a.length, 0),
    addrs:   Object.keys(addrBook).length,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Sync</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Export your data as a code · share via WhatsApp · import on another phone</div>
      </div>

      {/* Current state summary */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Jobs",          value: stats.jobs },
          { label: "Places",        value: stats.places },
          { label: "Address book",  value: stats.addrs },
          { label: "Vocab entries", value: stats.vocab },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 22, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Export */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px" , display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Export</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Encodes all jobs, places, address book and vocabulary into a single code and copies it to your clipboard. Paste it into WhatsApp and send to the other phone.
        </p>
        <Btn onClick={handleExport} variant={exportDone ? "green" : "primary"} full>
          {exportDone ? <><Check size={14} /> Copied to clipboard!</> : <>📤 Export &amp; Copy Code</>}
        </Btn>
      </div>

      {/* Import */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Import</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Paste the code received from another phone. <strong style={{ color: C.red }}>This will replace all current data.</strong>
        </p>
        <div style={{ position: "relative" }}>
          <textarea
            value={importText}
            onChange={e => { setImportText(e.target.value); setImportState(null); }}
            onFocus={async () => {
              setImportFocus(true);
              if (importText) return;
              try { const t = await navigator.clipboard.readText(); if (t?.trim()) setImportText(t.trim()); } catch {}
            }}
            onBlur={() => setImportFocus(false)}
            rows={3}
            placeholder="Paste export code here… (auto-pastes from clipboard on tap)"
            style={{
              width: "100%", boxSizing: "border-box", background: C.surfaceHigh,
              border: `1px solid ${importState === "err" ? C.red : importState === "ok" ? C.green : importFocus ? C.accent : C.border}`,
              borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: 12,
              outline: "none", resize: "none", fontFamily: "monospace", lineHeight: 1.4,
              transition: "border-color .15s",
            }}
          />
        </div>
        {importState === "err" && <div style={{ fontSize: 11, color: C.red }}>⚠ Invalid code — make sure you copied the full export text.</div>}
        {importState === "ok"  && <div style={{ fontSize: 11, color: C.green }}>✓ Data imported successfully.</div>}
        <Btn onClick={handleImport} disabled={!importText.trim()} variant="secondary" full>
          📥 Import from Code
        </Btn>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div onClick={() => setConfirmOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.red}66`, borderRadius: 20, width: "100%", maxWidth: 360, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Replace all data?</div>
            <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
              This will overwrite your current {stats.jobs} jobs, {stats.places} places and all vocabulary. This cannot be undone.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <Btn variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Btn>
              <Btn variant="danger" onClick={confirmImport}>Replace</Btn>
            </div>
          </div>
        </div>
      )}

      {/* QGIS import */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Import from QGIS</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Load a GeoJSON export from QGIS to populate autocomplete lists for city, company, survey type, diameter and more.
        </p>
        <Btn onClick={() => setGeoOpen(true)} variant="secondary" full>🗺 Import QGIS Vocabulary</Btn>
      </div>

      {geoOpen && (
        <GeoJSONImporter
          onImportVocab={onImportVocab}
          onImportAddresses={onImportAddresses}
          onClose={() => setGeoOpen(false)}
        />
      )}

      {/* Vocab editor */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Vocabulary</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          View and edit the autocomplete lists for survey type, company, city, diameter and more.
        </p>
        <Btn onClick={() => setVocabOpen(true)} variant="secondary" full>✏️ Edit Vocabulary</Btn>
      </div>

      {vocabOpen && (
        <VocabEditor vocab={vocab} onSave={onSaveVocab} onClose={() => setVocabOpen(false)} />
      )}
    </div>
  );
}
const TABS = [
  { id: "jobs",    label: "Jobs",   Icon: MapPin },
  { id: "places",  label: "Places", Icon: Building2 },
  { id: "routing", label: "Route",  Icon: Route },
  { id: "sync",    label: "Sync",   Icon: RotateCw },
];

function App() {
  const [jobs,     setJobs]     = useState([]);
  const [places,   setPlaces]   = useState([]);
  const [vocab,    setVocab]    = useState({});
  const [addrBook, setAddrBook] = useState({});
  const [tab,      setTab]      = useState("jobs");
  const [loaded,   setLoaded]   = useState(false);
  const [initRoute, setInitRoute] = useState(null);
  const [initStop,  setInitStop]  = useState(0);

  useEffect(() => {
    Promise.all([
      storeLoad("srp6-jobs"), storeLoad("srp6-places"),
      storeLoad("srp6-vocab"), storeLoad("srp6-addr"),
      storeLoad("srp6-route"), storeLoad("srp6-stop"),
    ]).then(([j, p, v, a, r, s]) => {
      if (j) setJobs(j);
      if (p) setPlaces(p);
      if (v) setVocab(v);
      if (a) setAddrBook(a);
      if (r && r.length > 0) {
        setInitRoute(r);
        setInitStop(s ?? 0);
        setTab("routing");
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => { if (loaded) storeSave("srp6-jobs",   jobs);     }, [jobs,     loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-places", places);   }, [places,   loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-vocab",  vocab);    }, [vocab,    loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-addr",   addrBook); }, [addrBook, loaded]);

  const addJob = useCallback(job => {
    setJobs(p => [...p, job]);
    setVocab(v => mergeVocab(v, job));
    setAddrBook(a => mergeAddress(a, job));
  }, []);

  const updateJob = useCallback((id, upd) => {
    setJobs(p => p.map(j => j.id === id ? { ...j, ...upd } : j));
    setVocab(v => mergeVocab(v, upd));
    setAddrBook(a => mergeAddress(a, upd));
  }, []);

  const deleteJob   = useCallback(id => setJobs(p => p.filter(j => j.id !== id)), []);
  const addPlace    = useCallback(pl => setPlaces(p => [...p, pl]), []);
  const updatePlace = useCallback((id, u) => setPlaces(p => p.map(pl => pl.id === id ? { ...pl, ...u } : pl)), []);
  const deletePlace = useCallback(id => setPlaces(p => p.filter(pl => pl.id !== id)), []);

  const importAll = useCallback(data => {
    setJobs(data.jobs ?? []);
    setPlaces(data.places ?? []);
    setVocab(data.vocab ?? {});
    setAddrBook(data.addrBook ?? {});
  }, []);

  const importVocab = useCallback(additions => {
    setVocab(v => {
      const next = { ...v };
      Object.entries(additions).forEach(([key, vals]) => {
        const existing = next[key] ?? [];
        next[key] = [...new Set([...vals, ...existing])].slice(0, 200);
      });
      return next;
    });
  }, []);

  const importAddresses = useCallback(newAddrs => {
    setAddrBook(a => ({ ...a, ...newAddrs }));
  }, []);

  const saveVocab = useCallback(updated => {
    setVocab(updated);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>Survey Route Planner</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>v19</span>
          </div>
          <nav style={{ display: "flex" }}>
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                padding: "9px 0 12px", background: "none", border: "none", cursor: "pointer",
                borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`,
                color: tab === id ? C.accent : C.muted, fontWeight: 700, fontSize: 12, transition: "all .15s",
              }}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "16px 16px 70px" }}>
        {tab === "jobs"    && <JobsTab    jobs={jobs} vocab={vocab} addrBook={addrBook} onAdd={addJob} onUpdate={updateJob} onDelete={deleteJob} />}
        {tab === "places"  && <PlacesTab  places={places} onAdd={addPlace} onUpdate={updatePlace} onDelete={deletePlace} />}
        {tab === "routing" && <RoutingTab jobs={jobs} places={places} vocab={vocab} addrBook={addrBook} onUpdateJob={updateJob} initRoute={initRoute} initStop={initStop} />}
        {tab === "sync"    && <SyncTab    jobs={jobs} places={places} vocab={vocab} addrBook={addrBook} onImport={importAll} onImportVocab={importVocab} onImportAddresses={importAddresses} onSaveVocab={saveVocab} />}
      </div>
    </div>
  );
}


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
