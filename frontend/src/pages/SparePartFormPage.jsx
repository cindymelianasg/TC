import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, RotateCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import FileUploader from "@/components/FileUploader";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

export default function SparePartFormPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();

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
    keterangan: "",
    lampiran: [],
    foto_part: [],
    drawing: [],
    spesifikasi: [],
    ttd_requestor: null,
    ttd_approval: null,
  });
  const [busy, setBusy] = useState(false);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setForm({
      line_area: initialLine || "",
      nama_barang: "", type: "", maker: "", part_mesin: "",
      qty_order: 1, order_tanggal: today(), keterangan: "",
      lampiran: [], foto_part: [], drawing: [], spesifikasi: [],
      ttd_requestor: null, ttd_approval: null,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.line_area || !form.nama_barang || !form.maker) {
      toast.error("Lengkapi Line / Area, Nama Barang, dan Maker");
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.post("/spare-parts", { ...form, qty_order: parseInt(form.qty_order || 1, 10) });
      toast.success("Data berhasil disimpan");
      nav(`/parts/${data.id}`, { replace: true });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5 animate-fade-up">
        <button onClick={() => nav(-1)} className="p-2 rounded-lg hover:bg-slate-100" data-testid="form-back">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Form Request Spare Part</h1>
          <p className="text-sm text-slate-500">Lengkapi data berikut untuk membuat permintaan spare part baru.</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <SectionTitle title="Data Request" />

          <Field label="Line / Area *" required>
            <select value={form.line_area} onChange={(e) => update("line_area", e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="form-line">
              <option value="">-- Pilih Line --</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nama Barang *">
              <input type="text" value={form.nama_barang} onChange={(e) => update("nama_barang", e.target.value)} required placeholder="contoh: BEARING C" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-nama" />
            </Field>
            <Field label="Type">
              <input type="text" value={form.type} onChange={(e) => update("type", e.target.value)} placeholder="contoh: BALL BEARING 6205" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-type" />
            </Field>
            <Field label="Maker *">
              <input type="text" value={form.maker} onChange={(e) => update("maker", e.target.value)} required placeholder="contoh: SKF" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-maker" />
            </Field>
            <Field label="Part Mesin">
              <input type="text" value={form.part_mesin} onChange={(e) => update("part_mesin", e.target.value)} placeholder="contoh: CONVEYOR LINE 2" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-mesin" />
            </Field>
            <Field label="Qty *">
              <div className="flex items-center gap-2">
                <input type="number" min="1" value={form.qty_order} onChange={(e) => update("qty_order", e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-qty" />
                <span className="text-xs text-slate-500">PCS</span>
              </div>
            </Field>
            <Field label="Tanggal Request *">
              <input type="date" value={form.order_tanggal} onChange={(e) => update("order_tanggal", e.target.value)} required className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-date" />
            </Field>
          </div>

          <Field label="Keterangan / Catatan">
            <textarea rows={3} value={form.keterangan} onChange={(e) => update("keterangan", e.target.value)} placeholder="Digunakan untuk..." className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" data-testid="form-keterangan" />
          </Field>

          <div className="border-t pt-4">
            <SectionTitle title="Lampiran" subtitle="Foto Part, Drawing, dan Spesifikasi" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Foto Part</label>
                <FileUploader value={form.foto_part} onChange={(v) => update("foto_part", v)} accept="image/*" label="Upload Foto Part" testId="form-foto-part" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Drawing</label>
                <FileUploader value={form.drawing} onChange={(v) => update("drawing", v)} accept="image/*,application/pdf" label="Upload Drawing" testId="form-drawing" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Spesifikasi</label>
                <FileUploader value={form.spesifikasi} onChange={(v) => update("spesifikasi", v)} accept="image/*,application/pdf" label="Upload Spesifikasi" testId="form-spesifikasi" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 h-fit">
          <SectionTitle title="Requestor & Approval" />

          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Requestor</div>
            <div className="text-sm font-medium text-slate-900 mt-1">{user?.name}</div>
            <div className="text-xs text-slate-500">NIK {user?.nik} • {user?.rank}</div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">TTD Requestor *</label>
            <FileUploader single value={form.ttd_requestor} onChange={(v) => update("ttd_requestor", v)} accept="image/*" label="Upload TTD Requestor" testId="form-ttd-requestor" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">TTD Approval</label>
            <FileUploader single value={form.ttd_approval} onChange={(v) => update("ttd_approval", v)} accept="image/*" label="Upload TTD Approval" testId="form-ttd-approval" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button type="button" onClick={reset} className="flex-1 border border-slate-300 hover:bg-slate-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="form-reset">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button type="submit" disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="form-submit">
              <Save className="w-4 h-4" /> {busy ? "Menyimpan..." : "Simpan"}
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

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
