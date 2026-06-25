import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Pencil, FileText, ShoppingCart, Truck, FileCheck, FileSignature, Tag, CheckCircle2, Circle, Upload, Stamp } from "lucide-react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import AuthFileImage from "@/components/AuthFileImage";
import FileUploader from "@/components/FileUploader";
import { api, formatApiError } from "@/lib/api";
import { lineFromKey } from "@/constants/lines";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";

const TIMELINE = [
  { key: "REQUEST", label: "Request dibuat", icon: FileText, getDate: (p) => p.order_tanggal, getInfo: (p) => p.requestor_name ? `oleh ${p.requestor_name}` : "" },
  { key: "PENAWARAN", label: "Penawaran Vendor", icon: FileSignature, getDate: (p) => p.penawaran_date, getInfo: (p) => p.penawaran_note || "" },
  { key: "NEGO", label: "Nego", icon: Tag, getDate: (p) => p.nego_date, getInfo: (p) => p.nego_note || "Sedang proses nego" },
  { key: "AFA", label: "AFA", icon: FileCheck, getDate: (p) => p.afa_date, getInfo: (p) => p.afa_no ? `No. AFA: ${p.afa_no}` : "" },
  { key: "PO", label: "PO", icon: ShoppingCart, getDate: (p) => p.po_date, getInfo: (p) => p.po_no ? `No. PO: ${p.po_no}` : "" },
  { key: "DATANG", label: "Datang", icon: Truck, getDate: (p) => p.datang_date, getInfo: (p) => p.datang_no ? `No. Datang: ${p.datang_no}` : "" },
];

function isStageCompleted(part, stageKey) {
  switch (stageKey) {
    case "REQUEST": return true;
    case "PENAWARAN": return !!part.penawaran_date;
    case "NEGO": return !!part.nego_date;
    case "AFA": return !!(part.afa_date && part.afa_no);
    case "PO": return !!(part.po_date && part.po_no);
    case "DATANG": return !!(part.datang_date && part.datang_no);
    default: return false;
  }
}

function isStageCurrent(part, stageKey) {
  const status = part.status;
  if (stageKey === "PENAWARAN" && status === "PENAWARAN") return true;
  if (stageKey === "NEGO" && status === "NEGO") return true;
  if (stageKey === "AFA" && status === "AFA PROCESS") return true;
  if (stageKey === "PO" && status === "PO PROCESS") return true;
  if (stageKey === "DATANG" && status === "DATANG") return true;
  return false;
}

