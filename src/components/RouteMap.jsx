import { useEffect, useRef } from "react";
import { C } from "../constants.js";

export function RouteMap({ stops }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; }

    const validStops = stops.filter(s => s.coords?.lat && s.coords?.lng);
    if (validStops.length === 0) return;

    const map = window.L.map(mapRef.current, { zoomControl: true });
    instanceRef.current = map;

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const latlngs = [];
    validStops.forEach((stop, i) => {
      const lat = parseFloat(stop.coords.lat), lng = parseFloat(stop.coords.lng);
      latlngs.push([lat, lng]);
      const color = stop._type === "place" ? "#3b82f6" : "#f97316";
      const marker = window.L.circleMarker([lat, lng], {
        radius: 10, fillColor: color, color: "#fff",
        weight: 2, fillOpacity: 1
      }).addTo(map);
      marker.bindPopup(`<b>${i + 1}. ${stop.name || stop.address || "Stop"}</b>`);
    });

    if (latlngs.length > 1) {
      window.L.polyline(latlngs, { color: "#f97316", weight: 3, opacity: 0.7, dashArray: "6,6" }).addTo(map);
    }

    const bounds = window.L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [24, 24] });

    return () => { if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null; } };
  }, [stops]);

  return (
    <div ref={mapRef} style={{ width: "100%", height: 280, borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }} />
  );
}
