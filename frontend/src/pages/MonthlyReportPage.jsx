import { useEffect, useState, useCallback } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { LINE_AREAS, MONTHS_ID, STATUS_LIST } from "@/constants/lines";
import { toast } from "sonner";

export default function MonthlyReportPage() {
  const now = new Date();
  const [line, setLine] = useState("SEMUA");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/reports/monthly", { params: { line, month, year } });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [line, month, year]);

  // Initial load only — subsequent loads triggered by "Tampilkan" button
  useEffect(() => { fetchReport(); }, []);

  const exportExcel = () => {
    if (!report) return;
    const rows = (report.items || []).map((p, i) => ({
      No: i + 1,
      Requestor: p.requestor_name,
      "Nama Barang / Type / Maker": `${p.nama_barang}${p.type ? " / " + p.type : ""}${p.maker ? " / " + p.maker : ""}`,
      Maker: p.maker,
      "Part Mesin": p.part_mesin,
      "Jumlah Order": p.qty_order,
      "Order Tanggal": p.order_tanggal,
      "Penawaran Tanggal": p.penawaran_date || "",
      "FB Penawaran Tanggal": p.nego_date || "",
      "AFA Tanggal": p.afa_date || "",
      "AFA No": p.afa_no || "",
      "PO Tanggal": p.po_date || "",
      "PO No": p.po_no || "",
      "Datang Tanggal": p.datang_date || "",
      "Datang No": p.datang_no || "",
      Status: p.status,
      Keterangan: p.keterangan || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    const filename = `Laporan-SparePart-${line}-${MONTHS_ID[month - 1]}-${year}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success("Excel berhasil di-download");
  };

  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Laporan Bulanan Spare Part", 14, 14);
    doc.setFontSize(10);
    doc.text(`Line: ${line}  •  Bulan: ${MONTHS_ID[month - 1]} ${year}  •  Total: ${report.total} part`, 14, 21);

    const head = [["No", "Nama Barang", "Maker", "Mesin", "Qty", "Order", "AFA", "PO", "Datang", "Status"]];
    const body = (report.items || []).map((p, i) => [
      i + 1,
      `${p.nama_barang}${p.type ? "\n" + p.type : ""}`,
      p.maker,
      p.part_mesin || "-",
      p.qty_order,
      p.order_tanggal,
      p.afa_no || "-",
      p.po_no || "-",
      p.datang_no || "-",
      p.status,
    ]);
    autoTable(doc, { head, body, startY: 26, styles: { fontSize: 8 }, headStyles: { fillColor: [37, 99, 235] } });

    const filename = `Laporan-SparePart-${line}-${MONTHS_ID[month - 1]}-${year}.pdf`;
    doc.save(filename);
    toast.success("PDF berhasil di-download");
  };

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Laporan Bulanan</h1>
        <p className="text-sm text-slate-500">Ringkasan permintaan spare part per bulan.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Line / Area</label>
            <select value={line} onChange={(e) => setLine(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="report-line">
              <option value="SEMUA">Semua</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Bulan</label>
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="report-month">
              {MONTHS_ID.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Tahun</label>
            <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="report-year">
              {Array.from({ length: 6 }).map((_, i) => {
                const y = now.getFullYear() - 3 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div>
            <button onClick={fetchReport} className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-testid="report-apply">Tampilkan</button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <Stat label="Total Request" value={report?.total ?? 0} color="text-slate-500" />
        <Stat label="AFA Process" value={report?.by_status?.["AFA PROCESS"] ?? 0} color="text-orange-600" />
        <Stat label="PO Process" value={report?.by_status?.["PO PROCESS"] ?? 0} color="text-blue-600" />
        <Stat label="Datang" value={report?.by_status?.DATANG ?? 0} color="text-emerald-600" />
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-4">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Ringkasan per Status</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-medium">No</th>
              <th className="px-4 py-3 text-left font-medium">Status Proses</th>
              <th className="px-4 py-3 text-left font-medium">Jumlah Part</th>
              <th className="px-4 py-3 text-left font-medium">Persentase</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_LIST.map((s, i) => {
              const count = report?.by_status?.[s] ?? 0;
              const total = report?.total || 0;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <tr key={s} className="border-t border-slate-100" data-testid={`report-status-${i}`}>
                  <td className="px-4 py-3 text-slate-700">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{s}</td>
                  <td className="px-4 py-3 text-slate-700">{count}</td>
                  <td className="px-4 py-3 text-slate-700">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={exportExcel} className="flex-1 md:flex-none border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="report-export-excel">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </button>
        <button onClick={exportPDF} className="flex-1 md:flex-none border border-red-200 text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2" data-testid="report-export-pdf">
          <FileText className="w-4 h-4" /> Export PDF
        </button>
      </div>

      {loading && <div className="text-center py-10 text-slate-400">Memuat...</div>}
    </AppShell>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{value}</div>
    </div>
  );
}
