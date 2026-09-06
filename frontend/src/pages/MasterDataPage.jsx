import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Upload, Search, Pencil, Trash2, ArrowUpToLine, History, AlertTriangle, RotateCcw, ChevronDown } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS, VALID_LINE_KEYS } from "@/constants/lines";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import LocationDetailModal from "@/components/LocationDetailModal";

const PAGE_SIZE_OPTIONS = [20, 40, 80, 100];

const LEVEL_STYLES = {
  Critical: "bg-red-50 text-red-700 border-red-200",
  Substitusi: "bg-amber-50 text-amber-700 border-amber-200",
  Stock: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// status label that backend produces via `action`
const STOCK_STATUS_STYLES = {
  "GOOD": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "MIN": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "ZERO": "bg-red-100 text-red-700 border-red-200",
};

const STATUS_FILTER_OPTIONS = [
  { value: "SEMUA", label: "Semua" },
  { value: "GOOD", label: "GOOD" },
  { value: "MIN", label: "MIN" },
  { value: "ZERO", label: "ZERO" },
];

function matchStatusFilter(stockStatus, filter) {
  if (filter === "SEMUA") return true;
  return stockStatus === filter;
}

export default function MasterDataPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isCreator = user?.role === "creator";
  const [searchParams, setSearchParams] = useSearchParams();
  const [line, setLine] = useState("SEMUA");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "SEMUA");
  const [reffQ, setReffQ] = useState("");
  const [partNameQ, setPartNameQ] = useState("");
  const [typeQ, setTypeQ] = useState("");
  const [makerQ, setMakerQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [prefilledNew, setPrefilledNew] = useState(null);
  const [outOpen, setOutOpen] = useState(false);
  const [outPart, setOutPart] = useState(null);
  const [locModal, setLocModal] = useState({ open: false, part: null });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLineTarget, setResetLineTarget] = useState("ALL"); // 'ALL' or a specific line
  const [resetMenuOpen, setResetMenuOpen] = useState(false);
  const [invalidLines, setInvalidLines] = useState({ count: 0, samples: [] });

  // Fetch invalid line/area count for migration banner
  const fetchInvalidLines = useCallback(async () => {
    try {
      const { data } = await api.get("/master-parts-admin/invalid-lines");
      setInvalidLines(data);
    } catch { /* non-blocking */ }
  }, []);
  useEffect(() => { fetchInvalidLines(); }, [fetchInvalidLines]);

  // Auto-open Add dialog if redirected from Request Form
  useEffect(() => {
    if (searchParams.get("add") === "1" && isCreator) {
      setPrefilledNew({
        part_name: searchParams.get("name") || "",
        type: searchParams.get("type") || "",
        maker: searchParams.get("maker") || "",
        line_area: searchParams.get("line") || "ASSEMBLING & FI",
        level_part: searchParams.get("level") || "Stock",
        current_stock: "",
        minimum_stock: 0,
        location: "",
        reff: "",
      });
      setEditPart(null);
      setEditOpen(true);
      // Strip query to avoid re-opening on refresh
      const next = new URLSearchParams(searchParams);
      next.delete("add"); next.delete("name"); next.delete("type"); next.delete("maker"); next.delete("line"); next.delete("level");
      setSearchParams(next, { replace: true });
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // We over-fetch when status filter is client-side (LOW/AMAN/etc) since backend currently uses
      // legacy stock_status names. Simplest: rely on backend pagination but skip status filter param.
    const params = {
     page,
     page_size: pageSize,
    };

    if (line !== "SEMUA") {
      params.line = line;
     }

    if (statusFilter !== "SEMUA") {
    params.status = statusFilter;
   }

   if (reffQ) {
     params.reff = reffQ;
    }

    if (partNameQ) {
      params.q = partNameQ;
    }

   if (!partNameQ && (typeQ || makerQ)) {
     params.q = typeQ || makerQ;
   }
      // Type / Maker handled via combined q if name not present
      if (!partNameQ && (typeQ || makerQ)) params.q = typeQ || makerQ;
const { data } = await api.get("/master-parts", { params });

setData({
  items: data.items || [],
  total: data.total || 0,
});   
    } finally {
      setLoading(false);
    }
  }, [line, statusFilter, reffQ, partNameQ, typeQ, makerQ, page, pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [line, statusFilter, partNameQ, typeQ, makerQ, pageSize]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));

  const onDelete = async (m) => {
    if (!window.confirm(`Hapus "${m.part_name}"? Semua riwayat IN/OUT akan ikut terhapus.`)) return;
    try {
      await api.delete(`/master-parts/${m.id}`);
      toast.success("Master part dihapus");
      fetchData();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  const doReset = async () => {
    try {
      const url = resetLineTarget === "ALL"
        ? "/master-parts-admin/reset-all"
        : `/master-parts-admin/reset-line/${encodeURIComponent(resetLineTarget)}`;
      const { data } = await api.delete(url);
      const label = resetLineTarget === "ALL" ? "semua Master Data" : `Master Data ${resetLineTarget}`;
      toast.success(`Reset ${label} selesai: ${data.deleted_master_parts} part & ${data.deleted_movements} movement dihapus`);
      setResetOpen(false);
      setInvalidLines({ count: 0, samples: [] });
      fetchData();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal reset");
    }
  };

  const openResetDialog = (target) => {
    setResetLineTarget(target);
    setResetMenuOpen(false);
    setResetOpen(true);
  };


  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Data Spare Part</h1>
          <p className="text-sm text-slate-500">Klasifikasi part & monitoring stock per line.</p>
        </div>
        <div className="flex items-center gap-2">
          {isCreator && (
            <>
              <button onClick={() => nav("/master/import")} className="border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="master-import-btn">
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={() => { setEditPart(null); setEditOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="master-add-btn">
                <Plus className="w-4 h-4" /> Tambah Part
              </button>
              <div className="relative">
                <button onClick={() => setResetMenuOpen((v) => !v)}
                  className="border border-red-200 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5"
                  data-testid="master-reset-menu-btn">
                  <RotateCcw className="w-4 h-4" /> Reset <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {resetMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-20 min-w-[220px]" data-testid="master-reset-menu">
                    <button onClick={() => openResetDialog("ALL")}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 hover:text-red-700 border-b border-slate-100" data-testid="master-reset-all-item">
                      <div className="font-semibold">Reset All Master Data</div>
                      <div className="text-[11px] text-slate-500">Hapus semua part & movements</div>
                    </button>
                    {LINE_AREAS.map((l) => (
                      <button key={l.key} onClick={() => openResetDialog(l.key)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 hover:text-red-700 border-b border-slate-100 last:border-0" data-testid={`master-reset-line-item-${l.slug}`}>
                        <div className="font-medium">Reset per Line: {l.key}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {invalidLines.count > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3" data-testid="master-invalid-banner">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-amber-800">Invalid Line/Area data detected. Please migrate or reset Master Data.</div>
            <div className="text-xs text-amber-700 mt-1">
              Ditemukan <strong>{invalidLines.count}</strong> part dengan Line/Area yang tidak valid (contoh: ASSEMBLING, FI, Final Inspection). Valid: {VALID_LINE_KEYS.join(", ")}.
            </div>
            {invalidLines.samples?.length > 0 && (
              <div className="text-xs text-amber-700 mt-1">
                Contoh part: {invalidLines.samples.slice(0, 5).map((m) => `"${m.part_name}" (${m.line_area})`).join(", ")}
                {invalidLines.samples.length > 5 ? "..." : ""}
              </div>
            )}
            {isCreator && (
              <button onClick={() => openResetDialog("ALL")} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 underline hover:text-amber-900" data-testid="master-invalid-reset-link">
                Reset Master Data sekarang →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <SearchField label="No. Reff" value={reffQ} onChange={setReffQ} placeholder="Cari no.reff…" testId="master-q-reff" />
          <SearchField label="Name Part" value={partNameQ} onChange={setPartNameQ} placeholder="Cari nama…" testId="master-q-name" />
          <SearchField label="Type" value={typeQ} onChange={setTypeQ} placeholder="Cari type…" testId="master-q-type" />
          <SearchField label="Maker" value={makerQ} onChange={setMakerQ} placeholder="Cari maker…" testId="master-q-maker" />
          <SelectFilter label="Line / Area" value={line} onChange={setLine} testId="master-filter-line">
            <option value="SEMUA">Semua</option>
            {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
          </SelectFilter>

          <SelectFilter label="Stock Status" value={statusFilter} onChange={setStatusFilter} testId="master-filter-status">
            {STATUS_FILTER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectFilter>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="master-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                 <th className="px-3 py-3 text-left font-medium">No</th>
                 <th className="px-3 py-3 text-left font-medium">No. Reff</th>
                 <th className="px-3 py-3 text-left font-medium">Name Part</th>
                 <th className="px-3 py-3 text-left font-medium">Type</th>
                 <th className="px-3 py-3 text-left font-medium">Maker</th>
                 <th className="px-3 py-3 text-left font-medium">UOM</th>
                 <th className="px-3 py-3 text-left font-medium">Min</th>
                 <th className="px-3 py-3 text-left font-medium">Max</th>
                 <th className="px-3 py-3 text-left font-medium">Current Stock</th>
                 <th className="px-3 py-3 text-left font-medium">Line / Area</th>
                 <th className="px-3 py-3 text-left font-medium">Location</th>
                 <th className="px-3 py-3 text-left font-medium">Part Condition</th>
                 <th className="px-3 py-3 text-right font-medium">Aksi</th>
                </tr>
              </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="text-center py-10 text-slate-400">Memuat...</td></tr>}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={13} className="text-center py-10 text-slate-400">Tidak ada data sesuai filter.</td></tr>
              )}
              {!loading && data.items.map((m, i) => {
                return (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`master-row-${i}`}>
                    <td className="px-3 py-3 text-slate-700">{(page - 1) * pageSize + i + 1}</td>
                    <td className="px-3 py-3 text-slate-600 font-mono text-xs">{m.reff || "-"}</td>
                    <td className="px-3 py-3 text-slate-900 font-medium max-w-[260px]">
                      <div className="truncate">{m.part_name}</div>
                    </td>
                    <td className="px-3 py-3 text-slate-700 max-w-[200px] truncate">{m.type || "-"}</td>
                    <td className="px-3 py-3 text-slate-700 max-w-[160px] truncate">{m.maker || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{m.uom || "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{m.minimum_stock ?? "-"}</td>
                    <td className="px-3 py-3 text-slate-700">{m.maximum_stock ?? "-"}</td>
                    <td className={`px-3 py-3 font-semibold tabular-nums ${m.current_stock === null ? "text-slate-400" : m.current_stock === 0 ? "text-red-600" : "text-slate-900"}`}>
                      {m.current_stock === null ? "—" : m.current_stock}
                    </td>
                    <td className="px-3 py-3 text-slate-700">{m.line_area}</td>
                    <td className="px-3 py-3">
                      {m.location ? (
                        <button
                          onClick={() => setLocModal({ open: true, part: m })}
                          className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline"
                          data-testid={`master-loc-${i}`}
                        >
                          {m.location}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`status-pill ${
                          STOCK_STATUS_STYLES[m.stock_status] ||
                          "bg-slate-100 text-slate-600 border-slate-200"
                        }`}
                        data-testid={`master-status-${i}`}
                      >
                        {m.stock_status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setOutPart(m); setOutOpen(true); }} title="OUT" className="p-1.5 rounded hover:bg-slate-100 text-slate-600" data-testid={`master-out-${i}`}>
                          <ArrowUpToLine className="w-4 h-4" />
                        </button>
                        <button onClick={() => nav(`/master/${m.id}/movements`)} title="Riwayat" className="p-1.5 rounded hover:bg-slate-100 text-slate-600" data-testid={`master-history-${i}`}>
                          <History className="w-4 h-4" />
                        </button>
                        {isCreator && (
                          <>
                            <button onClick={() => { setEditPart(m); setEditOpen(true); }} title="Edit" className="p-1.5 rounded hover:bg-slate-100 text-slate-600" data-testid={`master-edit-${i}`}>
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => onDelete(m)} title="Hapus" className="p-1.5 rounded hover:bg-red-50 text-red-600" data-testid={`master-delete-${i}`}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 text-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <span>Total: <strong className="text-slate-700">{data.total}</strong> part</span>
            <div className="flex items-center gap-1">
              <span className="text-xs">Rows:</span>
              <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value))} className="rounded-md border border-slate-300 px-2 py-1 text-xs bg-white" data-testid="master-page-size">
                {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page <= 1} className="px-2 py-1 rounded-md border border-slate-200 disabled:opacity-40 text-xs" data-testid="master-page-first">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40" data-testid="master-page-prev">‹</button>
            <span className="px-3 py-1 rounded-md bg-blue-600 text-white font-semibold tabular-nums">{page}</span>
            <span className="text-slate-400 tabular-nums">/ {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded-md border border-slate-200 disabled:opacity-40" data-testid="master-page-next">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1 rounded-md border border-slate-200 disabled:opacity-40 text-xs" data-testid="master-page-last">»</button>
          </div>
        </div>
      </div>

      <EditDialog open={editOpen} onClose={() => { setEditOpen(false); setPrefilledNew(null); }} part={editPart} prefill={prefilledNew} onSaved={() => { setEditOpen(false); setPrefilledNew(null); fetchData(); }} />
      <OutDialog open={outOpen} onClose={() => setOutOpen(false)} part={outPart} onSaved={() => { setOutOpen(false); fetchData(); }} />
      <ResetDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={doReset} />
    </AppShell>
  );
}

function ResetDialog({ open, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setConfirmText(""); }, [open]);
  const ready = confirmText.trim().toUpperCase() === "RESET";
  const handle = async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="reset-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" /> Reset Master Data
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-700 space-y-3">
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
            <p className="font-semibold">All Master Data records will be deleted. This action cannot be undone.</p>
            <p className="text-xs mt-1">Termasuk seluruh histori IN/OUT movement. Setelah reset, lakukan Import Excel ulang dengan Line/Area yang valid.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Ketik &quot;RESET&quot; untuk konfirmasi</label>
            <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              placeholder="RESET" data-testid="reset-confirm-input" />
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm" data-testid="reset-cancel">Cancel</button>
          <button onClick={handle} disabled={!ready || busy}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
            data-testid="reset-confirm">
            {busy ? "Menghapus..." : "Confirm Reset"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SearchField({ label, value, onChange, placeholder, testId }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">{label}</label>
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          data-testid={testId}
          className="w-full rounded-lg border border-slate-300 pl-8 pr-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    </div>
  );
}

function SelectFilter({ label, value, onChange, children, testId }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1 block">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500" data-testid={testId}>
        {children}
      </select>
    </div>
  );
}

function EditDialog({ open, onClose, part, prefill, onSaved }) {
  const isEdit = !!part;
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

useEffect(() => {
  if (part) {
    // IMPORTANT: never silently replace invalid legacy line_area. Preserve raw value
    // so UI can warn the Creator instead of defaulting to PRESSING.
    setForm({
      reff: part.reff || "",
      part_name: part.part_name || "",
      type: part.type || "",
      maker: part.maker || "",
      uom: part.uom || "",
      line_area: part.line_area || "",
      current_stock: part.current_stock ?? "",
      minimum_stock: part.minimum_stock ?? 0,
      location: part.location || "",
      maximum_stock: part.maximum_stock ?? 0,
    });
  } else if (prefill) {
    setForm({
      reff: prefill.reff || "",
      part_name: prefill.part_name || "",
      type: prefill.type || "",
      maker: prefill.maker || "",
      uom: prefill.uom || "",
      line_area: prefill.line_area || "ASSEMBLING & FI",
      current_stock: prefill.current_stock ?? "",
      minimum_stock: prefill.minimum_stock ?? 0,
      location: prefill.location || "",
      maximum_stock: prefill.maximum_stock ?? 0,
    });
  } else {
    setForm({
      reff: "",
      part_name: "",
      type: "",
      maker: "",
      uom: "",
      line_area: "ASSEMBLING & FI",
      current_stock: "",
      minimum_stock: 0,
      location: "",
      maximum_stock: 0,
    });
  }
}, [part, prefill, open]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const lineInvalid = form.line_area && !VALID_LINE_KEYS.includes(form.line_area);

  const save = async () => {
    if (!form.part_name || !form.line_area) { toast.error("Part Name & Line wajib"); return; }
    if (!VALID_LINE_KEYS.includes(form.line_area)) {
      toast.error(`Line/Area "${form.line_area}" tidak valid. Pilih: ${VALID_LINE_KEYS.join(", ")}`);
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form };
      payload.current_stock = payload.current_stock === "" ? null : parseInt(payload.current_stock, 10);
      payload.minimum_stock = parseInt(payload.minimum_stock || 0, 10);
      if (isEdit) await api.put(`/master-parts/${part.id}`, payload);
      else await api.post(`/master-parts`, payload);
      toast.success("Tersimpan");
      onSaved();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl" data-testid="master-edit-dialog">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Master Part" : "Tambah Master Part"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="No. Reff"
            value={form.reff}
            onChange={(v) => upd("reff", v)}
            testId="me-reff"
          />
          <Input
            label="Part Name *"
            value={form.part_name}
            onChange={(v) => upd("part_name", v)}
            testId="me-name"
          />
          <Input
            label="Type"
            value={form.type}
            onChange={(v) => upd("type", v)}
            testId="me-type"
          />
          <Input
            label="Maker"
            value={form.maker}
            onChange={(v) => upd("maker", v)}
            testId="me-maker"
          />
          <Input
            label="UOM"
            value={form.uom}
            onChange={(v) => upd("uom", v)}
            testId="me-uom"
          />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Line / Area *
            </label>
            <select
              value={form.line_area}
              onChange={(e) => upd("line_area", e.target.value)}
              data-testid="me-line"
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-white ${
                lineInvalid
                ? "border-amber-400 bg-amber-50"
                : "border-slate-300"
              }`}
            >
              {lineInvalid && (
                <option value={form.line_area}>
                  ⚠ {form.line_area} (invalid — pilih nilai valid)
                </option>
              )}

              {!form.line_area && (
                <option value="">-- Pilih Line --</option>
              )}

              {LINE_AREAS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.key}
                </option>
              ))}
            </select>

              {lineInvalid && (
                <div className="mt-1 text-xs text-amber-700">
                  Invalid Line/Area: <strong>{form.line_area}</strong>.
                  Pilih salah satu Line/Area valid sebelum menyimpan.
                </div>
              )}
            </div>
            <Input
              label="Current Stock"
              type="number"
              value={form.current_stock}
              onChange={(v) => upd("current_stock", v)}
              testId="me-stock"
            />
            <Input
              label="Minimum Stock"
              type="number"
              value={form.minimum_stock}
              onChange={(v) => upd("minimum_stock", v)}
              testId="me-min"
            />
            <Input
              label="Location"
              value={form.location}
              onChange={(v) => upd("location", v)}
              testId="me-location"
            />
            <Input
              label="Maximum Stock"
              type="number"
              value={form.maximum_stock}
              onChange={(v) => upd("maximum_stock", v)}
              testId="me-max"
            />        
            </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Batal</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" data-testid="me-save">{busy ? "..." : "Simpan"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OutDialog({ open, onClose, part, onSaved }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), quantity: 1, note: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ date: new Date().toISOString().slice(0, 10), quantity: 1, note: "" }); }, [part, open]);
  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/movements/out`, { master_part_id: part.id, date: form.date, quantity: parseInt(form.quantity, 10), note: form.note });
      toast.success(`OUT -${form.quantity} berhasil`);
      onSaved();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };
  if (!part) return null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="out-dialog">
        <DialogHeader><DialogTitle>OUT Movement</DialogTitle></DialogHeader>
        <div className="text-sm bg-slate-50 rounded-lg p-3 mb-2">
          <div className="font-medium text-slate-900">{part.part_name}</div>
          <div className="text-xs text-slate-500">{part.line_area} · Stock saat ini: <strong>{part.current_stock ?? "—"}</strong></div>
        </div>
        <Input label="Tanggal" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} testId="out-date" />
        <Input label="Qty OUT" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} testId="out-qty" />
        <Input label="Catatan" value={form.note} onChange={(v) => setForm({ ...form, note: v })} testId="out-note" />
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Batal</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" data-testid="out-save">{busy ? "..." : "Simpan OUT"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Input({ label, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
