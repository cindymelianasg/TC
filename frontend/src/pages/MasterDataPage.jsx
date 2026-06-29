import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Upload, Search, Pencil, Trash2, ArrowDownToLine, AlertTriangle, AlertOctagon, History } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const STATUSES = ["OK", "BELOW MIN", "NO STOCK", "NEED UPDATE"];
const LEVELS = ["Critical", "Substitusi", "Stock"];

const STATUS_STYLES = {
  OK: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "BELOW MIN": "bg-orange-100 text-orange-700 border-orange-200",
  "NO STOCK": "bg-red-100 text-red-700 border-red-200",
  "NEED UPDATE": "bg-slate-100 text-slate-700 border-slate-200",
};

const LEVEL_STYLES = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  Substitusi: "bg-amber-100 text-amber-800 border-amber-200",
  Stock: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function MasterDataPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isCreator = user?.role === "creator";
  const [line, setLine] = useState("SEMUA");
  const [levelPart, setLevelPart] = useState("SEMUA");
  const [status, setStatus] = useState("SEMUA");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editPart, setEditPart] = useState(null);
  const [outOpen, setOutOpen] = useState(false);
  const [outPart, setOutPart] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (line !== "SEMUA") params.line = line;
      if (levelPart !== "SEMUA") params.level_part = levelPart;
      if (status !== "SEMUA") params.status = status;
      if (q) params.q = q;
      const { data } = await api.get("/master-parts", { params });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [line, levelPart, status, q, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));

  const onDelete = async (m) => {
    if (!window.confirm(`Hapus "${m.part_name}"?`)) return;
    try {
      await api.delete(`/master-parts/${m.id}`);
      toast.success("Master part dihapus");
      fetchData();
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Master Data Spare Part</h1>
          <p className="text-sm text-slate-500">Monitoring stock & klasifikasi part per line.</p>
        </div>
        <div className="flex items-center gap-2">
          {isCreator && (
            <>
              <button onClick={() => nav("/master/import")} className="border border-blue-200 text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="master-import-btn">
                <Upload className="w-4 h-4" /> Import Excel
              </button>
              <button onClick={() => { setEditPart(null); setEditOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="master-add-btn">
                <Plus className="w-4 h-4" /> Tambah
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Line / Area</label>
            <select value={line} onChange={(e) => { setPage(1); setLine(e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="master-filter-line">
              <option value="SEMUA">Semua</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Level</label>
            <select value={levelPart} onChange={(e) => { setPage(1); setLevelPart(e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="master-filter-level">
              <option value="SEMUA">Semua</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Stock Status</label>
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="master-filter-status">
              <option value="SEMUA">Semua</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchData(); }} className="relative col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Cari</label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-[34px]" />
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Part name, type, maker, reff..." data-testid="master-filter-search"
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white" />
          </form>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="master-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left font-medium">No</th>
                <th className="px-3 py-3 text-left font-medium">Part Name</th>
                <th className="px-3 py-3 text-left font-medium">Type</th>
                <th className="px-3 py-3 text-left font-medium">Maker</th>
                <th className="px-3 py-3 text-left font-medium">Line / Area</th>
                <th className="px-3 py-3 text-left font-medium">Stock</th>
                <th className="px-3 py-3 text-left font-medium">Min</th>
                <th className="px-3 py-3 text-left font-medium">Level</th>
                <th className="px-3 py-3 text-left font-medium">Stock Status</th>
                <th className="px-3 py-3 text-left font-medium">Warning</th>
                <th className="px-3 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={11} className="text-center py-10 text-slate-400">Memuat...</td></tr>}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={11} className="text-center py-10 text-slate-400">Tidak ada data. Import Excel atau tambah manual.</td></tr>
              )}
              {!loading && data.items.map((m, i) => (
                <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`master-row-${i}`}>
                  <td className="px-3 py-3 text-slate-700">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-3 text-slate-900 font-medium max-w-[300px]">
                    <div className="truncate">{m.part_name}</div>
                    {m.reff && <div className="text-xs text-slate-400">REFF {m.reff} {m.location && `· ${m.location}`}</div>}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{m.type || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{m.maker || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{m.line_area}</td>
                  <td className={`px-3 py-3 font-semibold ${m.current_stock === null ? "text-slate-400" : m.current_stock === 0 ? "text-red-600" : "text-slate-900"}`}>
                    {m.current_stock === null ? "—" : m.current_stock}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{m.minimum_stock ?? 0}</td>
                  <td className="px-3 py-3">
                    <span className={`status-pill ${LEVEL_STYLES[m.level_part]}`}>{m.level_part}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className={`status-pill ${STATUS_STYLES[m.stock_status]}`}>{m.stock_status}</span>
                  </td>
                  <td className="px-3 py-3">
                    {m.warning === "CRITICAL" && <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold"><AlertOctagon className="w-3.5 h-3.5" /> Order Immediately</span>}
                    {m.warning === "CHECK_SUBSTITUTE" && <span className="inline-flex items-center gap-1 text-yellow-700 text-xs font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Check Substitute</span>}
                    {m.warning === "BELOW_MIN" && <span className="inline-flex items-center gap-1 text-orange-600 text-xs font-semibold"><AlertTriangle className="w-3.5 h-3.5" /> Below Min</span>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setOutPart(m); setOutOpen(true); }} title="OUT" className="p-1.5 rounded hover:bg-slate-100 text-slate-600" data-testid={`master-out-${i}`}>
                        <ArrowDownToLine className="w-4 h-4" />
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
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
          <div className="text-slate-500">Total: {data.total} part</div>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" data-testid="master-page-prev">‹</button>
            <span className="px-3 py-1.5 rounded-md bg-blue-600 text-white font-semibold">{page}</span>
            <span className="text-slate-400">/ {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" data-testid="master-page-next">›</button>
          </div>
        </div>
      </div>

      <EditDialog open={editOpen} onClose={() => setEditOpen(false)} part={editPart} onSaved={() => { setEditOpen(false); fetchData(); }} />
      <OutDialog open={outOpen} onClose={() => setOutOpen(false)} part={outPart} onSaved={() => { setOutOpen(false); fetchData(); }} />
    </AppShell>
  );
}

function EditDialog({ open, onClose, part, onSaved }) {
  const isEdit = !!part;
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(part ? {
      part_name: part.part_name || "", type: part.type || "", maker: part.maker || "", line_area: part.line_area || "",
      current_stock: part.current_stock ?? "", minimum_stock: part.minimum_stock ?? 0, level_part: part.level_part || "Stock",
      reff: part.reff || "", location: part.location || "",
    } : { part_name: "", type: "", maker: "", line_area: "ASSEMBLING & FI", current_stock: "", minimum_stock: 0, level_part: "Stock", reff: "", location: "" });
  }, [part, open]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.part_name || !form.line_area) { toast.error("Part Name & Line wajib"); return; }
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
          <Input label="Part Name *" value={form.part_name} onChange={(v) => upd("part_name", v)} testId="me-name" />
          <Input label="Type" value={form.type} onChange={(v) => upd("type", v)} testId="me-type" />
          <Input label="Maker" value={form.maker} onChange={(v) => upd("maker", v)} testId="me-maker" />
          <SelectField label="Line / Area *" value={form.line_area} onChange={(v) => upd("line_area", v)} options={LINE_AREAS.map((l) => l.key)} testId="me-line" />
          <Input label="Current Stock (kosong = NEED UPDATE, 0 = NO STOCK)" type="number" value={form.current_stock} onChange={(v) => upd("current_stock", v)} testId="me-stock" />
          <Input label="Minimum Stock" type="number" value={form.minimum_stock} onChange={(v) => upd("minimum_stock", v)} testId="me-min" />
          <SelectField label="Level Part" value={form.level_part} onChange={(v) => upd("level_part", v)} options={LEVELS} testId="me-level" />
          <Input label="REFF / Location" value={form.reff} onChange={(v) => upd("reff", v)} testId="me-reff" />
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
