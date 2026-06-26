import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, FileText, ShoppingCart, Truck, FileCheck, FileSignature, Tag,
  CheckCircle2, Circle, Stamp, Info, ZoomIn, History as HistoryIcon, AlertTriangle, Package, Settings as SettingsIcon,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import AuthFileImage from "@/components/AuthFileImage";
import FileUploader from "@/components/FileUploader";
import Lightbox from "@/components/Lightbox";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS, lineFromKey } from "@/constants/lines";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

const TIMELINE = [
  { key: "REQUEST", label: "Request dibuat", icon: FileText, getDate: (p) => p.order_tanggal, getInfo: (p) => p.requestor_name ? `oleh ${p.requestor_name}` : "" },
  { key: "PENAWARAN", label: "Penawaran Vendor", icon: FileSignature, getDate: (p) => p.penawaran_date, getInfo: (p) => p.penawaran_note || "" },
  { key: "NEGO", label: "Nego (FB Penawaran)", icon: Tag, getDate: (p) => p.nego_date, getInfo: (p) => p.nego_note || (p.penawaran_date && !p.afa_no ? "Sedang proses nego" : "") },
  { key: "AFA", label: "AFA", icon: FileCheck, getDate: (p) => p.afa_date, getInfo: (p) => p.afa_no ? `No. AFA: ${p.afa_no}` : "" },
  { key: "PO", label: "PO", icon: ShoppingCart, getDate: (p) => p.po_date, getInfo: (p) => p.po_no ? `No. PO: ${p.po_no}` : "" },
  { key: "DATANG", label: "Datang", icon: Truck, getDate: (p) => p.datang_date, getInfo: (p) => p.datang_no ? `No. Datang: ${p.datang_no}` : "" },
];

function isStageCompleted(part, key) {
  switch (key) {
    case "REQUEST": return true;
    case "PENAWARAN": return !!part.penawaran_date;
    case "NEGO": return !!part.nego_date;
    case "AFA": return !!(part.afa_date && part.afa_no);
    case "PO": return !!(part.po_date && part.po_no);
    case "DATANG": return !!(part.datang_date && part.datang_no);
    default: return false;
  }
}

