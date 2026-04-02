import { Map, Navigation } from "lucide-react";
import { C } from "../constants.js";

export function NavModal({ item, onClose }) {
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
