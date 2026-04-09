import { useState, useEffect, useMemo } from "react";
import { Check, X, ChevronUp, ChevronDown, Search, RefreshCw } from "lucide-react";
import { C } from "../constants.js";
import { getSbHeaders, SB_URL } from "../storage.js";

export function ArchiveTab({ ro, rows, loading, error, onFetch, onUpdateRow }) {

  // Trigger fetch on first mount if not cached
  useEffect(() => { onFetch(); }, [onFetch]);

  // Filters — default to current year/month
  const now = new Date();
  const [fYear, setFYear]       = useState(String(now.getFullYear()));
  const [fMonth, setFMonth]     = useState(String(now.getMonth() + 1));
  const [fCompany, setFCompany] = useState("");
  const [fSearch, setFSearch]   = useState("");
  const [fPaid, setFPaid]       = useState(""); // "", "yes", "no"

  // Sort
  const [sortCol, setSortCol]   = useState("year");
  const [sortAsc, setSortAsc]   = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);

  // ─── Filter options ─────────────────────────────────────────────────────────
  const years     = useMemo(() => [...new Set((rows || []).map(r => r.year).filter(Boolean))].sort((a, b) => b - a), [rows]);
  const months    = useMemo(() => [...new Set((rows || []).map(r => r.month).filter(Boolean))].sort((a, b) => a - b), [rows]);
  const companies = useMemo(() => [...new Set((rows || []).map(r => r.company).filter(Boolean))].sort(), [rows]);

  // ─── Filtered + sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let f = [...(rows || [])];
    if (fYear) {
      const y = Number(fYear);
      f = f.filter(r => Number(r.year) === y);
    }
    if (fMonth)   f = f.filter(r => Number(r.month) === Number(fMonth));
    if (fCompany) f = f.filter(r => (r.company || "").toLowerCase() === fCompany.toLowerCase());
    if (fPaid === "yes") f = f.filter(r => r.paid);
    if (fPaid === "no")  f = f.filter(r => !r.paid);
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
  }, [rows, fYear, fMonth, fCompany, fPaid, fSearch, sortCol, sortAsc]);

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
    const oldVal = row[field];
    // Optimistic update via parent
    onUpdateRow(row.id, field, newVal);
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
      onUpdateRow(row.id, field, oldVal);
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

  if (loading || rows === null) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: C.text, fontWeight: 800, fontSize: 20 }}>Archive</div>
          <div style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{rows.length} jobs · tap invoice/paid to toggle</div>
        </div>
        <button onClick={() => onFetch(true)} title="Refresh from server"
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: C.muted, display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <RefreshCw size={12} /> Refresh
        </button>
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
        <select value={fYear} onChange={e => { setFYear(e.target.value); setVisibleCount(100); }} style={selectStyle}>
          <option value="">Year</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={fMonth} onChange={e => { setFMonth(e.target.value); setVisibleCount(100); }} style={selectStyle}>
          <option value="">Month</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fCompany} onChange={e => { setFCompany(e.target.value); setVisibleCount(100); }} style={selectStyle}>
          <option value="">Company</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fPaid} onChange={e => { setFPaid(e.target.value); setVisibleCount(100); }} style={selectStyle}>
          <option value="">Paid?</option>
          <option value="yes">Paid</option>
          <option value="no">Unpaid</option>
        </select>
        <div style={{ flex: 1, minWidth: 100, position: "relative" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: 9, color: C.muted }} />
          <input
            type="text" value={fSearch} onChange={e => { setFSearch(e.target.value); setVisibleCount(100); }}
            placeholder="Search address…"
            style={{ ...selectStyle, width: "100%", boxSizing: "border-box", paddingLeft: 24 }}
          />
        </div>
        {(fYear || fMonth || fCompany || fPaid || fSearch) && (
          <button onClick={() => { setFYear(""); setFMonth(""); setFCompany(""); setFPaid(""); setFSearch(""); setVisibleCount(100); }}
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
            { col: "year", label: "Year" },
            { col: "month", label: "Mo" },
            { col: "address", label: "Address" },
            { col: "company", label: "Company" },
            { col: "invoice", label: "Inv" },
            { col: "paid", label: "Paid" },
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
          {filtered.slice(0, visibleCount).map((row, idx) => (
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
          {filtered.length > visibleCount && (
            <button onClick={() => setVisibleCount(v => v + 100)}
              style={{ width: "100%", padding: "10px", background: "none", border: "none", color: C.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Show more ({filtered.length - visibleCount} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
