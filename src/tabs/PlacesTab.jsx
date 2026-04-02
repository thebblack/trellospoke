import { useState } from "react";
import { Plus, X, Edit2, Trash2, Building2 } from "lucide-react";
import { C, EMPTY_PLACE } from "../constants.js";
import { genId } from "../utils.js";
import { Btn, Pill } from "../components/ui.jsx";
import { InputField, CoordField } from "../components/fields.jsx";

// ─── Place Modal ─────────────────────────────────────────────────────────────
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

// ─── Places Tab ──────────────────────────────────────────────────────────────
export function PlacesTab({ ro, places, onAdd, onUpdate, onDelete }) {
  const [modal, setModal] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Places</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Home base, depot, offices — route anchors</div>
        </div>
        {!ro && <Btn onClick={() => setModal("new")}><Plus size={14} /> Add</Btn>}
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
                  ? <a href={`https://www.google.com/maps/search/?api=1&query=${pl.coords.lat},${pl.coords.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ textDecoration: "none" }}><Pill label="📍 coords" done /></a>
                  : <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>⚠ No coords</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {!ro && <Btn onClick={() => setModal(pl)} variant="secondary" small><Edit2 size={11} /></Btn>}
              {!ro && <Btn onClick={() => onDelete(pl.id)} variant="danger" small><Trash2 size={11} /></Btn>}
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
