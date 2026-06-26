import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, RotateCcw, AlertCircle } from "lucide-react";
import AppShell from "@/components/AppShell";
import FileUploader from "@/components/FileUploader";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

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

  const update = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
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

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length > 0) {
      // Scroll to first invalid
      const firstKey = REQUIRED_FIELDS.find((f) => v[f.key])?.key || Object.keys(v)[0];
      const el = fieldRefs.current[firstKey];
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el.focus) setTimeout(() => el.focus?.(), 200);
      }
      toast.error("Lengkapi field yang ditandai merah");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        qty_order: parseInt(form.qty_order || 1, 10),
        lampiran_date: form.lampiran_date || null,
      };
      const { data } = await api.post("/spare-parts", payload);
      toast.success("Data berhasil disimpan");
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
          <p className="text-sm text-slate-500">Lengkapi semua field yang ditandai <span className="text-red-500">*</span>.</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-6" noValidate>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <SectionTitle title="Data Request" />

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
              <input
                ref={(el) => (fieldRefs.current.nama_barang = el)}
                type="text" value={form.nama_barang} onChange={(e) => update("nama_barang", e.target.value)}
                placeholder="contoh: BEARING C" className={inputCls("nama_barang")} data-testid="form-nama" />
            </Field>
            <Field label="Type" required error={errors.type}>
              <input
                ref={(el) => (fieldRefs.current.type = el)}
                type="text" value={form.type} onChange={(e) => update("type", e.target.value)}
                placeholder="contoh: BALL BEARING 6205" className={inputCls("type")} data-testid="form-type" />
            </Field>
            <Field label="Maker" required error={errors.maker}>
              <input
                ref={(el) => (fieldRefs.current.maker = el)}
                type="text" value={form.maker} onChange={(e) => update("maker", e.target.value)}
                placeholder="contoh: SKF" className={inputCls("maker")} data-testid="form-maker" />
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
            <SectionTitle title="Lampiran" subtitle="Status penyerahan dokumen lampiran ke supervisor" />
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
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">TTD Requestor (opsional)</label>
            <FileUploader single value={form.ttd_requestor} onChange={(v) => update("ttd_requestor", v)} accept="image/*" label="Upload TTD Requestor" testId="form-ttd-requestor" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">TTD Approval (opsional)</label>
            <FileUploader single value={form.ttd_approval} onChange={(v) => update("ttd_approval", v)} accept="image/*" label="Upload TTD Approval" testId="form-ttd-approval" />
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