const LEVEL_STYLES = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  Substitusi: "bg-amber-100 text-amber-800 border-amber-200",
  Stock: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const LAMPIRAN_STYLES = {
  BELUM: "bg-slate-100 text-slate-700 border-slate-200",
  DONE: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default function SparePartDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editStageOpen, setEditStageOpen] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, fileId: null, filename: "" });

  const fetchPart = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/spare-parts/${id}`);
      setPart(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal memuat part");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPart(); }, [fetchPart]);

  if (loading) return <AppShell><div className="text-center py-20 text-slate-400">Memuat...</div></AppShell>;
  if (!part) return <AppShell><div className="text-center py-20 text-slate-400">Part tidak ditemukan.</div></AppShell>;

  const canEdit = user?.role === "creator" || part.requestor_id === user?.id;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav("/database"))} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm" data-testid="detail-back">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button onClick={() => setEditInfoOpen(true)} className="border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="detail-edit-info-btn">
              <Pencil className="w-4 h-4" /> Edit Info
            </button>
          )}
          <button onClick={() => setEditStageOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="detail-edit-stage-btn">
            <Pencil className="w-4 h-4" /> Edit / Update Proses
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <PartInfoCard part={part} />
          <LampiranCard part={part} />
          <FotoDatangCard part={part} onOpen={(f) => setLightbox({ open: true, fileId: f.id, filename: f.filename })} />
          <StampCard part={part} onOpen={() => setStampOpen(true)} onClickStamp={(f) => setLightbox({ open: true, fileId: f.id, filename: f.filename })} />
          <EditHistoryCard part={part} />
        </div>

        <TimelineCard part={part} />
      </div>

      <UpdateDialog open={editStageOpen} onClose={() => setEditStageOpen(false)} part={part} onSaved={(updated) => { setPart(updated); setEditStageOpen(false); }} />

      <EditInfoDialog open={editInfoOpen} onClose={() => setEditInfoOpen(false)} part={part} onSaved={(updated) => { setPart(updated); setEditInfoOpen(false); }} />

      <Dialog open={stampOpen} onOpenChange={setStampOpen}>
        <DialogContent className="sm:max-w-md" data-testid="stamp-dialog">
          <DialogHeader><DialogTitle>Upload Stempel Digital</DialogTitle></DialogHeader>
          <FileUploader
            single accept="image/*" label="Upload gambar stempel"
            value={part.stamp_file}
            onChange={async (f) => {
              try {
                const { data } = await api.patch(`/spare-parts/${part.id}/stamp`, { stamp_file: f });
                setPart(data); toast.success("Stempel berhasil disimpan"); setStampOpen(false);
              } catch (err) {
                toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan stempel");
              }
            }}
            testId="stamp-uploader"
          />
        </DialogContent>
      </Dialog>

      <Lightbox open={lightbox.open} fileId={lightbox.fileId} filename={lightbox.filename} onClose={() => setLightbox({ open: false, fileId: null, filename: "" })} />
    </AppShell>
  );
}

function PartInfoCard({ part }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Informasi Part</div>
          <h2 className="text-xl font-bold text-slate-900 mt-1" data-testid="detail-nama-barang">{part.nama_barang}</h2>
          {part.type && <div className="text-sm text-slate-500 mt-1">{part.type}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {part.level_part && (
            <span className={`status-pill ${LEVEL_STYLES[part.level_part] || LEVEL_STYLES.Stock}`} data-testid={`level-${part.level_part.toLowerCase()}`}>
              {part.level_part === "Critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
              {part.level_part === "Substitusi" && <SettingsIcon className="w-3 h-3 mr-1" />}
              {part.level_part === "Stock" && <Package className="w-3 h-3 mr-1" />}
              {part.level_part}
            </span>
          )}
          <StatusBadge status={part.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <Field label="Line / Area" value={part.line_area} testId="detail-line" />
        <Field label="Maker" value={part.maker} testId="detail-maker" />
        <Field label="Part Mesin" value={part.part_mesin || "-"} testId="detail-mesin" />
        <Field label="Qty Order" value={`${part.qty_order} PCS`} testId="detail-qty" />
        <Field label="Tanggal Order" value={part.order_tanggal} testId="detail-order-date" />
        <Field label="Requestor" value={`${part.requestor_name || "-"}`} testId="detail-requestor" />
      </div>
      {part.keterangan && (
        <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Keterangan: </span>{part.keterangan}
        </div>
      )}
    </div>
  );
}

function LampiranCard({ part }) {
  const status = part.lampiran_status || "BELUM";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="lampiran-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">Lampiran</div>
        <span className={`status-pill ${LAMPIRAN_STYLES[status]}`} data-testid={`lampiran-status-${status.toLowerCase()}`}>{status}</span>
      </div>
      <p className="text-xs text-slate-500">Status penyerahan dokumen fisik ke supervisor.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tanggal Penyerahan</div>
          <div className="text-sm text-slate-800 mt-1">{part.lampiran_date || "—"}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Catatan</div>
          <div className="text-sm text-slate-800 mt-1">{part.lampiran_note || "—"}</div>
        </div>
      </div>
    </div>
  );
}

function FotoDatangCard({ part, onOpen }) {
  const photos = part.foto_datang || [];
  if (!photos.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="foto-datang-card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-700">Foto Barang Datang</div>
        <span className="text-xs text-slate-500">{photos.length} foto</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {photos.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onOpen(f)}
            className="relative group rounded-lg overflow-hidden bg-slate-100 border border-slate-200 hover:border-blue-400"
            data-testid={`foto-datang-${f.id}`}
          >
            <AuthFileImage fileId={f.id} className="w-full h-28 object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <ZoomIn className="w-6 h-6 text-white" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StampCard({ part, onOpen, onClickStamp }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-700 mb-4">Tanda Tangan & Stempel</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SignatureBox label="TTD Requestor" file={part.ttd_requestor} onClick={onClickStamp} />
        <SignatureBox label="TTD Approval" file={part.ttd_approval} onClick={onClickStamp} />
        <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Digital Stamp</div>
          {part.stamp_file ? (
            <button type="button" onClick={() => onClickStamp(part.stamp_file)}>
              <AuthFileImage fileId={part.stamp_file.id} className="w-32 h-32 object-contain" />
            </button>
          ) : (
            <div className="digital-stamp">
              APPROVED<br />
              {part.requestor_name || "—"}
            </div>
          )}
          <button onClick={onOpen} className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1" data-testid="stamp-upload-btn">
            <Stamp className="w-3.5 h-3.5" /> {part.stamp_file ? "Ganti Stempel" : "Upload Stempel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ part }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <div className="text-sm font-semibold text-slate-700 mb-4">Alur Proses Pengadaan</div>
      <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
        {TIMELINE.map((s) => {
          const done = isStageCompleted(part, s.key);
          const Icon = s.icon;
          return (
            <li key={s.key} className="ml-4" data-testid={`timeline-${s.key.toLowerCase()}`}>
              <div className={`absolute -left-[14px] w-6 h-6 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
              </div>
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${done ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="text-sm font-semibold text-slate-900">{s.label}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{s.getDate(part) || "—"}</div>
              {s.getInfo(part) && <div className="text-xs text-slate-600 mt-1">{s.getInfo(part)}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function EditHistoryCard({ part }) {
  const history = part.edit_history || [];
  if (!history.length) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="edit-history-card">
      <div className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <HistoryIcon className="w-4 h-4" /> Riwayat Edit
      </div>
      <ul className="space-y-3">
        {history.slice().reverse().map((h, i) => (
          <li key={i} className="border-l-2 border-blue-300 pl-3" data-testid={`edit-history-${i}`}>
            <div className="text-sm text-slate-800">
              <span className="font-semibold">{h.actor}</span>
              <span className="text-slate-400 text-xs ml-2">NIK {h.actor_nik}</span>
            </div>
            <div className="text-xs text-slate-500">{h.timestamp}</div>
            {h.changes && h.changes.length > 0 && (
              <ul className="text-xs text-slate-600 mt-1 space-y-0.5">
                {h.changes.map((c, j) => (
                  <li key={j}><span className="font-mono">{c.field}</span>: <span className="text-red-600 line-through">{String(c.old || "—")}</span> → <span className="text-emerald-600">{String(c.new || "—")}</span></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, value, testId }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 mt-1" data-testid={testId}>{value}</div>
    </div>
  );
}

function SignatureBox({ label, file, onClick }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      {file ? (
        <button type="button" onClick={() => onClick(file)} className="w-full">
          <AuthFileImage fileId={file.id} className="w-full h-24 object-contain bg-white rounded" />
        </button>
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-slate-400 bg-white rounded">— Belum ada TTD —</div>
      )}
    </div>
  );
}

function UpdateDialog({ open, onClose, part, onSaved }) {
  const [tab, setTab] = useState("penawaran");
  const [busy, setBusy] = useState(false);
  const [penawaran, setPenawaran] = useState({});
  const [afa, setAfa] = useState({});
  const [po, setPo] = useState({});
  const [datang, setDatang] = useState({});

  useEffect(() => {
    if (part && open) {
      setPenawaran({
        penawaran_date: part.penawaran_date || "",
        penawaran_note: part.penawaran_note || "",
        nego_date: part.nego_date || "",
        nego_note: part.nego_note || "",
      });
      setAfa({ afa_date: part.afa_date || "", afa_no: part.afa_no || "", afa_note: part.afa_note || "" });
      setPo({ po_date: part.po_date || "", po_no: part.po_no || "", po_note: part.po_note || "" });
      setDatang({ datang_date: part.datang_date || "", datang_no: part.datang_no || "", datang_note: part.datang_note || "", foto_datang: part.foto_datang || [] });
    }
  }, [part, open]);

  const save = async (stage) => {
    setBusy(true);
    try {
      let payload;
      if (stage === "penawaran") payload = penawaran;
      if (stage === "afa") payload = afa;
      if (stage === "po") payload = po;
      if (stage === "datang") payload = datang;
      const { data } = await api.patch(`/spare-parts/${part.id}/${stage}`, payload);
      toast.success("Berhasil disimpan");
      onSaved(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="update-dialog">
        <DialogHeader><DialogTitle>Edit / Update Proses</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="penawaran" data-testid="tab-penawaran">Penawaran</TabsTrigger>
            <TabsTrigger value="afa" data-testid="tab-afa">AFA</TabsTrigger>
            <TabsTrigger value="po" data-testid="tab-po">PO</TabsTrigger>
            <TabsTrigger value="datang" data-testid="tab-datang">Datang</TabsTrigger>
          </TabsList>

          <TabsContent value="penawaran" className="space-y-3 pt-4">
            <Input label="Tanggal Penawaran" type="date" value={penawaran.penawaran_date} onChange={(v) => setPenawaran({ ...penawaran, penawaran_date: v })} testId="penawaran-date" />
            <Textarea label="Catatan Penawaran" value={penawaran.penawaran_note} onChange={(v) => setPenawaran({ ...penawaran, penawaran_note: v })} testId="penawaran-note" />
            <div className="border-t pt-3 mt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">FB Penawaran (Nego) — Opsional</div>
              <Input label="Tanggal Nego" type="date" value={penawaran.nego_date} onChange={(v) => setPenawaran({ ...penawaran, nego_date: v })} testId="nego-date" />
              <Textarea label="Catatan Nego" value={penawaran.nego_note} onChange={(v) => setPenawaran({ ...penawaran, nego_note: v })} testId="nego-note" />
            </div>
            <DialogFooter>
              <button disabled={busy} onClick={() => save("penawaran")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-testid="save-penawaran">Simpan</button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="afa" className="space-y-3 pt-4">
            <Input label="Tanggal AFA" type="date" value={afa.afa_date} onChange={(v) => setAfa({ ...afa, afa_date: v })} testId="afa-date" />
            <Input label="No AFA" value={afa.afa_no} onChange={(v) => setAfa({ ...afa, afa_no: v })} placeholder="contoh: 001-RM-..." testId="afa-no" />
            <Textarea label="Catatan AFA" value={afa.afa_note} onChange={(v) => setAfa({ ...afa, afa_note: v })} testId="afa-note" />
            <DialogFooter>
              <button disabled={busy} onClick={() => save("afa")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-testid="save-afa">Simpan</button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="po" className="space-y-3 pt-4">
            <Input label="Tanggal PO" type="date" value={po.po_date} onChange={(v) => setPo({ ...po, po_date: v })} testId="po-date" />
            <Input label="No PO" value={po.po_no} onChange={(v) => setPo({ ...po, po_no: v })} testId="po-no" />
            <Textarea label="Catatan PO" value={po.po_note} onChange={(v) => setPo({ ...po, po_note: v })} testId="po-note" />
            <DialogFooter>
              <button disabled={busy} onClick={() => save("po")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-testid="save-po">Simpan</button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="datang" className="space-y-3 pt-4">
            <Input label="Tanggal Datang" type="date" value={datang.datang_date} onChange={(v) => setDatang({ ...datang, datang_date: v })} testId="datang-date" />
            <Input label="No Datang" value={datang.datang_no} onChange={(v) => setDatang({ ...datang, datang_no: v })} testId="datang-no" />
            <Textarea label="Catatan Datang" value={datang.datang_note} onChange={(v) => setDatang({ ...datang, datang_note: v })} testId="datang-note" />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Foto Barang Datang (opsional, auto-kompres)</label>
              <FileUploader accept="image/*" value={datang.foto_datang} onChange={(arr) => setDatang({ ...datang, foto_datang: arr })} label="Upload Foto Datang" testId="datang-foto" />
            </div>
            <DialogFooter>
              <button disabled={busy} onClick={() => save("datang")} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-testid="save-datang">Simpan</button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function EditInfoDialog({ open, onClose, part, onSaved }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (part && open) {
      setForm({
        line_area: part.line_area || "",
        nama_barang: part.nama_barang || "",
        type: part.type || "",
        maker: part.maker || "",
        part_mesin: part.part_mesin || "",
        qty_order: part.qty_order || 1,
        order_tanggal: part.order_tanggal || "",
        level_part: part.level_part || "",
        keterangan: part.keterangan || "",
        lampiran_status: part.lampiran_status || "BELUM",
        lampiran_date: part.lampiran_date || "",
        lampiran_note: part.lampiran_note || "",
      });
      setErrors({});
    }
  }, [part, open]);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    for (const k of ["line_area", "nama_barang", "type", "maker", "part_mesin", "qty_order", "order_tanggal", "level_part"]) {
      const v = form[k];
      if (v === null || v === undefined || String(v).trim() === "") {
        e[k] = "Wajib diisi.";
      }
    }
    return e;
  };

  const save = async () => {
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) {
      toast.error("Lengkapi field wajib");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, qty_order: parseInt(form.qty_order, 10), lampiran_date: form.lampiran_date || null };
      const { data } = await api.patch(`/spare-parts/${part.id}`, payload);
      toast.success("Info berhasil diperbarui");
      onSaved(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = (k) => `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors[k] ? "border-red-500 bg-red-50" : "border-slate-300"}`;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="edit-info-dialog">
        <DialogHeader>
          <DialogTitle>Edit Informasi Part</DialogTitle>
          <div className="text-xs text-slate-500">Semua perubahan akan tercatat di Riwayat Edit.</div>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldDlg label="Line / Area" required error={errors.line_area}>
            <select value={form.line_area} onChange={(e) => update("line_area", e.target.value)} className={inputCls("line_area") + " bg-white"} data-testid="edit-line">
              <option value="">-- Pilih --</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </FieldDlg>
          <FieldDlg label="Nama Barang" required error={errors.nama_barang}>
            <input type="text" value={form.nama_barang} onChange={(e) => update("nama_barang", e.target.value)} className={inputCls("nama_barang")} data-testid="edit-nama" />
          </FieldDlg>
          <FieldDlg label="Type" required error={errors.type}>
            <input type="text" value={form.type} onChange={(e) => update("type", e.target.value)} className={inputCls("type")} data-testid="edit-type" />
          </FieldDlg>
          <FieldDlg label="Maker" required error={errors.maker}>
            <input type="text" value={form.maker} onChange={(e) => update("maker", e.target.value)} className={inputCls("maker")} data-testid="edit-maker" />
          </FieldDlg>
          <FieldDlg label="Part Mesin" required error={errors.part_mesin}>
            <input type="text" value={form.part_mesin} onChange={(e) => update("part_mesin", e.target.value)} className={inputCls("part_mesin")} data-testid="edit-mesin" />
          </FieldDlg>
          <FieldDlg label="Qty Order" required error={errors.qty_order}>
            <input type="number" min="1" value={form.qty_order} onChange={(e) => update("qty_order", e.target.value)} className={inputCls("qty_order")} data-testid="edit-qty" />
          </FieldDlg>
          <FieldDlg label="Tanggal Request" required error={errors.order_tanggal}>
            <input type="date" value={form.order_tanggal} onChange={(e) => update("order_tanggal", e.target.value)} className={inputCls("order_tanggal")} data-testid="edit-date" />
          </FieldDlg>
          <FieldDlg label="Level Part" required error={errors.level_part}>
            <select value={form.level_part} onChange={(e) => update("level_part", e.target.value)} className={inputCls("level_part") + " bg-white"} data-testid="edit-level-part">
              <option value="">-- Pilih --</option>
              {["Critical", "Substitusi", "Stock"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </FieldDlg>
          <FieldDlg label="Keterangan">
            <textarea rows={2} value={form.keterangan} onChange={(e) => update("keterangan", e.target.value)} className={inputCls("keterangan")} data-testid="edit-keterangan" />
          </FieldDlg>
          <div className="md:col-span-2 border-t pt-3 mt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Lampiran</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FieldDlg label="Status Lampiran">
                <select value={form.lampiran_status} onChange={(e) => update("lampiran_status", e.target.value)} className={inputCls("lampiran_status") + " bg-white"} data-testid="edit-lampiran-status">
                  <option value="BELUM">BELUM</option>
                  <option value="DONE">DONE</option>
                </select>
              </FieldDlg>
              <FieldDlg label="Tanggal Penyerahan">
                <input type="date" value={form.lampiran_date || ""} onChange={(e) => update("lampiran_date", e.target.value)} className={inputCls("lampiran_date")} data-testid="edit-lampiran-date" />
              </FieldDlg>
              <FieldDlg label="Catatan">
                <input type="text" value={form.lampiran_note || ""} onChange={(e) => update("lampiran_note", e.target.value)} className={inputCls("lampiran_note")} data-testid="edit-lampiran-note" />
              </FieldDlg>
            </div>
          </div>
        </div>
        <DialogFooter>
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Batal</button>
          <button onClick={save} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" data-testid="edit-info-save">{busy ? "Menyimpan..." : "Simpan Perubahan"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldDlg({ label, children, required, error }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
function Textarea({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
