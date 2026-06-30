import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, RotateCcw, AlertCircle, Search, Database, Plus } from "lucide-react";
import AppShell from "@/components/AppShell";
import FileUploader from "@/components/FileUploader";
import SignaturePaste from "@/components/SignaturePaste";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const today = () => new Date().toISOString().slice(0, 10);

const LEVEL_OPTIONS = ["Critical", "Substitusi", "Stock"];
const LAMPIRAN_OPTIONS = ["BELUM", "DONE"];

const REQUIRED_FIELDS = [
  { key: "line_area", label: "Line / Area" },
  { key: "nama_barang", label: "Nama Barang" },
  { key: "type", label: "Type" },
  { key: "maker", label: "Maker" },
  { key: "part_mesin", label: "Part Mesin" },
  { key: "qty_order", label: "Qty Order" },
  { key: "order_tanggal", label: "Tanggal Request" },
  { key: "level_part", label: "Level Part" },
];

export default function SparePartFormPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const formRef = useRef(null);
  const fieldRefs = useRef({});

  const lineSlug = params.get("line");
  const initialLine = lineSlug ? LINE_AREAS.find((l) => l.slug === lineSlug)?.key : "";

  const [form, setForm] = useState({
    line_area: initialLine || "",
    nama_barang: "",
    type: "",
    maker: "",
    part_mesin: "",
    qty_order: 1,
    order_tanggal: today(),
    level_part: "",
    keterangan: "",
    lampiran_status: "BELUM",
    lampiran_date: "",
    lampiran_note: "",
    foto_part: [],
    ttd_requestor: null,
    ttd_approval: null,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [matched, setMatched] = useState(null); // matched master part

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
    if (["nama_barang", "type", "maker"].includes(k)) setMatched(null);
  };

  // When user selects a master part, populate dependent fields & lock cascade
  const applyMasterPart = (m) => {
    setMatched(m);
    setForm((f) => ({
      ...f,
      nama_barang: m.part_name || f.nama_barang,
      type: m.type || f.type,
      maker: m.maker || f.maker,
      line_area: m.line_area || f.line_area,
      level_part: m.level_part || f.level_part,
    }));
    setErrors({});
  };

  const validate = () => {
    const e = {};
    for (const f of REQUIRED_FIELDS) {
      const val = form[f.key];
      if (val === null || val === undefined || String(val).trim() === "" || (f.key === "qty_order" && Number(val) < 1)) {
        e[f.key] = "Field ini wajib diisi.";
      }
    }
    if (form.level_part && !LEVEL_OPTIONS.includes(form.level_part)) {
      e.level_part = "Pilih Critical, Substitusi, atau Stock.";
    }
    return e;
  };

  // Before submit, verify part exists in Master Data
  const verifyMasterPart = async () => {
    try {
      const { data } = await api.get("/master-parts-search/lookup", {
        params: { part_name: form.nama_barang, type: form.type, maker: form.maker, line: form.line_area, limit: 1 },
      });
      const items = data.items || [];
      if (items.length === 0) {
        // Try fuzzy
        const fuzzy = await api.get("/master-parts-search/lookup", {
          params: { q: form.nama_barang, limit: 5 },
        });
        return { found: false, suggestions: fuzzy.data.items || [] };
      }
      return { found: true, master: items[0] };
    } catch {
      return { found: true, master: null }; // fall open
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      const firstKey = REQUIRED_FIELDS.find((f) => v[f.key])?.key || Object.keys(v)[0];
      const el = fieldRefs.current[firstKey];
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el.focus) setTimeout(() => el.focus?.(), 200);
      }
      toast.error("Lengkapi field yang ditandai merah");
      return;
    }
    // Master verification
    const check = await verifyMasterPart();
    if (!check.found) {
      setNotFoundOpen(true);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setBusy(true);
    try {
      const payload = {
        ...form,
        qty_order: parseInt(form.qty_order || 1, 10),
        lampiran_date: form.lampiran_date || null,
      };
      const { data } = await api.post("/spare-parts", payload);
      toast.success("Request berhasil disimpan");
      nav(`/parts/${data.id}`, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setForm({
      line_area: initialLine || "",
      nama_barang: "", type: "", maker: "", part_mesin: "",
      qty_order: 1, order_tanggal: today(), level_part: "",
      keterangan: "",
      lampiran_status: "BELUM", lampiran_date: "", lampiran_note: "",
      foto_part: [], ttd_requestor: null, ttd_approval: null,
    });
    setMatched(null);
    setErrors({});
  };

  const inputCls = (k) =>
    `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
      errors[k] ? "border-red-500 bg-red-50" : "border-slate-300"
    }`;

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5 animate-fade-up">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="form-back">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Form Request Spare Part</h1>
          <p className="text-sm text-slate-500">Ketik Name / Type / Maker — terhubung Master Data.</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-6" noValidate>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <SectionTitle title="Data Request" subtitle="Lookup Master Data otomatis" />

          {matched && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800" data-testid="form-master-match">
              <Database className="w-4 h-4 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold">Master Part terhubung</div>
                <div className="text-xs">{matched.part_name} {matched.type ? `· ${matched.type}` : ""} {matched.maker ? `· ${matched.maker}` : ""} · {matched.line_area}</div>
              </div>
              <button type="button" onClick={() => setMatched(null)} className="text-xs underline">Lepas</button>
            </div>
          )}

          <Field label="Line / Area" required error={errors.line_area}>
            <select
              ref={(el) => (fieldRefs.current.line_area = el)}
              value={form.line_area}
              onChange={(e) => update("line_area", e.target.value)}
              className={inputCls("line_area") + " bg-white"}
              data-testid="form-line"
            >
              <option value="">-- Pilih Line --</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nama Barang" required error={errors.nama_barang}>
              <MasterAutocomplete
                value={form.nama_barang}
                onChange={(v) => update("nama_barang", v)}
                onSelect={applyMasterPart}
                field="part_name"
                line={form.line_area}
                otherFilters={{ type: form.type, maker: form.maker }}
                placeholder="contoh: BEARING C"
                cls={inputCls("nama_barang")}
                inputRef={(el) => (fieldRefs.current.nama_barang = el)}
                testId="form-nama"
              />
            </Field>
            <Field label="Type" required error={errors.type}>
              <MasterAutocomplete
                value={form.type}
                onChange={(v) => update("type", v)}
                onSelect={applyMasterPart}
                field="type"
                line={form.line_area}
                otherFilters={{ part_name: form.nama_barang, maker: form.maker }}
                placeholder="contoh: BALL BEARING 6205"
                cls={inputCls("type")}
                inputRef={(el) => (fieldRefs.current.type = el)}
                testId="form-type"
              />
            </Field>
            <Field label="Maker" required error={errors.maker}>
              <MasterAutocomplete
                value={form.maker}
                onChange={(v) => update("maker", v)}
                onSelect={applyMasterPart}
                field="maker"
                line={form.line_area}
                otherFilters={{ part_name: form.nama_barang, type: form.type }}
                placeholder="contoh: SKF"
                cls={inputCls("maker")}
                inputRef={(el) => (fieldRefs.current.maker = el)}
                testId="form-maker"
              />
            </Field>
            <Field label="Part Mesin" required error={errors.part_mesin}>
              <input
                ref={(el) => (fieldRefs.current.part_mesin = el)}
                type="text" value={form.part_mesin} onChange={(e) => update("part_mesin", e.target.value)}
                placeholder="contoh: CONVEYOR LINE 2" className={inputCls("part_mesin")} data-testid="form-mesin" />
            </Field>
            <Field label="Qty Order" required error={errors.qty_order}>
              <div className="flex items-center gap-2">
                <input
                  ref={(el) => (fieldRefs.current.qty_order = el)}
                  type="number" min="1" value={form.qty_order} onChange={(e) => update("qty_order", e.target.value)}
                  className={inputCls("qty_order")} data-testid="form-qty" />
                <span className="text-xs text-slate-500">PCS</span>
              </div>
            </Field>
            <Field label="Level Part" required error={errors.level_part}>
              <select
                ref={(el) => (fieldRefs.current.level_part = el)}
                value={form.level_part}
                onChange={(e) => update("level_part", e.target.value)}
                className={inputCls("level_part") + " bg-white"}
                data-testid="form-level-part"
              >
                <option value="">-- Pilih Level Part --</option>
                {LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <div className="text-xs text-slate-400 mt-1">Menentukan urgensi & ketersediaan part</div>
            </Field>
            <Field label="Tanggal Request" required error={errors.order_tanggal}>
              <input
                ref={(el) => (fieldRefs.current.order_tanggal = el)}
                type="date" value={form.order_tanggal} onChange={(e) => update("order_tanggal", e.target.value)}
                className={inputCls("order_tanggal")} data-testid="form-date" />
            </Field>
          </div>

          <Field label="Keterangan / Catatan">
            <textarea rows={3} value={form.keterangan} onChange={(e) => update("keterangan", e.target.value)}
              placeholder="Digunakan untuk..." className={inputCls("keterangan")} data-testid="form-keterangan" />
          </Field>

          <div className="border-t pt-4">
            <SectionTitle title="Lampiran" subtitle="Status penyerahan dokumen lampiran ke atasan" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <Field label="Status Lampiran">
                <div className="flex items-center gap-3">
                  {LAMPIRAN_OPTIONS.map((opt) => (
                    <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.lampiran_status === opt ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}>
                      <input
                        type="radio"
                        name="lampiran_status"
                        value={opt}
                        checked={form.lampiran_status === opt}
                        onChange={() => update("lampiran_status", opt)}
                        data-testid={`form-lampiran-${opt.toLowerCase()}`}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Tanggal Penyerahan Lampiran">
                <input type="date" value={form.lampiran_date} onChange={(e) => update("lampiran_date", e.target.value)}
                  className={inputCls("lampiran_date")} data-testid="form-lampiran-date" />
              </Field>
              <Field label="Catatan Lampiran">
                <input type="text" value={form.lampiran_note} onChange={(e) => update("lampiran_note", e.target.value)}
                  placeholder="opsional" className={inputCls("lampiran_note")} data-testid="form-lampiran-note" />
              </Field>
            </div>
          </div>

          <div className="border-t pt-4">
            <SectionTitle title="Foto Part" subtitle="Opsional — foto fisik spare part" />
            <div className="mt-3">
              <FileUploader value={form.foto_part} onChange={(v) => update("foto_part", v)} accept="image/*" label="Upload Foto Part" testId="form-foto-part" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 h-fit">
          <SectionTitle title="Requestor & Approval" />

          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Requestor</div>
            <div className="text-sm font-medium text-slate-900 mt-1" data-testid="form-requestor-name">{user?.name}</div>
            <div className="text-xs text-slate-500">NIK {user?.nik} • {user?.rank}</div>
          </div>

          <div>
            <SignaturePaste
              label="Requestor Signature — paste from Shokuin"
              value={form.ttd_requestor}
              onChange={(v) => update("ttd_requestor", v)}
              testId="form-ttd-requestor"
            />
          </div>
          <div>
            <SignaturePaste
              label="Approval Signature — paste from Shokuin"
              value={form.ttd_approval}
              onChange={(v) => update("ttd_approval", v)}
              testId="form-ttd-approval"
            />
          </div>

          {Object.keys(errors).length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="form-validation-summary">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>Lengkapi {Object.keys(errors).length} field yang ditandai merah.</div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={reset} className="flex-1 border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="form-reset">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button type="submit" disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="form-submit">
              <Save className="w-4 h-4" /> {busy ? "Menyimpan..." : "Save Data"}
            </button>
          </div>
        </div>
      </form>

      <NotFoundDialog
        open={notFoundOpen}
        onClose={() => setNotFoundOpen(false)}
        onAddToMaster={() => {
          setNotFoundOpen(false);
          // Pre-fill master via URL state — open Master with intent to add
          nav(`/master?add=1&name=${encodeURIComponent(form.nama_barang)}&type=${encodeURIComponent(form.type)}&maker=${encodeURIComponent(form.maker)}&line=${encodeURIComponent(form.line_area)}&level=${encodeURIComponent(form.level_part)}`);
        }}
        onContinue={() => { setNotFoundOpen(false); doSave(); }}
        partName={form.nama_barang}
        type={form.type}
        maker={form.maker}
      />
    </AppShell>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function Field({ label, children, required, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <div className="text-xs text-red-600 mt-1" data-testid={`error-${label.toLowerCase().replace(/\s+/g, "-")}`}>{error}</div>}
    </div>
  );
}

function MasterAutocomplete({ value, onChange, onSelect, field, line, otherFilters, placeholder, cls, inputRef, testId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchValues = useCallback(async (q) => {
    if (!q || q.length < 1) { setItems([]); return; }
    setLoading(true);
    try {
      const params = { ...otherFilters };
      params[field] = q;
      if (line) params.line = line;
      const { data } = await api.get("/master-parts-search/lookup", { params });
      setItems(data.items || []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [field, line, otherFilters]);

  // Debounced fetch
  useEffect(() => {
    const t = setTimeout(() => { if (open) fetchValues(value); }, 200);
    return () => clearTimeout(t);
  }, [value, open, fetchValues]);

  const display = (m) => `${m.part_name}${m.type ? " · " + m.type : ""}${m.maker ? " · " + m.maker : ""}`;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={cls}
        data-testid={testId}
        autoComplete="off"
      />
      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      {open && value && items.length > 0 && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-auto" data-testid={`${testId}-list`}>
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Mencari...</div>}
          {items.slice(0, 10).map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(m); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0"
              data-testid={`${testId}-opt-${m.id}`}
            >
              <div className="font-medium text-slate-900 truncate">{display(m)}</div>
              <div className="text-[11px] text-slate-500">{m.line_area} · Stock {m.current_stock ?? "—"} · {m.level_part}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotFoundDialog({ open, onClose, onAddToMaster, onContinue, partName, type, maker }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="form-not-found-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-5 h-5" /> Part belum terdaftar di Master Data
          </DialogTitle>
        </DialogHeader>
        <div className="text-sm text-slate-700 space-y-2">
          <p>Part berikut tidak ditemukan di Master Data:</p>
          <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-0.5">
            <div><strong>Name:</strong> {partName || "-"}</div>
            <div><strong>Type:</strong> {type || "-"}</div>
            <div><strong>Maker:</strong> {maker || "-"}</div>
          </div>
          <p>Apakah Anda ingin menambahkan ke Master Data terlebih dahulu, atau tetap simpan request ini?</p>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm" data-testid="nf-cancel">Batal</button>
          <button onClick={onContinue} className="px-4 py-2 rounded-lg border border-slate-300 text-sm hover:bg-slate-50" data-testid="nf-continue">Tetap simpan request</button>
          <button onClick={onAddToMaster} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="nf-add-master">
            <Plus className="w-4 h-4" /> Tambahkan ke Master
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
