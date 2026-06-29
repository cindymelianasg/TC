import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import AppShell from "@/components/AppShell";
import { api, formatApiError } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { toast } from "sonner";

const LEVELS = ["Critical", "Substitusi", "Stock"];

/**
 * Parse the master Excel format:
 *   NO | NO. REFF | NAME OF PART (slash-separated) | LOCATION | QTY UPDATE | Min | Max | Stock... (multiple periods)
 * Returns rows {part_name, type, maker, reff, location, current_stock, minimum_stock, level_part}.
 */
function parseSheet(rows) {
  // Locate header row: contains "NAME OF PART"
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = (rows[i] || []).map((c) => String(c || "").toUpperCase());
    if (row.includes("NAME OF PART")) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const header = rows[headerIdx].map((c) => String(c || "").trim().toUpperCase().replace(/\s+/g, " "));

  const idxOf = (label) => header.indexOf(label);
  const cName = idxOf("NAME OF PART");
  const cReff = idxOf("NO. REFF");
  const cLoc = idxOf("LOCATION");
  const cMin = idxOf("MIN");
  // Find the RIGHTMOST "STOCK" column (latest period)
  const stockCols = header.map((h, i) => (h === "STOCK" ? i : -1)).filter((i) => i >= 0);
  const cStock = stockCols.length ? stockCols[stockCols.length - 1] : -1;

  const result = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const rawName = String(r[cName] || "").trim();
    if (!rawName) continue;
    const parts = rawName.split("/").map((s) => s.trim()).filter(Boolean);
    let part_name = parts[0] || rawName;
    let type = parts.slice(1, -1).join(" / ") || "";
    let maker = parts.length >= 2 ? parts[parts.length - 1] : "";
    if (parts.length === 1) { type = ""; maker = ""; }
    const stockRaw = cStock >= 0 ? r[cStock] : null;
    const minRaw = cMin >= 0 ? r[cMin] : null;
    result.push({
      part_name,
      type,
      maker,
      reff: cReff >= 0 ? String(r[cReff] || "").trim() : "",
      location: cLoc >= 0 ? String(r[cLoc] || "").trim() : "",
      current_stock: stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : (Number.isFinite(Number(stockRaw)) ? Number(stockRaw) : null),
      minimum_stock: minRaw === null || minRaw === "" ? 0 : (Number.isFinite(Number(minRaw)) ? Number(minRaw) : 0),
      level_part: "Stock",
    });
  }
  return result;
}

