/**
 * Date/time formatting helpers for SMART-TC.
 * Always formats in WIB (Asia/Jakarta) with Indonesian month names.
 */

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Format ISO datetime to "26 Juni 2026 • 06:39 WIB"
 */
export function formatDateTimeWIB(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
      timeZone: "Asia/Jakarta",
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = parseInt(get("day"), 10);
    const monthIdx = parseInt(get("month"), 10) - 1;
    const year = get("year");
    const hh = get("hour");
    const mm = get("minute");
    return `${day} ${MONTHS_ID[monthIdx]} ${year} · ${hh}:${mm} WIB`;
  } catch {
    return d.toString();
  }
}

/**
 * Format ISO date string (YYYY-MM-DD) to "26 Juni 2026"
 */
export function formatDateID(d) {
  if (!d) return "—";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) {
    const [y, m, day] = d.slice(0, 10).split("-");
    return `${parseInt(day, 10)} ${MONTHS_ID[parseInt(m, 10) - 1]} ${y}`;
  }
  return String(d);
}
