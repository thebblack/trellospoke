import { useState, useEffect, useRef } from "react";
import { MapPin, Plus, X, Edit2, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { C, COMPLETION_FIELDS, EMPTY_JOB } from "../constants.js";
import { genId, coordLookup, coordSave } from "../utils.js";
import { Btn, Pill, Checkbox, Section, Grid2 } from "../components/ui.jsx";
import { InputField, AutoField, CoordField } from "../components/fields.jsx";

// ─── Job Modal ───────────────────────────────────────────────────────────────
function JobModal({ job, vocab, addrBook, onSave, onClose }) {
  const [f, setF] = useState(() =>
    job
      ? { ...EMPTY_JOB, ...job, coords: { lat: "", lng: "", ...job.coords }, completion: { ...job.completion } }
      : { ...EMPTY_JOB }
  );
  const s  = (k, v) => setF(p => ({ ...p, [k]: v }));
  const sk = (k, v) => setF(p => ({ ...p, completion: { ...p.completion, [k]: v } }));
  const V  = field => vocab[field] ?? [];

  const [coordSuggestion, setCoordSuggestion] = useState(null);
  const [coordSaved, setCoordSaved] = useState(false);
  const lookupTimer = useRef(null);

  useEffect(() => {
    clearTimeout(lookupTimer.current);
    if (f.city && f.street && f.number) {
      lookupTimer.current = setTimeout(async () => {
        const result = await coordLookup(f.city, f.street, f.number);
        setCoordSuggestion(result || null);
      }, 600);
    } else {
      setCoordSuggestion(null);
    }
    return () => clearTimeout(lookupTimer.current);
  }, [f.city, f.street, f.number]);

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
          <Grid2>
            <InputField label="Street" value={f.street} onChange={v => s("street", v)} placeholder="Strada Florilor" />
            <InputField label="Number" value={f.number} onChange={v => s("number", v)} placeholder="42A" />
          </Grid2>
          <Grid2>
            <AutoField label="City"    value={f.city}    onChange={v => s("city", v)}    placeholder="Town / City" suggestions={V("city")} />
            <AutoField label="Company" value={f.company} onChange={v => s("company", v)} placeholder="Client name" suggestions={V("company")} />
          </Grid2>
          {coordSuggestion && (
            <div style={{ background: C.blueLow, border: `1px solid ${C.blue}44`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 11, color: C.blue, fontWeight: 700 }}>📍 Nearby address found</div>
              <div style={{ fontSize: 12, color: C.text }}>{coordSuggestion.street} {coordSuggestion.number}, {coordSuggestion.city}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{coordSuggestion.lat}, {coordSuggestion.lon}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
                <a href={`https://maps.google.com/?q=${coordSuggestion.lat},${coordSuggestion.lon}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: C.blue, textDecoration: "none", padding: "4px 10px", border: `1px solid ${C.blue}66`, borderRadius: 7 }}>
                  🗺 Maps
                </a>
                <button onClick={() => navigator.clipboard.writeText(`${coordSuggestion.lat}, ${coordSuggestion.lon}`)}
                  style={{ fontSize: 12, color: C.muted, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                  📋 Copy coords
                </button>
                <button onClick={() => { s("coords", { lat: String(coordSuggestion.lat), lng: String(coordSuggestion.lon) }); setCoordSuggestion(null); }}
                  style={{ fontSize: 12, color: C.text, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
                  Use these coords
                </button>
              </div>
            </div>
          )}
          <CoordField
            coords={f.coords}
            onChange={v => { setF(p => ({ ...p, coords: v })); setCoordSaved(false); }}
          />
          {f.coords?.lat && f.coords?.lng && f.city && f.street && f.number && !coordSaved && (
            <button onClick={async () => { await coordSave(f.city, f.street, f.number, f.coords.lat, f.coords.lng); setCoordSaved(true); }}
              style={{ fontSize: 12, color: C.green, background: C.greenLow, border: `1px solid ${C.green}44`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", textAlign: "left" }}>
              💾 Save address to coordinate database
            </button>
          )}
          {coordSaved && <div style={{ fontSize: 12, color: C.green }}>✓ Saved to database</div>}
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

        <Btn onClick={() => { if (f.street.trim()) { onSave({ ...f, name: [f.street, f.number].filter(Boolean).join(" ") }); onClose(); } }} disabled={!f.street.trim()} full>
          {job ? "Save Changes" : "Add Job"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Job Card ────────────────────────────────────────────────────────────────
function JobCard({ ro, job, onEdit, onDelete, onAdvance }) {
  const [open, setOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(null);
  const THRESHOLD = 80;

  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX; setSwiping(true); };
  const onTouchMove  = e => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -THRESHOLD));
  };
  const onTouchEnd   = () => {
    if (swipeX <= -THRESHOLD) {
      if (window.confirm("Delete this job?")) onDelete(job.id);
    }
    setSwipeX(0); setSwiping(false); touchStartX.current = null;
  };
  const doneCount = COMPLETION_FIELDS.filter(f => job.completion?.[f.key]).length;
  const allDone   = doneCount === COMPLETION_FIELDS.length;
  const hasCoords = !!(job.coords?.lat && job.coords?.lng);
  const specs = [
    { label: "Diameter",       value: job.diameter,       unit: "mm" },
    { label: "Approx. length", value: job.approxLength,   unit: "m"  },
    { label: "Branch diam.",   value: job.branchDiameter, unit: "mm" },
    { label: "Volume",         value: job.volume,          unit: "m³" },
  ].filter(d => d.value);

  const c = job.completion ?? {};
  const nextAction = !c.fieldWork  ? { key: "fieldWork",  label: "✓ Field Done"  }
                   : !c.officeWork ? { key: "officeWork", label: "✓ Office Done" }
                   : !c.sent       ? { key: "sent",       label: "✓ Sent"        }
                   : null;

  return (
    <div style={{ position: "relative", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: THRESHOLD, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14 }}>
        <Trash2 size={20} color="#fff" />
      </div>
      <div
        onTouchStart={ro ? undefined : onTouchStart}
        onTouchMove={ro ? undefined : onTouchMove}
        onTouchEnd={ro ? undefined : onTouchEnd}
        style={{ transform: `translateX(${swipeX}px)`, transition: swiping ? "none" : "transform .2s", background: C.surface, border: `1px solid ${allDone ? C.green + "44" : C.border}`, borderRadius: 14, overflow: "hidden" }}>
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          {nextAction && !ro && (
            <button onClick={e => { e.stopPropagation(); onAdvance(job.id, nextAction.key); }}
              style={{ background: C.accent, border: "none", borderRadius: 8, padding: "5px 10px", color: "#000", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
              {nextAction.label}
            </button>
          )}
          {hasCoords && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${job.coords.lat},${job.coords.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 10px", color: C.text, fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", textDecoration: "none" }}>
              📍 Maps
            </a>
          )}
          {open ? <ChevronUp size={15} color={C.muted} /> : <ChevronDown size={15} color={C.muted} />}
        </div>
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
              const handleClick = e => {
                e.stopPropagation();
                if (done) {
                  if (window.confirm(`Uncheck "${label}"? This will move the job back.`)) {
                    onAdvance(job.id, key, false);
                  }
                } else {
                  onAdvance(job.id, key, true);
                }
              };
              return (
                <div key={key} onClick={handleClick} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 8px", borderRadius: 8, background: done ? C.greenLow : C.surfaceHigh, border: `1px solid ${done ? C.green + "44" : C.border}`, cursor: "pointer", userSelect: "none" }}>
                  <Checkbox done={done} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: done ? C.green : C.muted }}>{label}</span>
                </div>
              );
            })}
          </div>
          {hasCoords && <a href={`https://www.google.com/maps/search/?api=1&query=${job.coords.lat},${job.coords.lng}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontSize: 11, color: C.muted, fontFamily: "monospace", textDecoration: "none" }}>📍 {job.coords.lat}, {job.coords.lng}</a>}
          {!ro && <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => onEdit(job)} variant="secondary" small><Edit2 size={12} /> Edit</Btn>
            <Btn onClick={() => onDelete(job.id)} variant="danger" small><Trash2 size={12} /> Delete</Btn>
          </div>}
        </div>
      )}
      </div>
    </div>
  );
}