export default function MasterImportPage() {
  const nav = useNavigate();
  const inputRef = useRef(null);
  const [lineArea, setLineArea] = useState("ASSEMBLING & FI");
  const [defaultRes, setDefaultRes] = useState("skip");
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetData = wb.SheetNames.map((sn) => {
        const ws = wb.Sheets[sn];
        const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        return { name: sn, rows: arr };
      });
      setSheets(sheetData);
      // Auto-pick the sheet with the most rows that has NAME OF PART header
      const candidate = sheetData
        .map((s) => ({ ...s, parsed: parseSheet(s.rows) }))
        .filter((s) => s.parsed.length > 0)
        .sort((a, b) => b.parsed.length - a.parsed.length)[0];
      if (candidate) {
        setActiveSheet(candidate.name);
        setRows(candidate.parsed);
        setStep(2);
      } else {
        toast.error("Tidak menemukan kolom 'NAME OF PART' di file Excel");
      }
    } catch (err) {
      toast.error("Gagal membaca Excel: " + err.message);
    } finally { setBusy(false); }
  };

  const onSelectSheet = (name) => {
    setActiveSheet(name);
    const sh = sheets.find((s) => s.name === name);
    if (sh) setRows(parseSheet(sh.rows));
  };

  const runPreview = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/master-parts/import/preview", { line_area: lineArea, rows });
      setPreview(data);
      setStep(3);
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const runSave = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/master-parts/import/save", {
        line_area: lineArea, rows, default_resolution: defaultRes,
      });
      toast.success(`Tersimpan: ${data.created} baru, ${data.updated} update, ${data.skipped} dilewati, ${data.invalid} invalid`);
      nav("/master");
    } catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5 animate-fade-up">
        <button onClick={() => nav("/master")} className="p-2 rounded-lg hover:bg-slate-100"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import Master Data — Excel</h1>
          <p className="text-sm text-slate-500">Upload file Excel master per line/area.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= n ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{n}</div>
            <span className={`text-sm ${step >= n ? "text-slate-900 font-semibold" : "text-slate-400"}`}>{n === 1 ? "Upload" : n === 2 ? "Preview" : "Validate & Save"}</span>
            {n < 3 && <div className="w-8 h-px bg-slate-300" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="import-step-upload">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5 block">Target Line / Area</label>
            <select value={lineArea} onChange={(e) => setLineArea(e.target.value)} className="w-full md:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="import-line">
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </div>
          <button onClick={() => inputRef.current?.click()} disabled={busy}
            className="mt-5 w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-10 text-center flex flex-col items-center gap-3 transition disabled:opacity-60" data-testid="import-file-btn">
            <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
            <div className="text-base font-semibold text-slate-700">{busy ? "Membaca file..." : "Klik untuk pilih file Excel (.xlsx / .xls)"}</div>
            <div className="text-xs text-slate-400">Mendukung kolom: NO. REFF, NAME OF PART (Name/Type/Maker), LOCATION, Min, Stock</div>
          </button>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={onFile} className="hidden" />
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="import-step-preview">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-semibold text-slate-700">Preview {rows.length} baris</div>
              <div className="text-xs text-slate-500">Target line: <strong>{lineArea}</strong></div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Sheet:</label>
              <select value={activeSheet} onChange={(e) => onSelectSheet(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white" data-testid="import-sheet-select">
                {sheets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[450px] border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left">No</th>
                  <th className="px-2 py-2 text-left">Part Name</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-left">Maker</th>
                  <th className="px-2 py-2 text-left">REFF</th>
                  <th className="px-2 py-2 text-left">Location</th>
                  <th className="px-2 py-2 text-left">Stock</th>
                  <th className="px-2 py-2 text-left">Min</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-t border-slate-100" data-testid={`import-row-${i}`}>
                    <td className="px-2 py-1.5 text-slate-700">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium text-slate-900">{r.part_name}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.type}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.maker}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.reff}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.location}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.current_stock === null ? "—" : r.current_stock}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.minimum_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && <div className="text-xs text-slate-400 mt-2">Menampilkan 200 baris pertama dari {rows.length}.</div>}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Kembali</button>
            <button onClick={runPreview} disabled={busy || rows.length === 0} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold" data-testid="import-preview-btn">
              Validasi & Cek Duplikat
            </button>
          </div>
        </div>
      )}

      {step === 3 && preview && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm" data-testid="import-step-save">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Total" value={preview.summary.total} cls="text-slate-700" />
            <Stat label="Baru" value={preview.summary.new} cls="text-emerald-600" />
            <Stat label="Duplikat" value={preview.summary.duplicate} cls="text-amber-600" />
            <Stat label="Invalid" value={preview.summary.invalid} cls="text-red-600" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <div className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Untuk baris DUPLIKAT, pilih aksi:
            </div>
            <div className="flex items-center gap-3">
              {["skip", "update"].map((r) => (
                <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${defaultRes === r ? "border-blue-500 bg-white text-blue-700" : "border-amber-200 text-amber-800"}`}>
                  <input type="radio" name="res" value={r} checked={defaultRes === r} onChange={() => setDefaultRes(r)} data-testid={`import-res-${r}`} />
                  {r === "skip" ? "Skip (jangan timpa)" : "Update (timpa stock/min/level)"}
                </label>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">Kembali</button>
            <button onClick={runSave} disabled={busy} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-1.5" data-testid="import-save-btn">
              <CheckCircle2 className="w-4 h-4" /> {busy ? "Menyimpan..." : `Simpan ${preview.summary.new + (defaultRes === "update" ? preview.summary.duplicate : 0)} part ke Master Data`}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, cls }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
