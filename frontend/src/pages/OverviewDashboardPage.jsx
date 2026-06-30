import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, AlertTriangle, RefreshCcw, FileText, FileCheck, ShoppingCart, Truck, X, Database } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { LINE_AREAS } from "@/constants/lines";
import { MONTHS_ID } from "@/constants/lines";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function OverviewDashboardPage() {
  const nav = useNavigate();
  const now = new Date();
  const [line, setLine] = useState("SEMUA");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [procurement, setProcurement] = useState({ total: 0, afa: 0, po: 0, datang: 0 });
  const [stockSummary, setStockSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [criticalOpen, setCriticalOpen] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const params = { month, year };
        if (line !== "SEMUA") params.line = line;
        const [proc, stock] = await Promise.all([
          api.get("/dashboard/summary", { params }),
          api.get("/stock/summary", { params: line !== "SEMUA" ? { line } : {} }),
        ]);
        setProcurement(proc.data.summary || { total: 0, afa: 0, po: 0, datang: 0 });
        setStockSummary(stock.data);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [line, month, year]);

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, []);

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">SMART-TC Dashboard</h1>
          <p className="text-sm text-slate-500">Ringkasan procurement bulan ini & aksi stock yang harus dilakukan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Line / Area" value={line} onChange={setLine} testId="dash-filter-line">
            <option value="SEMUA">Semua Line</option>
            {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
          </FilterSelect>
          <FilterSelect label="Bulan" value={month} onChange={(v) => setMonth(parseInt(v))} testId="dash-filter-month">
            {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </FilterSelect>
          <FilterSelect label="Tahun" value={year} onChange={(v) => setYear(parseInt(v))} testId="dash-filter-year">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </FilterSelect>
        </div>
      </div>

      {/* PROCUREMENT THIS MONTH */}
      <section className="mb-8" data-testid="dash-section-procurement">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Procurement Bulan Ini</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard testId="dash-stat-total" label="Total Request" value={procurement.total} icon={FileText} accent="slate" />
          <StatCard testId="dash-stat-afa" label="AFA Process" value={procurement.afa} icon={FileCheck} accent="orange" />
          <StatCard testId="dash-stat-po" label="PO Process" value={procurement.po} icon={ShoppingCart} accent="blue" />
          <StatCard testId="dash-stat-datang" label="Datang" value={procurement.datang} icon={Truck} accent="emerald" />
        </div>
      </section>

      {/* TOTAL PART PER LINE — only when specific line is selected */}
      {line !== "SEMUA" && (
        <section className="mb-8" data-testid="dash-section-total-part">
          <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Total Part — {line}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm" data-testid="dash-stat-total-part">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Part (Master Data)</div>
                  <div className="text-4xl font-bold text-blue-700 mt-2 tracking-tight tabular-nums">{loading ? "—" : (stockSummary?.total ?? 0)}</div>
                  <div className="text-xs text-slate-400 mt-1">Jumlah part terdaftar di {line}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Database className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* STOCK ACTION REQUIRED */}
      <section className="mb-8" data-testid="dash-section-stock">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Stock Action Required</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ActionCard
            testId="dash-stat-critical"
            label="Critical Part — Order Sekarang"
            value={stockSummary?.critical ?? 0}
            sub="Stock 0 & Level Critical"
            icon={AlertOctagon}
            accent="red"
            actionLabel="View All"
            onAction={() => setCriticalOpen(true)}
            loading={loading}
          />
          <ActionCard
            testId="dash-stat-low"
            label="Low Stock / Need Order"
            value={stockSummary?.need_order ?? 0}
            sub="LOW STOCK · CHECK SUBSTITUTE · MONITOR"
            icon={AlertTriangle}
            accent="amber"
            actionLabel="Lihat Master"
            onAction={() => nav("/master?status=LOW")}
            loading={loading}
          />
          <ActionCard
            testId="dash-stat-need-update"
            label="Need Update Stock"
            value={stockSummary?.need_update ?? 0}
            sub="Belum diisi current stock"
            icon={RefreshCcw}
            accent="slate"
            actionLabel="Lihat Master"
            onAction={() => nav("/master?status=NEED+UPDATE")}
            loading={loading}
          />
        </div>
      </section>

      <CriticalPartsModal
        open={criticalOpen}
        onClose={() => setCriticalOpen(false)}
        items={stockSummary?.critical_list || []}
        onRowClick={(m) => { setCriticalOpen(false); nav(`/master/${m.id}/movements`); }}
      />
    </AppShell>
  );
}

function FilterSelect({ label, value, onChange, children, testId }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
      >
        {children}
      </select>
    </div>
  );
}

const ACCENTS = {
  slate: { text: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500" },
  blue: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600" },
  orange: { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600" },
  emerald: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600" },
  red: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: "text-red-600" },
  amber: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600" },
};

function StatCard({ label, value, icon: Icon, accent = "slate", testId }) {
  const a = ACCENTS[accent];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="text-3xl font-bold text-slate-900 mt-3 tracking-tight tabular-nums">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${a.icon}`} />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ label, value, sub, icon: Icon, accent, actionLabel, onAction, testId, loading }) {
  const a = ACCENTS[accent];
  return (
    <div className={`bg-white rounded-2xl border ${a.border} p-5 shadow-sm flex flex-col`} data-testid={testId}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${a.icon}`} />
        </div>
        <button onClick={onAction} className={`text-xs font-semibold ${a.text} hover:underline`} data-testid={`${testId}-action`}>
          {actionLabel} →
        </button>
      </div>
      <div className="mt-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        <div className={`text-4xl font-bold ${a.text} mt-1 tracking-tight tabular-nums`}>{loading ? "—" : value}</div>
        <div className="text-xs text-slate-400 mt-1">{sub}</div>
      </div>
    </div>
  );
}

function CriticalPartsModal({ open, onClose, items, onRowClick }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="critical-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertOctagon className="w-5 h-5" /> Critical Parts — Order Sekarang
          </DialogTitle>
          <div className="text-xs text-slate-500">Level Part = Critical AND Current Stock = 0</div>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">Tidak ada critical part. Aman ✓</div>
          ) : (
            <table className="w-full text-sm" data-testid="critical-modal-table">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name Part</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Maker</th>
                  <th className="px-3 py-2 text-left font-medium">Line / Area</th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-left font-medium">Stock</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, i) => (
                  <tr key={m.id} onClick={() => onRowClick(m)} className="border-t border-slate-100 hover:bg-red-50 cursor-pointer" data-testid={`critical-row-${i}`}>
                    <td className="px-3 py-2 text-slate-900 font-medium">{m.part_name}</td>
                    <td className="px-3 py-2 text-slate-700">{m.type || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{m.maker || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{m.line_area}</td>
                    <td className="px-3 py-2 text-slate-700">{m.location || "-"}</td>
                    <td className="px-3 py-2 font-semibold text-red-600">{m.current_stock ?? "—"}</td>
                    <td className="px-3 py-2"><span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Order Sekarang</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5" data-testid="critical-modal-close">
            <X className="w-4 h-4" /> Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