// ─── Jobs Tab ────────────────────────────────────────────────────────────────
export function JobsTab({ ro, jobs, vocab, addrBook, onAdd, onUpdate, onDelete }) {
  const [modal,     setModal]     = useState(null);
  const [statusTab, setStatusTab] = useState("new");

  const advance = (id, key, value = true) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    onUpdate(id, { completion: { ...job.completion, [key]: value } });
  };

  const STATUS_TABS = [
    { id: "new",     label: "New",     filter: j => !j.completion?.fieldWork },
    { id: "field",   label: "Office",  filter: j => j.completion?.fieldWork && !j.completion?.officeWork },
    { id: "office",  label: "Mail",    filter: j => j.completion?.officeWork && !j.completion?.sent },
    { id: "sent",    label: "Sent",    filter: j => j.completion?.sent },
    { id: "all",     label: "All",     filter: j => true },
  ];

  const activeFilter = STATUS_TABS.find(t => t.id === statusTab)?.filter ?? (() => true);
  const filtered = jobs.filter(activeFilter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Jobs</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{jobs.length} total · {jobs.filter(j => j.completion?.payment).length} paid</div>
        </div>
        {!ro && <Btn onClick={() => setModal("new")}><Plus size={14} /> New Job</Btn>}
      </div>

      <div style={{ display: "flex", overflowX: "auto", gap: 6, paddingBottom: 2 }}>
        {STATUS_TABS.map(t => {
          const count = jobs.filter(t.filter).length;
          const active = statusTab === t.id;
          return (
            <button key={t.id} onClick={() => setStatusTab(t.id)} style={{
              flexShrink: 0, padding: "5px 10px", borderRadius: 20,
              background: active ? C.accent : C.surfaceHigh,
              border: `1px solid ${active ? C.accent : C.border}`,
              color: active ? "#000" : C.muted,
              fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap",
            }}>
              {t.label} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.muted }}>
          <MapPin size={44} color={C.muted} style={{ margin: "0 auto 14px", opacity: 0.25, display: "block" }} />
          <div style={{ color: C.text, fontWeight: 600, fontSize: 16 }}>
            {jobs.length === 0 ? "No jobs yet" : "No jobs in this stage"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {jobs.length === 0 ? "Tap New Job to create your first survey" : ""}
          </div>
        </div>
      )}

      {filtered.map(job => <JobCard key={job.id} ro={ro} job={job} onEdit={j => setModal(j)} onDelete={onDelete} onAdvance={advance} />)}

      {modal && (
        <JobModal
          job={modal === "new" ? null : modal}
          vocab={vocab} addrBook={addrBook}
          onSave={f => modal === "new" ? onAdd({ ...f, id: genId(), completion: { added: true } }) : onUpdate(modal.id, f)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// Export JobModal for use in RoutingTab
export { JobModal };
