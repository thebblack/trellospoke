import { useState, useEffect } from "react";
import { MapPin, RotateCw, ChevronLeft, ChevronRight, Navigation, Building2, Edit2, Check } from "lucide-react";
import { C } from "../constants.js";
import { genId, tsp, buildGoogleMapsUrl } from "../utils.js";
import { storeSave } from "../storage.js";
import { Btn, Pill } from "../components/ui.jsx";
import { RouteMap } from "../components/RouteMap.jsx";
import { NavModal } from "../components/NavModal.jsx";
import { JobModal } from "./JobsTab.jsx";

export function RoutingTab({ ro, jobs, places, vocab, addrBook, onUpdateJob, initRoute, initStop }) {
  const [selJobs,    setSelJobs]    = useState(new Set());
  const [selPlaces,  setSelPlaces]  = useState([]);
  const [currLocCoords, setCurrLocCoords] = useState(null);
  const [currLocLoading, setCurrLocLoading] = useState(false);
  const CURR_LOC_ID = "__current_location__";

  const addCurrentLocation = () => {
    if (currLocCoords) {
      const uid = genId();
      setSelPlaces(p => [...p, { id: CURR_LOC_ID, uid }]);
      setPinStartId(uid);
      if (!pinEndId) setPinEndId(uid);
      return;
    }
    setCurrLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCurrLocCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCurrLocLoading(false);
        const uid = genId();
        setSelPlaces(p => [...p, { id: CURR_LOC_ID, uid }]);
        setPinStartId(uid);
        if (!pinEndId) setPinEndId(uid);
      },
      () => { setCurrLocLoading(false); alert("Could not get location."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const [pinStartId, setPinStartId] = useState(null);
  const [pinFirstId, setPinFirstId] = useState(null);
  const [pinLastId,  setPinLastId]  = useState(null);
  const [pinEndId,   setPinEndId]   = useState(null);
  const [route,      setRoute]      = useState(() => initRoute ?? []);
  const [stop,       setStop]       = useState(() => initStop  ?? 0);
  const [phase,      setPhase]      = useState(() => (initRoute?.length > 0) ? "run" : "select");
  const [navModal,   setNavModal]   = useState(null);
  const [editModal,  setEditModal]  = useState(null);

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

  // Only show jobs that haven't had field work done yet
  const newJobs = jobs.filter(j => !j.completion?.fieldWork);

  const allItems = [
    ...selPlaces.map(({ id, uid }) => {
      if (id === CURR_LOC_ID) {
        return currLocCoords ? { id: uid, _origId: CURR_LOC_ID, _type: "place", name: "Current Location", coords: currLocCoords } : null;
      }
      const pl = places.find(p => p.id === id);
      return pl ? { ...pl, id: uid, _origId: id, _type: "place" } : null;
    }).filter(Boolean),
    ...newJobs.filter(j => selJobs.has(j.id)).map(j => ({ ...j, _type: "job" })),
  ];

  const optimise = () => { setRoute(tsp(allItems, pinStartId, pinFirstId, pinLastId, pinEndId)); setStop(0); setPhase("run"); };
  const clearRoute = () => { setRoute([]); setStop(0); setPhase("select"); storeSave("srp6-route", []); storeSave("srp6-stop", 0); window.__savedRoute = null; };
  const itemLabel = item => item.name ?? "—";
  const itemSub   = item => [item.company, item.city].filter(Boolean).join(" · ");

  // ═══ RUN PHASE ═══
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
            const moveStop = (from, to) => {
              const r = [...route];
              const [removed] = r.splice(from, 1);
              r.splice(to, 0, removed);
              setRoute(r);
              setStop(to);
            };
            return (
              <div key={it.id + i} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <button onClick={() => i > 0 && moveStop(i, i - 1)} disabled={ro || i === 0}
                    style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6, cursor: (ro || i === 0) ? "default" : "pointer", opacity: (ro || i === 0) ? 0.3 : 1, padding: "0 5px", color: C.muted, fontSize: 12 }}>▲</button>
                  <button onClick={() => i < route.length - 1 && moveStop(i, i + 1)} disabled={ro || i === route.length - 1}
                    style={{ flex: 1, background: C.surfaceHigh, border: `1px solid ${C.border}`, borderRadius: 6, cursor: (ro || i === route.length - 1) ? "default" : "pointer", opacity: (ro || i === route.length - 1) ? 0.3 : 1, padding: "0 5px", color: C.muted, fontSize: 12 }}>▼</button>
                </div>
                <button onClick={() => setStop(i)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, textAlign: "left", width: "100%", cursor: "pointer", transition: "all .15s", background: active ? (it._type === "job" ? C.accentLow : C.blueLow) : C.surface, border: `1px solid ${active ? col : C.border}` }}>
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
              </div>
            );
          })}
        </div>
        {navModal  && <NavModal item={navModal} onClose={() => setNavModal(null)} />}
        {editModal && <JobModal job={editModal} vocab={vocab} addrBook={addrBook} onSave={f => { onUpdateJob(editModal.id, f); setEditModal(null); }} onClose={() => setEditModal(null)} />}
      </div>
    );
  }

  // ═══ SELECT PHASE ═══
  const noCoords = allItems.filter(i => !i.coords?.lat || !i.coords?.lng);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Route Planner</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Pick places &amp; jobs · pin start/end · optimise</div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${selPlaces.some(e => e.id === CURR_LOC_ID) ? C.blue : C.border}`, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 13 }}>📍 Current Location</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
              {currLocCoords ? `${currLocCoords.lat.toFixed(5)}, ${currLocCoords.lng.toFixed(5)}` : "Tap + to get GPS position"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {selPlaces.some(e => e.id === CURR_LOC_ID) && (
              <button onClick={() => { const last = selPlaces.filter(e => e.id === CURR_LOC_ID); removePlace(last[last.length - 1].uid); }}
                style={{ width: 28, height: 28, borderRadius: 8, background: C.surfaceHigh, border: `1px solid ${C.border}`, color: C.text, cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
            )}
            <button onClick={addCurrentLocation} disabled={currLocLoading}
              style={{ width: 28, height: 28, borderRadius: 8, background: selPlaces.some(e => e.id === CURR_LOC_ID) ? C.blueLow : C.surfaceHigh, border: `1px solid ${selPlaces.some(e => e.id === CURR_LOC_ID) ? C.blue : C.border}`, color: selPlaces.some(e => e.id === CURR_LOC_ID) ? C.blue : C.muted, cursor: "pointer", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {currLocLoading ? "…" : "+"}
            </button>
          </div>
        </div>
        {selPlaces.filter(e => e.id === CURR_LOC_ID).map(({ uid }, i) => (
          <div key={uid} style={{ borderTop: `1px solid ${C.border}`, padding: "8px 13px", display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: C.muted }}>#{i + 1}</span>
            {[{ name: "start", label: "🟢" }, { name: "end", label: "🏁" }].map(({ name, label }) => {
              const active = pinState[name] === uid;
              return (
                <button key={name} onClick={() => togglePin(name, uid)}
                  style={{ background: active ? C.green : C.surfaceHigh, border: `1px solid ${active ? C.green : C.border}`, borderRadius: 7, padding: "3px 7px", cursor: "pointer", fontSize: 12, color: active ? "#000" : C.muted, fontWeight: 700 }}>
                  {label}
                </button>
              );
            })}
          </div>
        ))}
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

      {newJobs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin size={13} color={C.accent} />
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Jobs</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              <button onClick={() => setSelJobs(new Set(newJobs.map(j => j.id)))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>All</button>
              <span style={{ color: C.border }}>·</span>
              <button onClick={() => setSelJobs(new Set())} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>None</button>
              <span style={{ color: C.muted, fontSize: 11 }}>· {selJobs.size} selected</span>
            </div>
          </div>
          {newJobs.map(job => {
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
          No new jobs — all jobs have field work done or add more in the <strong style={{ color: C.text }}>Jobs</strong> tab.
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
