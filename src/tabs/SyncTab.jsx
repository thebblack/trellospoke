import { useState } from "react";
import { MapPin, X, Check } from "lucide-react";
import { C, APP_VOCAB_FIELDS } from "../constants.js";
import { coordsFromFeature } from "../utils.js";
import { Btn } from "../components/ui.jsx";

// ─── GeoJSON Importer ────────────────────────────────────────────────────────
function GeoJSONImporter({ onImportVocab, onImportAddresses, onClose }) {
  const [step,    setStep]    = useState("upload");
  const [fields,  setFields]  = useState([]);
  const [mapping, setMapping] = useState({});
  const [samples, setSamples] = useState({});
  const [counts,  setCounts]  = useState({});
  const [error,   setError]   = useState(null);

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const geo = JSON.parse(ev.target.result);
        if (!geo.features?.length) throw new Error("No features found");
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
    const additions = {};
    APP_VOCAB_FIELDS.forEach(af => { additions[af.key] = new Set(); });
    Object.entries(mapping).forEach(([geoKey, appKey]) => {
      if (appKey === "ignore" || !additions[appKey]) return;
      (samples[geoKey] ?? []).forEach(v => additions[appKey].add(v));
    });
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

// ─── Vocabulary Editor ───────────────────────────────────────────────────────
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 12px" }}>
          <span style={{ color: C.text, fontWeight: 800, fontSize: 16 }}>Vocabulary Editor</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", overflowX: "auto", borderBottom: `1px solid ${C.border}`, paddingLeft: 12 }}>
          {APP_VOCAB_FIELDS.map(f => (
            <button key={f.key} onClick={() => setTab(f.key)} style={{
              flexShrink: 0, padding: "8px 12px", background: "none", border: "none", cursor: "pointer",
              borderBottom: `2px solid ${tab === f.key ? C.accent : "transparent"}`,
              color: tab === f.key ? C.accent : C.muted, fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
            }}>{f.label}</button>
          ))}
        </div>

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

// ─── Sync Tab ────────────────────────────────────────────────────────────────
export function SyncTab({ ro, jobs, places, vocab, addrBook, onImport, onImportVocab, onImportAddresses, onSaveVocab }) {
  const [importText, setImportText]   = useState("");
  const [exportDone, setExportDone]   = useState(false);
  const [importState, setImportState] = useState(null);
  const [importFocus, setImportFocus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [geoOpen,     setGeoOpen]     = useState(false);
  const [vocabOpen,   setVocabOpen]   = useState(false);
  const [dlBusy,      setDlBusy]      = useState(false);

  const encode = data => btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  const decode = str  => JSON.parse(decodeURIComponent(escape(atob(str.trim()))));

  const downloadArchive = async () => {
    setDlBusy(true);
    try {
      const { getSbHeaders, SB_URL } = await import("../storage.js");
      const headers = getSbHeaders();
      let all = [], offset = 0;
      while (true) {
        const resp = await fetch(
          `${SB_URL}/rest/v1/jobs_archive?select=*&order=year.desc,month.desc&limit=1000&offset=${offset}`,
          { headers }
        );
        const rows = await resp.json();
        all.push(...rows);
        if (rows.length < 1000) break;
        offset += 1000;
      }
      const cols = ["year","month","day","path","company","address","fee","invoice","paid"];
      const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [cols.join(","), ...all.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jobs_archive_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Download failed: " + e.message);
    } finally {
      setDlBusy(false);
    }
  };

  const handleExport = async () => {
    const payload = encode({ jobs, places, vocab, addrBook, exportedAt: new Date().toISOString() });
    try {
      await navigator.clipboard.writeText(payload);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
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

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px" , display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Export</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Encodes all jobs, places, address book and vocabulary into a single code and copies it to your clipboard. Paste it into WhatsApp and send to the other phone.
        </p>
        <Btn onClick={handleExport} variant={exportDone ? "green" : "primary"} full>
          {exportDone ? <><Check size={14} /> Copied to clipboard!</> : <>📤 Export &amp; Copy Code</>}
        </Btn>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Jobs Archive</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Download the full jobs archive as a CSV file. Open it in Google Sheets for sorting, filtering and totals.
        </p>
        <Btn onClick={downloadArchive} disabled={dlBusy} variant="secondary" full>
          {dlBusy ? "Downloading…" : "📊 Download Archive CSV"}
        </Btn>
      </div>

      {!ro && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
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
      </div>}

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

      {!ro && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Import from QGIS</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Load a GeoJSON export from QGIS to populate autocomplete lists for city, company, survey type, diameter and more.
        </p>
        <Btn onClick={() => setGeoOpen(true)} variant="secondary" full>🗺 Import QGIS Vocabulary</Btn>
      </div>}

      {geoOpen && (
        <GeoJSONImporter
          onImportVocab={onImportVocab}
          onImportAddresses={onImportAddresses}
          onClose={() => setGeoOpen(false)}
        />
      )}

      {!ro && <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 10, color: C.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Vocabulary</div>
        <p style={{ color: C.muted, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          View and edit the autocomplete lists for survey type, company, city, diameter and more.
        </p>
        <Btn onClick={() => setVocabOpen(true)} variant="secondary" full>✏️ Edit Vocabulary</Btn>
      </div>}

      {vocabOpen && (
        <VocabEditor vocab={vocab} onSave={onSaveVocab} onClose={() => setVocabOpen(false)} />
      )}
    </div>
  );
}
