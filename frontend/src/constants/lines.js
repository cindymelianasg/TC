import { Factory, Zap, Paintbrush, Droplets, Armchair, Wrench, CarFront } from "lucide-react";

export const LINE_AREAS = [
  { key: "PRESSING", slug: "pressing", label: "Pressing Line", icon: Factory, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "WELDING", slug: "welding", label: "Welding Line", icon: Zap, color: "text-slate-700", bg: "bg-slate-100" },
  { key: "PAINTING", slug: "painting", label: "Painting Line", icon: Paintbrush, color: "text-emerald-600", bg: "bg-emerald-50" },
  { key: "INJECTION", slug: "injection", label: "Injection Line", icon: Droplets, color: "text-violet-600", bg: "bg-violet-50" },
  { key: "SEAT", slug: "seat", label: "Seat Line", icon: Armchair, color: "text-orange-600", bg: "bg-orange-50" },
  { key: "ASSEMBLING", slug: "assembling", label: "Assembling Line", icon: Wrench, color: "text-sky-600", bg: "bg-sky-50" },
  { key: "FINAL INSPECTION", slug: "final-inspection", label: "Final Inspection", icon: CarFront, color: "text-blue-600", bg: "bg-blue-50" },
];

export function lineFromSlug(slug) {
  return LINE_AREAS.find((l) => l.slug === slug);
}

export function lineFromKey(key) {
  return LINE_AREAS.find((l) => l.key === (key || "").toUpperCase());
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
