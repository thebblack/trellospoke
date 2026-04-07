import { useState, useEffect, useCallback } from "react";
import { MapPin } from "lucide-react";
import { C, TABS } from "./constants.js";
import { storeLoad, storeSave, signIn, signOut, isSignedIn, getAccessMode } from "./storage.js";
import { mergeVocab, mergeAddress } from "./utils.js";
import { Btn } from "./components/ui.jsx";
import { JobsTab } from "./tabs/JobsTab.jsx";
import { PlacesTab } from "./tabs/PlacesTab.jsx";
import { RoutingTab } from "./tabs/RoutingTab.jsx";
import { SyncTab } from "./tabs/SyncTab.jsx";

export default function App() {
  // ═══ ALL STATE HOOKS ═══
  const [jobs,     setJobs]     = useState([]);
  const [places,   setPlaces]   = useState([]);
  const [vocab,    setVocab]    = useState({});
  const [addrBook, setAddrBook] = useState({});
  const [tab,      setTab]      = useState("jobs");
  const [loaded,   setLoaded]   = useState(false);
  const [initRoute, setInitRoute] = useState(null);
  const [initStop,  setInitStop]  = useState(0);
  const [access,    setAccess]    = useState(() => getAccessMode());
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy,  setAuthBusy]  = useState(false);

  // ═══ ALL EFFECTS — MUST BE BEFORE ANY RETURN ═══
  useEffect(() => {
    if (access === "pending") return;
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
  }, [access]);

  useEffect(() => { if (loaded) storeSave("srp6-jobs",   jobs);     }, [jobs,     loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-places", places);   }, [places,   loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-vocab",  vocab);    }, [vocab,    loaded]);
  useEffect(() => { if (loaded) storeSave("srp6-addr",   addrBook); }, [addrBook, loaded]);

  // ═══ ALL CALLBACKS — MUST BE BEFORE ANY RETURN ═══
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

  // ═══ AUTH FUNCTIONS ═══
  const handleSignIn = async () => {
    setAuthError("");
    setAuthBusy(true);
    try {
      await signIn(email, password);
      setAccess(getAccessMode());
    } catch (e) {
      setAuthError(e.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    signOut();
    setAccess("pending");
    setEmail("");
    setPassword("");
    setLoaded(false);
  };

  const ro = access === "ro";

  // ═══ EARLY RETURNS — AFTER ALL HOOKS ═══
  if (access === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
          <div style={{ width: 56, height: 56, background: C.accent, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={28} color="#fff" />
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.text, fontWeight: 800, fontSize: 22 }}>Survey Route Planner</div>
            <div style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>Sign in to continue</div>
          </div>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              style={{
                width: "100%", boxSizing: "border-box", background: C.surface,
                border: `2px solid ${authError ? C.red : C.border}`, borderRadius: 12,
                padding: "12px 16px", color: C.text, fontSize: 14,
                outline: "none", transition: "border-color .2s",
              }}
              autoFocus
            />
            <input
              type="password"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSignIn()}
              placeholder="Password"
              style={{
                width: "100%", boxSizing: "border-box", background: C.surface,
                border: `2px solid ${authError ? C.red : C.border}`, borderRadius: 12,
                padding: "12px 16px", color: C.text, fontSize: 14,
                outline: "none", transition: "border-color .2s",
              }}
            />
            {authError && <div style={{ textAlign: "center", color: C.red, fontSize: 12, fontWeight: 700 }}>{authError}</div>}
            <Btn onClick={handleSignIn} full disabled={authBusy}>
              {authBusy ? "Signing in…" : "Sign In"}
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ color: C.muted, fontSize: 13 }}>Loading…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ═══ MAIN RENDER ═══
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: C.text }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 28, height: 28, background: C.accent, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MapPin size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>Survey Route Planner</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>v34</span>
            <span onClick={handleSignOut} style={{ fontSize: 10, color: ro ? C.accent : C.green, fontWeight: 700, cursor: "pointer", padding: "2px 7px", border: `1px solid ${ro ? C.accent : C.green}44`, borderRadius: 6 }}>
              {ro ? "🔒 RO" : "✏️ RW"}
            </span>
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
        {tab === "jobs"    && <JobsTab    ro={ro} jobs={jobs} vocab={vocab} addrBook={addrBook} onAdd={addJob} onUpdate={updateJob} onDelete={deleteJob} />}
        {tab === "places"  && <PlacesTab  ro={ro} places={places} onAdd={addPlace} onUpdate={updatePlace} onDelete={deletePlace} />}
        {tab === "routing" && <RoutingTab ro={ro} jobs={jobs} places={places} vocab={vocab} addrBook={addrBook} onUpdateJob={updateJob} initRoute={initRoute} initStop={initStop} />}
        {tab === "sync"    && <SyncTab    ro={ro} jobs={jobs} places={places} vocab={vocab} addrBook={addrBook} onImport={importAll} onImportVocab={importVocab} onImportAddresses={importAddresses} onSaveVocab={saveVocab} />}
      </div>
    </div>
  );
}
