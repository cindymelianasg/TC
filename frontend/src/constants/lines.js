import { Factory, Zap, Paintbrush, Droplets, Armchair, Wrench } from "lucide-react";

// Assembling & Final Inspection are ONE combined area per spec.
// We keep 6 line entries; "ASSEMBLING & FI" replaces both old keys.
export const LINE_AREAS = [
  { key: "PRESSING", slug: "pressing", label: "Pressing Line", icon: Factory, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "WELDING", slug: "welding", label: "Welding Line", icon: Zap, color: "text-slate-700", bg: "bg-slate-100" },
  { key: "PAINTING", slug: "painting", label: "Painting Line", icon: Paintbrush, color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "INJECTION", slug: "injection", label: "Injection Line", icon: Droplets, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "SEAT", slug: "seat", label: "Seat Line", icon: Armchair, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ASSEMBLING & FI", slug: "assembling", label: "Assembling & Final Inspection", icon: Wrench, color: "text-sky-600", bg: "bg-sky-50" },
];

export function lineFromSlug(slug) {
  // Backwards compat: 'final-inspection' maps to assembling
  if (slug === "final-inspection") return LINE_AREAS.find((l) => l.key === "ASSEMBLING & FI");
  if (slug === "assembling") return LINE_AREAS.find((l) => l.key === "ASSEMBLING & FI");
  return LINE_AREAS.find((l) => l.slug === slug);
}

export function lineFromKey(key) {
  const k = (key || "").toUpperCase();
  if (k === "ASSEMBLING" || k === "FINAL INSPECTION") return LINE_AREAS.find((l) => l.key === "ASSEMBLING & FI");
  return LINE_AREAS.find((l) => l.key === k);
}

export const STATUS_LIST = ["REQUEST", "PENAWARAN", "NEGO", "AFA PROCESS", "PO PROCESS", "DATANG"];

export const STATUS_STYLES = {
  REQUEST: "bg-slate-100 text-slate-700 border-slate-200",
  PENAWARAN: "bg-sky-100 text-sky-700 border-sky-200",
  NEGO: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "AFA PROCESS": "bg-orange-100 text-orange-700 border-orange-200",
  "PO PROCESS": "bg-blue-100 text-blue-700 border-blue-200",
  DATANG: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const RANK_OPTIONS = ["SEC.HEAD", "SUPERVISOR", "SENIOR FOREMAN", "FOREMAN", "PELAKSANA"];

// Stock action displayed labels per spec
export const STOCK_ACTION_STYLES = {
  AMAN: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "LOW STOCK": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "ORDER SEKARANG!!!": "bg-red-100 text-red-700 border-red-200",
  "CHECK SUBSTITUTE": "bg-amber-100 text-amber-800 border-amber-200",
  MONITOR: "bg-slate-100 text-slate-700 border-slate-200",
  "NEED UPDATE": "bg-slate-100 text-slate-500 border-slate-200",
};
