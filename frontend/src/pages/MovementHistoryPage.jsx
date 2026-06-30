import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowUpToLine, Activity, Calendar } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { LINE_AREAS, MONTHS_ID } from "@/constants/lines";
import { formatDateID } from "@/lib/dateUtils";

export default function MovementHistoryPage() {
  const nav = useNavigate();
  const now = new Date();
  const [line, setLine] = useState("SEMUA");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month, year };
      if (line !== "SEMUA") params.line = line;
      const { data } = await api.get("/reports/movement-monthly", { params });
      setReport(data);
    } finally {
      setLoading(false);
    }
  }, [line, month, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">IN / OUT History</h1>
          <p className="text-sm text-slate-500">Resume transaksi stock per bulan & line.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Sel label="Line" value={line} onChange={setLine} testId="hist-line">
            <option value="SEMUA">Semua</option>
            {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
          </Sel>
          <Sel label="Bulan" value={month} onChange={(v) => setMonth(parseInt(v))} testId="hist-month">
            {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Sel>
          <Sel label="Tahun" value={year} onChange={(v) => setYear(parseInt(v))} testId="hist-year">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </Sel>
        </div>
      </div>

      {/* Resume Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <ResumeCard
          title="IN — Masuk Stock"
          icon={ArrowUpToLine}
          accent="emerald"
          count={report?.in?.count ?? 0}
          qty={report?.in?.total_qty ?? 0}
          testId="hist-card-in"
          loading={loading}
        />
        <ResumeCard
          title="OUT — Keluar Stock"
          icon={ArrowDownToLine}
          accent="red"
          count={report?.out?.count ?? 0}
          qty={report?.out?.total_qty ?? 0}
          testId="hist-card-out"
          loading={loading}
        />
      </div>

      {/* Recent transactions */}
      <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Transaksi Bulan {MONTHS_ID[month - 1]} {year}</h2>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="hist-table">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Tanggal</th>
                <th className="px-3 py-3 text-left font-medium">Type</th>
                <th className="px-3 py-3 text-left font-medium">Line</th>
                <th className="px-3 py-3 text-left font-medium">Qty</th>
                <th className="px-3 py-3 text-left font-medium">Catatan</th>
                <th className="px-3 py-3 text-left font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {!loading && report && [...(report.in?.items || []), ...(report.out?.items || [])].length === 0 && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Tidak ada transaksi pada periode ini.</td></tr>
              )}
              {!loading && report && [...(report.in?.items || []), ...(report.out?.items || [])]
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .slice(0, 100)
                .map((m, i) => (
                  <tr key={m.id || i} onClick={() => m.master_part_id && nav(`/master/${m.master_part_id}/movements`)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" data-testid={`hist-row-${i}`}>
                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDateID(m.date)}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.type === "IN" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                      }`}>
                        {m.type === "IN" ? <ArrowUpToLine className="w-3 h-3" /> : <ArrowDownToLine className="w-3 h-3" />}
                        {m.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{m.line_area}</td>
                    <td className={`px-3 py-2.5 font-semibold tabular-nums ${m.type === "IN" ? "text-emerald-600" : "text-red-600"}`}>{m.type === "IN" ? "+" : "−"}{m.quantity}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[360px] truncate">{m.note || "-"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.actor || "-"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

const RESUME_ACCENTS = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "text-emerald-600" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-600" },
};

function ResumeCard({ title, icon: Icon, accent, count, qty, testId, loading }) {
  const a = RESUME_ACCENTS[accent];
  return (
    <div className={`bg-white rounded-2xl border ${a.border} p-5 shadow-sm`} data-testid={testId}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${a.icon}`} />
          </div>
          <div>
            <div className={`text-sm font-semibold ${a.text}`}>{title}</div>
            <div className="text-xs text-slate-500">Resume bulan ini</div>
          </div>
        </div>
        <Activity className="w-4 h-4 text-slate-300" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Transaksi</div>
          <div className={`text-3xl font-bold ${a.text} tabular-nums mt-1`}>{loading ? "—" : count}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Quantity</div>
          <div className={`text-3xl font-bold ${a.text} tabular-nums mt-1`}>{loading ? "—" : qty}</div>
        </div>
      </div>
    </div>
  );
}

function Sel({ label, value, onChange, children, testId }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]">
        {children}
      </select>
    </div>
  );
}