export default function SparePartDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [part, setPart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [stampOpen, setStampOpen] = useState(false);

  const fetchPart = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/spare-parts/${id}`);
      setPart(data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Gagal memuat part");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPart(); }, [id]);

  const goBack = () => {
    // Browser back to preserve list state (query params)
    if (window.history.length > 1) {
      nav(-1);
    } else {
      nav("/database");
    }
  };

  if (loading) return <AppShell><div className="text-center py-20 text-slate-400">Memuat...</div></AppShell>;
  if (!part) return <AppShell><div className="text-center py-20 text-slate-400">Part tidak ditemukan.</div></AppShell>;

  const line = lineFromKey(part.line_area);

  const lampiranAll = [
    ...(part.lampiran || []),
    ...(part.foto_part || []),
    ...(part.drawing || []),
    ...(part.spesifikasi || []),
  ];

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-5 animate-fade-up">
        <button onClick={goBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm" data-testid="detail-back">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <button onClick={() => setEditOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="detail-edit-btn">
          <Pencil className="w-4 h-4" /> Edit / Update Data
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: Part info */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Informasi Part</div>
                <h2 className="text-xl font-bold text-slate-900 mt-1" data-testid="detail-nama-barang">{part.nama_barang}</h2>
                {part.type && <div className="text-sm text-slate-500 mt-1">{part.type}</div>}
              </div>
              <StatusBadge status={part.status} />
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

          {/* Lampiran */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-slate-700">Lampiran ({lampiranAll.length})</div>
            </div>
            {lampiranAll.length === 0 ? (
              <div className="text-sm text-slate-400">Belum ada lampiran.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {lampiranAll.map((f) => (
                  <a
                    key={f.id}
                    href={`#preview-${f.id}`}
                    onClick={(e) => { e.preventDefault(); window.open(`${process.env.REACT_APP_BACKEND_URL}/api/files/${f.id}?auth=${localStorage.getItem("spcs_token")}`, "_blank"); }}
                    className="block p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition"
                    data-testid={`lampiran-${f.id}`}
                  >
                    {f.content_type?.startsWith("image/") ? (
                      <AuthFileImage fileId={f.id} className="w-full h-24 object-cover rounded-md" />
                    ) : (
                      <div className="h-24 flex items-center justify-center bg-white rounded-md">
                        <FileText className="w-8 h-8 text-blue-600" />
                      </div>
                    )}
                    <div className="text-xs text-slate-600 mt-2 truncate">{f.filename}</div>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Tanda Tangan & Stamp */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-4">Tanda Tangan & Stempel</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SignatureBox label="TTD Requestor" file={part.ttd_requestor} />
              <SignatureBox label="TTD Approval" file={part.ttd_approval} />
              <div className="border border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Digital Stamp</div>
                {part.stamp_file ? (
                  <AuthFileImage fileId={part.stamp_file.id} className="w-32 h-32 object-contain" />
                ) : (
                  <div className="digital-stamp">
                    APPROVED<br />
                    {part.requestor_name || "—"}
                  </div>
                )}
                <button onClick={() => setStampOpen(true)} className="mt-3 text-xs text-blue-600 hover:underline flex items-center gap-1" data-testid="stamp-upload-btn">
                  <Stamp className="w-3.5 h-3.5" /> {part.stamp_file ? "Ganti Stempel" : "Upload Stempel"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-700 mb-4">Alur Proses Pengadaan</div>
          <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
            {TIMELINE.map((s) => {
              const done = isStageCompleted(part, s.key);
              const current = isStageCurrent(part, s.key);
              const Icon = s.icon;
              const date = s.getDate(part);
              const info = s.getInfo(part);
              return (
                <li key={s.key} className="ml-4" data-testid={`timeline-${s.key.toLowerCase()}`}>
                  <div className={`absolute -left-[14px] w-6 h-6 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : current ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${done ? "text-emerald-600" : current ? "text-orange-600" : "text-slate-400"}`} />
                    <span className={`text-sm font-semibold ${current ? "text-orange-700" : "text-slate-900"}`}>{s.label}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{date || "—"}</div>
                  {info && <div className="text-xs text-slate-600 mt-1">{info}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* Update Dialog */}
      <UpdateDialog open={editOpen} onClose={() => setEditOpen(false)} part={part} onSaved={(updated) => { setPart(updated); setEditOpen(false); }} />

      {/* Stamp Upload Dialog */}
      <Dialog open={stampOpen} onOpenChange={setStampOpen}>
        <DialogContent className="sm:max-w-md" data-testid="stamp-dialog">
          <DialogHeader>
            <DialogTitle>Upload Stempel Digital</DialogTitle>
          </DialogHeader>
          <FileUploader
            single
            accept="image/*"
            label="Upload gambar stempel"
            value={part.stamp_file}
            onChange={async (f) => {
              try {
                const { data } = await api.patch(`/spare-parts/${part.id}/stamp`, { stamp_file: f });
                setPart(data);
                toast.success("Stempel berhasil disimpan");
                setStampOpen(false);
              } catch (err) {
                toast.error(formatApiError(err.response?.data?.detail) || "Gagal menyimpan stempel");
              }
            }}
            testId="stamp-uploader"
          />
        </DialogContent>
      </Dialog>
    </AppShell>
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

function SignatureBox({ label, file }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      {file ? (
        <AuthFileImage fileId={file.id} className="w-full h-24 object-contain bg-white rounded" />
      ) : (
        <div className="h-24 flex items-center justify-center text-xs text-slate-400 bg-white rounded">— Belum ada TTD —</div>
      )}
    </div>
  );
}

function UpdateDialog({ open, onClose, part, onSaved }) {
  const [tab, setTab] = useState("penawaran");
  const [busy, setBusy] = useState(false);

  // Penawaran
  const [penawaran, setPenawaran] = useState({});
  const [afa, setAfa] = useState({});
  const [po, setPo] = useState({});
  const [datang, setDatang] = useState({});

  useEffect(() => {
    if (part) {
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
  }, [part]);

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
      <DialogContent className="sm:max-w-2xl" data-testid="update-dialog">
        <DialogHeader>
          <DialogTitle>Edit / Update Proses</DialogTitle>
        </DialogHeader>
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
              <Input label="Tanggal Nego (FB Penawaran)" type="date" value={penawaran.nego_date} onChange={(v) => setPenawaran({ ...penawaran, nego_date: v })} testId="nego-date" />
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
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Foto Barang Datang</label>
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

function Input({ label, value, onChange, type = "text", placeholder, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
function Textarea({ label, value, onChange, testId }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      <textarea rows={3} value={value || ""} onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
    </div>
  );
}
