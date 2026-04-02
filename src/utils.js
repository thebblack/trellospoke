import { SB_URL, SB_HEADERS } from "./storage.js";
import { VOCAB_FIELDS } from "./constants.js";

// ─── ID Generator ────────────────────────────────────────────────────────────
export const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ─── Coordinate Parsing ──────────────────────────────────────────────────────
export function parseCoords(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  if (/goo\.gl\/maps|maps\.app\.goo\.gl/i.test(s)) return "shortlink";

  let m;
  m = s.match(/[?&@](?:q|ll)=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i);
  if (m) return fmt(m[1], m[2]);
  m = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (m) return fmt(m[1], m[2]);

  m = s.match(/^(-?\d{1,3}\.\d+)[,\s]+(-?\d{1,3}\.\d+)$/);
  if (m) return fmt(m[1], m[2]);

  const dms = /(\d{1,3})[°d]\s*(\d{1,2})['′m]\s*([\d.]+)["″s]?\s*([NS])[,\s]+(\d{1,3})[°d]\s*(\d{1,2})['′m]\s*([\d.]+)["″s]?\s*([EW])/i;
  m = s.match(dms);
  if (m) {
    const lat = dmsToDecimal(+m[1], +m[2], +m[3], m[4]);
    const lng = dmsToDecimal(+m[5], +m[6], +m[7], m[8]);
    return fmt(lat, lng);
  }

  const dms2 = /(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([NS])[,\s]+(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([EW])/i;
  m = s.match(dms2);
  if (m) {
    const lat = dmsToDecimal(+m[1], +m[2], +m[3], m[4]);
    const lng = dmsToDecimal(+m[5], +m[6], +m[7], m[8]);
    return fmt(lat, lng);
  }

  return null;
}

function dmsToDecimal(deg, min, sec, dir) {
  const d = deg + min / 60 + sec / 3600;
  return (dir === "S" || dir === "W") ? -d : d;
}

export function fmt(lat, lng) {
  const la = parseFloat(lat), lo = parseFloat(lng);
  if (isNaN(la) || isNaN(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la.toFixed(6), lng: lo.toFixed(6) };
}

// ─── Shortlink Resolver ──────────────────────────────────────────────────────
export async function resolveShortLink(url) {
  try {
    const proxy = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
    const res   = await fetch(proxy, { method: "GET", redirect: "follow" });
    const html  = await res.text();
    const finalUrl = res.url ?? "";
    let coords = parseCoords(finalUrl);
    if (coords && coords !== "shortlink") return coords;
    const m = html.match(/@(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})/);
    if (m) return fmt(m[1], m[2]);
    const m2 = html.match(/"(-?\d{1,3}\.\d{5,})",\s*"(-?\d{1,3}\.\d{5,})"/);
    if (m2) return fmt(m2[1], m2[2]);
    return null;
  } catch {
    return null;
  }
}

// ─── Haversine Distance ──────────────────────────────────────────────────────
export function haversine(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLon = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ─── TSP Optimization ────────────────────────────────────────────────────────
export function tsp(items, pinStartId, pinFirstId, pinLastId, pinEndId) {
  if (items.length <= 1) return [...items];
  const pinStart = items.find(i => i.id === pinStartId);
  const pinFirst = items.find(i => i.id === pinFirstId);
  const pinLast  = items.find(i => i.id === pinLastId);
  const pinEnd   = items.find(i => i.id === pinEndId);
  let pool = items.filter(i => i.id !== pinStartId && i.id !== pinFirstId && i.id !== pinLastId && i.id !== pinEndId);

  let result = [];
  if (pinStart) result.push(pinStart);
  if (pinFirst) result.push(pinFirst);

  let current = result.length > 0 ? result[result.length - 1] : pool.shift();
  if (result.length === 0 && current) result.push(current);

  while (pool.length > 0) {
    if (!current?.coords?.lat) { result.push(...pool); break; }
    let best = null, bestD = Infinity;
    for (const j of pool) {
      if (!j.coords?.lat) continue;
      const d = haversine(current.coords, j.coords);
      if (d < bestD) { bestD = d; best = j; }
    }
    if (!best) { result.push(...pool); break; }
    pool = pool.filter(j => j.id !== best.id);
    result.push(best); current = best;
  }

  if (pinLast)  result.push(pinLast);
  if (pinEnd)   result.push(pinEnd);
  return result;
}

// ─── Coordinate DB Lookup ────────────────────────────────────────────────────
function extractNum(s) { const m = String(s || "").match(/(\d+)/); return m ? parseInt(m[1]) : null; }

export function normalizeStr(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export async function coordLookup(city, street, number) {
  try {
    const params = new URLSearchParams({
      city_norm:   `eq.${normalizeStr(city)}`,
      street_norm: `ilike.*${normalizeStr(street)}*`,
      select: "city,street,number,lat,lon",
    });
    const r = await fetch(`${SB_URL}/rest/v1/coordinates?${params}`, { headers: SB_HEADERS });
    const results = await r.json();
    if (!results?.length) return null;
    const num = extractNum(number);
    const par = num !== null ? num % 2 : null;
    let candidates = results.map(row => ({ row, n: extractNum(row.number) }));
    const sameParity = par !== null ? candidates.filter(c => c.n !== null && c.n % 2 === par) : [];
    const pool = sameParity.length ? sameParity : candidates;
    pool.sort((a, b) => Math.abs((a.n ?? 0) - (num ?? 0)) - Math.abs((b.n ?? 0) - (num ?? 0)));
    return pool[0].row;
  } catch { return null; }
}

export async function coordSave(city, street, number, lat, lon) {
  try {
    await fetch(`${SB_URL}/rest/v1/coordinates`, {
      method: "POST",
      headers: { ...SB_HEADERS, "Prefer": "resolution=ignore-duplicates" },
      body: JSON.stringify([{
        city, street, number,
        lat: parseFloat(lat), lon: parseFloat(lon),
        city_norm: normalizeStr(city), street_norm: normalizeStr(street),
      }]),
    });
  } catch { }
}

// ─── Vocabulary Merging ──────────────────────────────────────────────────────
export function mergeVocab(vocab, job) {
  const next = { ...vocab };
  for (const field of VOCAB_FIELDS) {
    const val = (job[field] ?? "").toString().trim();
    if (!val) continue;
    const existing = next[field] ?? [];
    if (!existing.includes(val)) next[field] = [val, ...existing].slice(0, 200);
  }
  return next;
}

export function mergeAddress(addrBook, job) {
  const name = (job.name ?? "").trim();
  const lat  = (job.coords?.lat ?? "").toString().trim();
  const lng  = (job.coords?.lng ?? "").toString().trim();
  if (!name || !lat || !lng) return addrBook;
  return { ...addrBook, [name.toLowerCase()]: { name, coords: { lat, lng } } };
}

// ─── GeoJSON Helpers ─────────────────────────────────────────────────────────
export function coordsFromFeature(feature) {
  const geom = feature.geometry;
  if (!geom) return null;
  let coords = null;
  if (geom.type === "Point") coords = geom.coordinates;
  else if (geom.type === "MultiPoint") coords = geom.coordinates[0];
  else if (geom.type === "LineString") coords = geom.coordinates[0];
  else if (geom.type === "MultiLineString") coords = geom.coordinates[0][0];
  else if (geom.type === "Polygon") coords = geom.coordinates[0][0];
  else if (geom.type === "MultiPolygon") coords = geom.coordinates[0][0][0];
  if (!coords) return null;
  const [lng, lat] = coords;
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat: lat.toFixed(6), lng: lng.toFixed(6) };
}

// ─── Google Maps URL Builder ─────────────────────────────────────────────────
export function buildGoogleMapsUrl(stops) {
  const waypoints = stops.map(s => {
    if (s.coords?.lat && s.coords?.lng) return `${s.coords.lat},${s.coords.lng}`;
    return encodeURIComponent([s.address, s.city].filter(Boolean).join(", "));
  });
  if (waypoints.length === 0) return null;
  if (waypoints.length === 1) return `https://www.google.com/maps/search/?api=1&query=${waypoints[0]}`;
  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(1, -1).slice(0, 8);
  const allStops = [origin, ...middle, destination];
  return `https://www.google.com/maps/dir/${allStops.join("/")}`;
}
