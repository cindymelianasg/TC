import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, MapPin, AlertTriangle, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

/**
 * Popup DETAIL LOKASI PART berdasarkan SOP Suzuki OPL PENOMORAN RAK GUDANG.
 * Format kode 9-karakter: [XX Gudang][XX Rak][XX Tingkat][L|R Sisi][XX Urutan]
 * Contoh 300105L05 → Painting Body / Rak 1 / Tingkat 5 / Kiri / Urutan 5
 */
export default function LocationDetailModal({ open, part, onClose }) {
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !part?.location) { setParsed(null); return; }
    // Prefer server parse for consistency; graceful fallback to null
    setLoading(true);
    api.get("/master-parts-admin/parse-location", { params: { code: part.location } })
      .then((r) => setParsed(r.data))
      .catch(() => setParsed({ raw: part.location, valid: false, reason: "Gagal parse di server" }))
      .finally(() => setLoading(false));
  }, [open, part]);

  const handleCopy = async () => {
    if (!part?.location) return;
    try {
      await navigator.clipboard.writeText(part.location);
      setCopied(true);
      toast.success("Kode lokasi berhasil disalin.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  };

  if (!part) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="location-detail-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" /> DETAIL LOKASI PART
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <Row label="Nama Part" value={part.part_name} />

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Kode Lokasi</div>
            <div className="font-mono text-lg font-bold text-slate-900 tabular-nums tracking-wider" data-testid="loc-detail-code">
              {part.location || "—"}
            </div>
          </div>

          {loading && <div className="text-center text-slate-400 text-xs py-4">Mengurai kode...</div>}

          {parsed && !parsed.valid && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs" data-testid="loc-detail-invalid">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">Format tidak valid</div>
                <div>{parsed.reason || "Kode lokasi harus 9 karakter sesuai SOP Suzuki."}</div>
              </div>
            </div>
          )}

          {parsed?.valid && (
            <div className="space-y-2" data-testid="loc-detail-parsed">
              <ParsedRow label="Gudang" code={parsed.gudang.code} value={parsed.gudang.name} />
              <ParsedRow label="Nomor Rak" code={parsed.rak.code} value={parsed.rak.label} />
              <ParsedRow label="Susunan / Tingkat Rak" code={parsed.tingkat.code} value={parsed.tingkat.label} />
              <ParsedRow label="Sisi Rak" code={parsed.sisi.code} value={parsed.sisi.label} />
              <ParsedRow label="Urutan Posisi Part" code={parsed.urutan.code} value={parsed.urutan.label} />
            </div>
          )}

          <button onClick={handleCopy}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            data-testid="loc-detail-copy">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Tersalin" : "Salin Kode Lokasi"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 font-medium">{value || "-"}</div>
    </div>
  );
}

function ParsedRow({ label, code, value }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <div className="flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm text-slate-900">{value}</div>
      </div>
      <div className="font-mono text-xs text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">{code}</div>
    </div>
  );
}
