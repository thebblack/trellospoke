import { MapPin, Building2, Navigation, RotateCw } from "lucide-react";

// ─── Design Tokens ───────────────────────────────────────────────────────────
export const C = {
  bg: "#0d1117", surface: "#161b22", surfaceHigh: "#21262d",
  border: "#30363d", accent: "#f97316", accentLow: "rgba(249,115,22,0.13)",
  green: "#22c55e", greenLow: "rgba(34,197,94,0.11)",
  blue: "#3b82f6", blueLow: "rgba(59,130,246,0.13)",
  text: "#e6edf3", muted: "#8b949e", red: "#f85149",
};

// ─── Job Completion Fields ───────────────────────────────────────────────────
export const COMPLETION_FIELDS = [
  { key: "added",      label: "Added" },
  { key: "fieldWork",  label: "Field work" },
  { key: "officeWork", label: "Office work" },
  { key: "sent",       label: "Sent" },
  { key: "invoice",    label: "Invoice" },
  { key: "payment",    label: "Payment" },
];

// ─── Vocabulary Fields ───────────────────────────────────────────────────────
export const VOCAB_FIELDS = ["surveyType", "company", "city", "diameter", "branchDiameter", "volume"];

export const APP_VOCAB_FIELDS = [
  { key: "surveyType",     label: "Survey type" },
  { key: "company",        label: "Company" },
  { key: "city",           label: "City" },
  { key: "diameter",       label: "Diameter" },
  { key: "branchDiameter", label: "Branch diameter" },
  { key: "volume",         label: "Volume" },
];

// ─── Tab Configuration ───────────────────────────────────────────────────────
export const TABS = [
  { id: "jobs",    label: "Jobs",   Icon: MapPin },
  { id: "places",  label: "Places", Icon: Building2 },
  { id: "routing", label: "Route",  Icon: Navigation },
  { id: "sync",    label: "Sync",   Icon: RotateCw },
];

// ─── Empty Templates ─────────────────────────────────────────────────────────
export const EMPTY_JOB = {
  name: "", city: "", street: "", number: "", company: "", surveyType: "",
  diameter: "", approxLength: "", branchDiameter: "", volume: "",
  coords: { lat: "", lng: "" }, completion: {},
};

export const EMPTY_PLACE = { name: "", address: "", city: "", coords: { lat: "", lng: "" } };
