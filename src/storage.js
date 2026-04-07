const SUPABASE_URL = "https://kmfprxbfafbquilgchtv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttZnByeGJmYWZicXVpbGdjaHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODUxODYsImV4cCI6MjA4ODM2MTE4Nn0.09WBWLQMfo_rYhN9MO2fukbd-YLNZMghFf0dCdjs5Jc";

const EDITOR_EMAIL = "mihai@gis.local"; // must match the user you created

// ─── Session management ──────────────────────────────────────────────────────
let _session = JSON.parse(sessionStorage.getItem("srp-session") || "null");

function authHeaders() {
  const token = _session?.access_token ?? SUPABASE_KEY;
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function signIn(email, password) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error_description || err.msg || "Sign in failed");
  }
  _session = await resp.json();
  sessionStorage.setItem("srp-session", JSON.stringify(_session));
  return _session.user;
}

export function signOut() {
  _session = null;
  sessionStorage.removeItem("srp-session");
}

export function isSignedIn() {
  return _session !== null;
}

export function isEditor() {
  return _session?.user?.email === EDITOR_EMAIL;
}

export function getAccessMode() {
  if (!_session) return "pending";
  return isEditor() ? "rw" : "ro";
}

// ─── Supabase KV ─────────────────────────────────────────────────────────────
const supabase = {
  async get(key) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`, {
      headers: authHeaders()
    });
    const d = await r.json();
    return d?.[0] ?? null;
  },
  async set(key, value) {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: "POST",
      headers: { ...authHeaders(), "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value })
    });
  }
};

window.storage = {
  get: (key) => supabase.get(key),
  set: (key, value) => supabase.set(key, value),
};

// ─── Coordinate DB Headers ───────────────────────────────────────────────────
export const SB_URL = SUPABASE_URL;
export function getSbHeaders() { return authHeaders(); }
// Keep static export for backward compat but prefer getSbHeaders()
export const SB_HEADERS = new Proxy({}, { get(_, prop) { return authHeaders()[prop]; } });

// ─── Load/Save Helpers ───────────────────────────────────────────────────────
export async function storeLoad(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}

export async function storeSave(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch { }
}