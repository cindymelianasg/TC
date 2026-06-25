import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, RefreshCw, FileText, ShoppingCart, Truck, FileCheck, FileSignature, Tag } from "lucide-react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { lineFromSlug, MONTHS_ID } from "@/constants/lines";

const STAGES = [
  { key: "REQUEST", label: "Request", icon: FileText, color: "bg-slate-200 text-slate-700" },
  { key: "PENAWARAN", label: "Penawaran", icon: FileSignature, color: "bg-sky-200 text-sky-700" },
  { key: "NEGO", label: "Nego", icon: Tag, color: "bg-yellow-200 text-yellow-700" },
  { key: "AFA PROCESS", label: "AFA", icon: FileCheck, color: "bg-orange-200 text-orange-700" },
  { key: "PO PROCESS", label: "PO", icon: ShoppingCart, color: "bg-blue-200 text-blue-700" },
  { key: "DATANG", label: "Datang", icon: Truck, color: "bg-emerald-200 text-emerald-700" },
];

function StatCard({ label, value, color, testId }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm" data-testid={testId}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</div>
      <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{value}</div>
    </div>
  );
}

export default function DashboardLinePage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const line = lineFromSlug(slug);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!line) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/dashboard/${slug}`, { params: { month, year } });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [line, slug, month, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!line) {
    return (
      <AppShell>
        <div className="text-center py-20 text-slate-500">Line tidak ditemukan.</div>
      </AppShell>
    );
  }

  const Icon = line.icon;
  const summary = data?.summary || {};

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 animate-fade-up">
        <div className="flex items-center gap-4">
          <button onClick={() => nav("/area")} className="p-2 rounded-lg hover:bg-slate-100" data-testid="back-to-area">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className={`w-12 h-12 rounded-xl ${line.bg} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${line.color}`} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900" data-testid="dashboard-line-title">{line.key} LINE</h1>
            <p className="text-sm text-slate-500">Monitoring bulanan — {MONTHS_ID[month - 1]} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} data-testid="dashboard-month" className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
            {MONTHS_ID.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} data-testid="dashboard-year" className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
            {Array.from({ length: 6 }).map((_, i) => {
              const y = now.getFullYear() - 3 + i;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
          <button onClick={fetchData} className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50" data-testid="dashboard-refresh">
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => nav(`/parts/new?line=${line.slug}`)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="dashboard-add-btn">
            <Plus className="w-4 h-4" /> Tambah Data
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Part Request" value={summary.total ?? 0} color="text-slate-500" testId="stat-total" />
        <StatCard label="AFA Process" value={summary.afa ?? 0} color="text-orange-600" testId="stat-afa" />
        <StatCard label="PO Process" value={summary.po ?? 0} color="text-blue-600" testId="stat-po" />
        <StatCard label="Datang" value={summary.datang ?? 0} color="text-emerald-600" testId="stat-datang" />
      </div>

      {/* Process Flow */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-700 mb-4">Alur Proses</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const key = s.key === "AFA PROCESS" ? "afa" : s.key === "PO PROCESS" ? "po" : s.key.toLowerCase();
            const count = summary[key] ?? 0;
            return (
              <div key={s.key} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center min-w-[88px]">
                  <div className={`w-12 h-12 rounded-full ${s.color} flex items-center justify-center font-semibold`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-medium text-slate-700 mt-2">{s.label}</div>
                  <div className="text-xs text-slate-400">{count} part</div>
                </div>
                {i < STAGES.length - 1 && <div className="w-8 h-px bg-slate-300" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="dashboard-table">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">Data Bulan Ini ({MONTHS_ID[month - 1]} {year})</div>
          <div className="text-xs text-slate-500">{(data?.items || []).length} entri</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">No</th>
                <th className="px-4 py-3 text-left font-medium">Nama Barang / Type</th>
                <th className="px-4 py-3 text-left font-medium">Maker</th>
                <th className="px-4 py-3 text-left font-medium">Part Mesin</th>
                <th className="px-4 py-3 text-left font-medium">Qty</th>
                <th className="px-4 py-3 text-left font-medium">AFA No</th>
                <th className="px-4 py-3 text-left font-medium">PO No</th>
                <th className="px-4 py-3 text-left font-medium">No Datang</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Memuat...</td></tr>
              )}
              {!loading && (data?.items || []).length === 0 && (
                <tr><td colSpan={9} className="text-center py-10 text-slate-400">Belum ada data untuk bulan ini.</td></tr>
              )}
              {!loading && (data?.items || []).map((p, i) => (
                <tr key={p.id} onClick={() => nav(`/parts/${p.id}`, { state: { from: "dashboard", slug } })} className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors" data-testid={`dashboard-row-${i}`}>
                  <td className="px-4 py-3 text-slate-700">{i + 1}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    <div>{p.nama_barang}</div>
                    {p.type && <div className="text-xs text-slate-500">{p.type}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{p.maker}</td>
                  <td className="px-4 py-3 text-slate-700">{p.part_mesin || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.qty_order}</td>
                  <td className="px-4 py-3 text-slate-700">{p.afa_no || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.po_no || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">{p.datang_no || "-"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
