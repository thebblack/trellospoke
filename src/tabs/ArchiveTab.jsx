import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, X, ChevronUp, ChevronDown, Search } from "lucide-react";
import { C } from "../constants.js";
import { getSbHeaders, SB_URL } from "../storage.js";

export function ArchiveTab({ ro }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Filters
  const [fYear, setFYear]       = useState("");
  const [fMonth, setFMonth]     = useState("");
  const [fCompany, setFCompany] = useState("");
  const [fSearch, setFSearch]   = useState("");

  // Sort
  const [sortCol, setSortCol]   = useState("year");
  const [sortAsc, setSortAsc]   = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = getSbHeaders();
      let all = [], offset = 0;
      while (true) {
        const resp = await fetch(
          `${SB_URL}/rest/v1/jobs_archive?select=*&order=year.desc,month.desc,id.asc&limit=1000&offset=${offset}`,
          { headers }
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const batch = await resp.json();
        all.push(...batch);
        if (batch.length < 1000) break;
        offset += 1000;
      }
      // Deduplicate by path (pagination edge case)
      const seen = new Set();
      const unique = all.filter(r => { if (seen.has(r.path)) return false; seen.add(r.path); return true; });
      setRows(unique);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Filter options ─────────────────────────────────────────────────────────
  const years     = useMemo(() => [...new Set(rows.map(r => r.year).filter(Boolean))].sort((a, b) => b - a), [rows]);
  const months    = useMemo(() => [...new Set(rows.map(r => r.month).filter(Boolean))].sort((a, b) => a - b), [rows]);
  const companies = useMemo(() => [...new Set(rows.map(r => r.company).filter(Boolean))].sort(), [rows]);

  // ─── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let f = [...rows];
    if (fYear) {
      const y = Number(fYear);
      f = f.filter(r => Number(r.year) === y);
    }
    if (fMonth)   f = f.filter(r => Number(r.month) === Number(fMonth));
    if (fCompany) f = f.filter(r => (r.company || "").toLowerCase() === fCompany.toLowerCase());
    if (fSearch) {
      const q = fSearch.toLowerCase();
      f = f.filter(r => (r.address || "").toLowerCase().includes(q) || (r.path || "").toLowerCase().includes(q));
    }
    const numCols = new Set(["year", "month", "day", "fee", "invoice", "paid"]);
    f.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (numCols.has(sortCol)) {
        va = Number(va) || 0; vb = Number(vb) || 0;
        return sortAsc ? va - vb : vb - va;
      }
      va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase();
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return f;
  }, [rows, fYear, fMonth, fCompany, fSearch, sortCol, sortAsc]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: filtered.length,
    fee: filtered.reduce((s, r) => s + (parseFloat(r.fee) || 0), 0),
    invoiced: filtered.filter(r => r.invoice).length,
    paid: filtered.filter(r => r.paid).length,
  }), [filtered]);

  // ─── Toggle ─────────────────────────────────────────────────────────────────
  const toggle = async (row, field) => {
    if (ro) return;
    const newVal = row[field] ? 0 : 1;
    // Optimistic update
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: newVal } : r));
    try {
      const resp = await fetch(
        `${SB_URL}/rest/v1/jobs_archive?id=eq.${row.id}`,
        {
          method: "PATCH",
          headers: { ...getSbHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ [field]: newVal }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch {
      // Revert on failure
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: row[field] } : r));
    }
  };

  // ─── Sort handler ───────────────────────────────────────────────────────────
  const onSort = col => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return null;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  // ─── Pill style ─────────────────────────────────────────────────────────────
  const pill = (active, color) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 20, borderRadius: 6, fontSize: 11, fontWeight: 700,
    cursor: ro ? "default" : "pointer",
    background: active ? (color === "green" ? C.greenLow : C.blueLow) : C.surfaceHigh,
    color: active ? (color === "green" ? C.green : C.blue) : C.muted,
    border: `1px solid ${active ? (color === "green" ? C.green + "44" : C.blue + "44") : C.border}`,
    transition: "all .15s",
  });

  const selectStyle = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: "6px 8px", color: C.text, fontSize: 12, outline: "none",
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 40 }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ color: C.muted, fontSize: 13 }}>Loading archive…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <div style={{ color: C.red, fontSize: 14, fontWeight: 700 }}>Failed to load archive</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div>
        <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Archive</div>
        <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{rows.length} jobs · tap invoice/paid to toggle</div>
      </div>

      {/* Stats */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
        {[
          { label: "Showing", value: stats.total },
          { label: "Total fee", value: stats.fee.toLocaleString("ro-RO", { minimumFractionDigits: 0 }) },
          { label: "Invoiced", value: stats.invoiced },
          { label: "Paid", value: stats.paid },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 16, marginTop: 2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 12px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select value={fYear} onChange={e => setFYear(e.target.value)} style={selectStyle}>
          <option value="">Year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={fMonth} onChange={e => setFMonth(e.target.value)} style={selectStyle}>
          <option value="">Month</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fCompany} onChange={e => setFCompany(e.target.value)} style={selectStyle}>
          <option value="">Company</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1, minWidth: 100, position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: 9, color: C.muted }} />
          <input
            type="text" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search address…"
            style={{ ...selectStyle, width: "100%", boxSizing: "border-box", paddingLeft: 24 }}
          />
        </div>
        {(fYear || fMonth || fCompany || fSearch) && (
          <button onClick={() => { setFYear(""); setFMonth(""); setFCompany(""); setFSearch(""); }}
            style={{ background: "none", border: "none", color: C.accent, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "4px 8px" }}>
            <X size={12} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "52px 32px 1fr 90px 44px 44px", gap: 0, borderBottom: `1px solid ${C.border}`, padding: "8px 12px" }}>
          {[
            { col: "year", label: "Year", w: "52px" },
            { col: "month", label: "Mo", w: "32px" },
            { col: "address", label: "Address", w: "1fr" },
            { col: "company", label: "Company", w: "90px" },
            { col: "invoice", label: "Inv", w: "44px" },
            { col: "paid", label: "Paid", w: "44px" },
          ].map(({ col, label }) => (
            <button key={col} onClick={() => onSort(col)} style={{
              background: "none", border: "none", color: sortCol === col ? C.accent : C.muted,
              fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 2, padding: 0,
              textAlign: "left",
            }}>
              {label} <SortIcon col={col} />
            </button>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {filtered.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>No records match filters</div>
          )}
          {filtered.map((row, idx) => (
            <div key={row.path || idx} style={{
              display: "grid", gridTemplateColumns: "52px 32px 1fr 90px 44px 44px",
              gap: 0, padding: "7px 12px", borderBottom: `1px solid ${C.border}11`,
              alignItems: "center",
            }}>
              <span style={{ color: C.muted, fontSize: 12 }}>{row.year}</span>
              <span style={{ color: C.muted, fontSize: 12 }}>{row.month}</span>
              <span style={{ color: C.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{row.address}</span>
              <span style={{ color: C.muted, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.company}</span>
              <span style={pill(row.invoice, "green")} onClick={() => toggle(row, "invoice")}>
                {row.invoice ? <Check size={12} /> : "·"}
              </span>
              <span style={pill(row.paid, "blue")} onClick={() => toggle(row, "paid")}>
                {row.paid ? <Check size={12} /> : "·"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
