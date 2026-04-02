const SUPABASE_URL = "https://kmfprxbfafbquilgchtv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttZnByeGJmYWZicXVpbGdjaHR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3ODUxODYsImV4cCI6MjA4ODM2MTE4Nn0.09WBWLQMfo_rYhN9MO2fukbd-YLNZMghFf0dCdjs5Jc";

const supabase = {
  async get(key) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?key=eq.${encodeURIComponent(key)}&select=value`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const d = await r.json();
    return d?.[0] ?? null;
  },
  async set(key, value) {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates" },
      body: JSON.stringify({ key, value })
    });
  }
};

// Expose globally for persistent artifact storage
window.storage = {
  get: (key) => supabase.get(key),
  set: (key, value) => supabase.set(key, value),
};

// ─── Coordinate DB Headers ───────────────────────────────────────────────────
export const SB_URL = SUPABASE_URL;
export const SB_HEADERS = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

// ─── Load/Save Helpers ───────────────────────────────────────────────────────
export async function storeLoad(key) {
  try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : null; } catch { return null; }
}

export async function storeSave(key, val) {
  try { await window.storage.set(key, JSON.stringify(val)); } catch { }
}
