import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertOctagon, AlertTriangle, RefreshCcw } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";

export default function OverviewDashboardPage() {
  const nav = useNavigate();
  const now = new Date();
  const [lineStats, setLineStats] = useState([]);
  const [stockSummary, setStockSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const month = now.getMonth() + 1;
      const year = now.getFullYear();
      const results = await Promise.all(
        LINE_AREAS.map(async (l) => {
          try {
            const { data } = await api.get(`/dashboard/${l.slug}`, { params: { month, year } });
            return { line: l, summary: data.summary };
          } catch {
            return { line: l, summary: { total: 0, afa: 0, po: 0, datang: 0 } };
          }
        })
      );
      setLineStats(results);
      try {
        const { data } = await api.get("/stock/summary");
        setStockSummary(data);
      } catch { /* ignore */ }
      setLoading(false);
    };
    fetchAll();
  }, []);

  const grand = lineStats.reduce((acc, s) => ({
    total: acc.total + (s.summary.total || 0),
    afa: acc.afa + (s.summary.afa || 0),
    po: acc.po + (s.summary.po || 0),
    datang: acc.datang + (s.summary.datang || 0),
  }), { total: 0, afa: 0, po: 0, datang: 0 });

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">SMART-TC Dashboard</h1>
        <p className="text-sm text-slate-500">Ringkasan procurement & stock monitoring.</p>
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Procurement Bulan Ini</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Total Request" value={grand.total} color="text-slate-500" />
        <Stat label="AFA Process" value={grand.afa} color="text-orange-600" />
        <Stat label="PO Process" value={grand.po} color="text-blue-600" />
        <Stat label="Datang" value={grand.datang} color="text-emerald-600" />
      </div>

      {stockSummary && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Stock Monitoring</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Total Part" value={stockSummary.total} color="text-slate-500" icon={Package} />
            <Stat label="Critical Part" value={stockSummary.critical} color="text-red-600" icon={AlertOctagon} />
            <Stat label="Need Order" value={stockSummary.need_order} color="text-orange-600" icon={AlertTriangle} />
            <Stat label="Need Update Stock" value={stockSummary.need_update} color="text-slate-500" icon={RefreshCcw} />
          </div>

          {stockSummary.critical_list?.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 overflow-hidden shadow-sm mb-6" data-testid="critical-list-card">
              <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
                <div className="text-sm font-semibold text-red-700 flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> Critical Parts — Order Immediately</div>
                <button onClick={() => nav("/master?level=Critical")} className="text-xs text-red-700 hover:underline font-semibold">Lihat semua</button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Part Name</th>
                    <th className="px-4 py-2 text-left font-medium">Line</th>
                    <th className="px-4 py-2 text-left font-medium">Stock</th>
                    <th className="px-4 py-2 text-left font-medium">Min</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stockSummary.critical_list.slice(0, 10).map((m) => (
                    <tr key={m.id} onClick={() => nav(`/master/${m.id}/movements`)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                      <td className="px-4 py-2 text-slate-900 font-medium">{m.part_name}</td>
                      <td className="px-4 py-2 text-slate-700">{m.line_area}</td>
                      <td className="px-4 py-2 font-semibold text-red-600">{m.current_stock ?? "—"}</td>
                      <td className="px-4 py-2 text-slate-600">{m.minimum_stock ?? 0}</td>
                      <td className="px-4 py-2"><span className="text-xs font-semibold text-red-700">{m.stock_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Per Line</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {lineStats.map((s) => {
          const Icon = s.line.icon;
          return (
            <button key={s.line.key} onClick={() => nav(`/line/${s.line.slug}`)} data-testid={`overview-line-${s.line.slug}`}
              className="text-left bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${s.line.bg} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${s.line.color}`} />
                </div>
                <div className="text-sm font-bold text-slate-900">{s.line.key}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Mini label="Total" value={s.summary.total} cls="text-slate-700" />
                <Mini label="AFA" value={s.summary.afa} cls="text-orange-600" />
                <Mini label="PO" value={s.summary.po} cls="text-blue-600" />
                <Mini label="Datang" value={s.summary.datang} cls="text-emerald-600" />
              </div>
            </button>
          );
        })}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color, icon: Icon }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className={`text-xs font-semibold uppercase tracking-wider ${color}`}>{label}</div>
        {Icon && <Icon className={`w-4 h-4 ${color}`} />}
      </div>
      <div className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{value}</div>
    </div>
  );
}
function Mini({ label, value, cls }) {
  return (
    <div className="p-2 rounded-lg bg-slate-50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-base font-bold ${cls}`}>{value || 0}</div>
    </div>
  );
}
