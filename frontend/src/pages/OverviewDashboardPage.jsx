import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, CheckCircle2, AlertTriangle, XCircle, FileText, FileCheck, ShoppingCart, Truck, PackageOpen, Database, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { LINE_AREAS, MONTHS_ID } from "@/constants/lines";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LocationDetailModal from "@/components/LocationDetailModal";

export default function OverviewDashboardPage() {
  const nav = useNavigate();
  const now = new Date();
  const [line, setLine] = useState("PLANT");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dash, setDash] = useState(null);
  const [stockSummary, setStockSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drilldown, setDrilldown] = useState({ open: false, card: null, title: "" });
  const [drillItems, setDrillItems] = useState({ loading: false, items: [] });
  const [stockDrill, setStockDrill] = useState({ open: false, key: null, title: "" });
  const [locModal, setLocModal] = useState({ open: false, part: null });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([
        api.get("/dashboard/summary", { params: { line, month, year } }),
        api.get("/stock/summary", { params: line === "PLANT" ? {} : { line } }),
      ]);
      setDash(d.data);
      setStockSummary(s.data);
    } finally { setLoading(false); }
  }, [line, month, year]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openDrilldown = async (card, title) => {
    setDrilldown({ open: true, card, title });
    setDrillItems({ loading: true, items: [] });
    try {
      const { data } = await api.get(`/dashboard/drilldown/${card}`, { params: { line, month, year } });
      setDrillItems({ loading: false, items: data.items || [] });
    } catch {
      setDrillItems({ loading: false, items: [] });
    }
  };

  const openStock = (key, title) => setStockDrill({ open: true, key, title });

  const proc = dash?.procurement || { total_request: 0, afa_reached: 0, remaining_request: 0, po_reached: 0, waiting_po: 0, datang_reached: 0, waiting_arrival: 0 };
  const mv = dash?.movements || { in_qty: 0, out_qty: 0 };

  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], []); // eslint-disable-line

  const stockLists = {
    good: stockSummary?.good_list || [],
    minimum: stockSummary?.minimum_list || [],
    zero: stockSummary?.zero_list || [],
    critical: stockSummary?.critical_list || [],
  };

  return (
    <AppShell>
      <div className="mb-5 animate-fade-up flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">SMART-TC Dashboard</h1>
          <p className="text-sm text-slate-500">Monitoring procurement & stock action.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Line / Area" value={line} onChange={setLine} testId="dash-filter-line">
            <option value="PLANT">Plant (All Line)</option>
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

      {/* PROCUREMENT CARDS */}
      <section className="mb-8" data-testid="dash-section-procurement">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Procurement — {MONTHS_ID[month - 1]} {year}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <ProgressCard
            testId="dash-total-request"
            label="Total Request"
            value={proc.total_request}
            icon={FileText}
            accent="slate"
            progress={{ current: proc.afa_reached, total: proc.total_request, label: `Sudah AFA` }}
            remaining={{ label: "Remaining", value: proc.remaining_request }}
            onClick={() => openDrilldown("total_request", `Total Request — ${line}`)}
            onRemainingClick={() => openDrilldown("remaining", "Remaining Request (Belum AFA)")}
          />
          <ProgressCard
            testId="dash-afa"
            label="AFA Process"
            value={proc.afa_reached}
            icon={FileCheck}
            accent="orange"
            progress={{ current: proc.po_reached, total: proc.afa_reached, label: `Sudah PO` }}
            remaining={{ label: "Waiting PO", value: proc.waiting_po }}
            onClick={() => openDrilldown("afa", "AFA Process")}
            onRemainingClick={() => openDrilldown("waiting_po", "Waiting PO")}
          />
          <ProgressCard
            testId="dash-po"
            label="PO Process"
            value={proc.po_reached}
            icon={ShoppingCart}
            accent="blue"
            progress={{ current: proc.datang_reached, total: proc.po_reached, label: `Sudah Arrival` }}
            remaining={{ label: "Waiting Arrival", value: proc.waiting_arrival }}
            onClick={() => openDrilldown("po", "PO Process")}
            onRemainingClick={() => openDrilldown("waiting_arrival", "Waiting Arrival")}
          />
          <QuantityCard
            testId="dash-arrival"
            label="Part Arrival (IN)"
            value={mv.in_qty}
            sub={`${dash?.movements?.in_count || 0} transaksi`}
            icon={Truck}
            accent="emerald"
            onClick={() => openDrilldown("arrival", `Part Arrival (IN) — ${MONTHS_ID[month - 1]} ${year}`)}
          />
          <QuantityCard
            testId="dash-out"
            label="Part Out (OUT)"
            value={mv.out_qty}
            sub={`${dash?.movements?.out_count || 0} transaksi`}
            icon={PackageOpen}
            accent="red"
            onClick={() => openDrilldown("out", `Part Out (OUT) — ${MONTHS_ID[month - 1]} ${year}`)}
          />
        </div>
      </section>
      
      {/* TOTAL PART — semua line maupun specific line */}
      <section className="mb-8" data-testid="dash-section-total-part">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
          Total Part — {line === "PLANT" ? "ALL LINE" : line}
          </h2>
          
          <div
            className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm w-full md:w-1/2"
            data-testid="dash-stat-total-part"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Part (Master Data)
                </div>
                
                <div className="text-4xl font-bold text-blue-700 mt-2 tracking-tight tabular-nums">
                  {loading ? "—" : (stockSummary?.total ?? 0)}
                </div>
                  
                <div className="text-xs text-slate-400 mt-1">
                  Jumlah part terdaftar di {line === "PLANT" ? "seluruh line" : line}
                </div>
              </div>

      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
        <Database className="w-5 h-5 text-blue-600" />
      </div>
    </div>
  </div>
</section>

      {/* STOCK ACTION REQUIRED */}
      <section className="mb-8" data-testid="dash-section-stock">
        <h2 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Stock Action Required{line !== "PLANT" ? ` — ${line}` : ""}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionCard testId="dash-stat-good" label="Part Good" value={stockSummary?.good ?? 0}
            sub="Min Stock ≤ Current Stock ≤ Max Stock" icon={CheckCircle2} accent="emerald"
            onClick={() => openStock("good", "Part Good — Current Stock > Minimum")} loading={loading} />
          <ActionCard testId="dash-stat-minimum" label="Part Minimum" value={stockSummary?.minimum ?? 0}
            sub="Current Stock ≤ Min Stock" icon={AlertTriangle} accent="amber"
            onClick={() => openStock("minimum", "Part Minimum — Perlu Order Segera")} loading={loading} />
          <ActionCard testId="dash-stat-zero" label="Part Zero" value={stockSummary?.zero ?? 0}
            sub="Current Stock = 0" icon={XCircle} accent="red"
            onClick={() => openStock("zero", "Part Zero — Stock Habis")} loading={loading} />
        </div>
      </section>

      {/* DRILLDOWN MODALS */}
      <DrilldownModal
        open={drilldown.open}
        title={drilldown.title}
        card={drilldown.card}
        items={drillItems.items}
        loading={drillItems.loading}
        onClose={() => setDrilldown({ open: false, card: null, title: "" })}
        onRowClick={(item) => {
          setDrilldown({ open: false, card: null, title: "" });
          if (item.id && !item.type) nav(`/parts/${item.id}`); // parts row
          else if (item.master_part_id) nav(`/master/${item.master_part_id}/movements`);
        }}
      />

      <StockDrillModal
        open={stockDrill.open}
        title={stockDrill.title}
        items={stockLists[stockDrill.key] || []}
        variant={stockDrill.key}
        onClose={() => setStockDrill({ open: false, key: null, title: "" })}
        onLocClick={(m) => setLocModal({ open: true, part: m })}
      />

      <LocationDetailModal open={locModal.open} part={locModal.part} onClose={() => setLocModal({ open: false, part: null })} />
    </AppShell>
  );
}

function FilterSelect({ label, value, onChange, children, testId }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]">
        {children}
      </select>
    </div>
  );
}

const ACCENTS = {
  slate: { text: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", bar: "bg-slate-600" },
  blue: { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-600", bar: "bg-blue-600" },
  orange: { text: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", icon: "text-orange-600", bar: "bg-orange-500" },
  emerald: { text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", bar: "bg-emerald-600" },
  red: { text: "text-red-700", bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", bar: "bg-red-500" },
  amber: { text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", bar: "bg-amber-500" },
  "red-solid": { text: "text-white", bg: "bg-red-600", border: "border-red-700", icon: "text-white", bar: "bg-white/40" },
};

function ProgressCard({ label, value, icon: Icon, accent, progress, remaining, onClick, onRemainingClick, testId }) {
  const a = ACCENTS[accent];
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0;
  return (
    <button onClick={onClick} data-testid={testId}
      className="text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${a.icon}`} />
        </div>
        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600">DETAIL →</span>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${a.text} mt-1 tabular-nums`}>{value}</div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
          <span>{progress.label}</span>
          <span className="tabular-nums font-semibold">{progress.current} / {progress.total}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${a.bar} transition-all duration-700 ease-out`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] text-slate-500">{remaining.label}</span>
        <span
          onClick={(e) => { e.stopPropagation(); onRemainingClick && onRemainingClick(); }}
          className="text-sm font-bold text-slate-900 tabular-nums hover:text-blue-600 cursor-pointer"
          data-testid={`${testId}-remaining`}
        >{remaining.value}</span>
      </div>
    </button>
  );
}

function QuantityCard({ label, value, sub, icon: Icon, accent, onClick, testId }) {
  const a = ACCENTS[accent];
  return (
    <button onClick={onClick} data-testid={testId}
      className="text-left bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${a.icon}`} />
        </div>
        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-600">DETAIL →</span>
      </div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-3xl font-bold ${a.text} mt-1 tabular-nums`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-2">{sub}</div>
    </button>
  );
}

function ActionCard({ label, value, sub, icon: Icon, accent, onClick, testId, loading }) {
  const a = ACCENTS[accent];
  const isSolid = accent === "red-solid";
  return (
    <button onClick={onClick} data-testid={testId}
      className={`text-left rounded-2xl border p-5 shadow-sm hover:shadow-lg transition-all group focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isSolid ? "bg-red-600 border-red-700 hover:bg-red-700" : "bg-white border-slate-200 hover:border-blue-300"
      }`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl ${isSolid ? "bg-white/20" : a.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${isSolid ? "text-white" : a.icon}`} />
        </div>
      </div>
      <div className={`text-[11px] font-semibold uppercase tracking-wider ${isSolid ? "text-red-100" : "text-slate-500"}`}>{label}</div>
      <div className={`text-4xl font-bold mt-1 tabular-nums ${isSolid ? "text-white" : a.text}`}>{loading ? "—" : value}</div>
      <div className={`text-[11px] mt-1.5 ${isSolid ? "text-red-100" : "text-slate-400"}`}>{sub}</div>
    </button>
  );
}

// ---- Drilldown modals ----
function DrilldownModal({ open, title, card, items, loading, onClose, onRowClick }) {
  const isMovement = card === "arrival" || card === "out";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="drilldown-modal">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          {loading && <div className="text-center py-8 text-slate-400">Memuat...</div>}
          {!loading && items.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">Tidak ada data.</div>}
          {!loading && items.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  {isMovement ? (<>
                    <th className="px-3 py-2 text-left font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-left font-medium">Line</th>
                    <th className="px-3 py-2 text-left font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Catatan</th>
                    <th className="px-3 py-2 text-left font-medium">Actor</th>
                  </>) : (<>
                    <th className="px-3 py-2 text-left font-medium">Nama Barang</th>
                    <th className="px-3 py-2 text-left font-medium">Type</th>
                    <th className="px-3 py-2 text-left font-medium">Maker</th>
                    <th className="px-3 py-2 text-left font-medium">Line</th>
                    <th className="px-3 py-2 text-left font-medium">Qty</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                  </>)}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id || i} onClick={() => onRowClick && onRowClick(it)} className="border-t border-slate-100 hover:bg-blue-50 cursor-pointer" data-testid={`drill-row-${i}`}>
                    {isMovement ? (<>
                      <td className="px-3 py-2 text-slate-700">{it.date}</td>
                      <td className="px-3 py-2 text-slate-700">{it.line_area}</td>
                      <td className={`px-3 py-2 tabular-nums font-semibold ${it.type === "IN" ? "text-emerald-600" : "text-red-600"}`}>{it.type === "IN" ? "+" : "−"}{it.quantity}</td>
                      <td className="px-3 py-2 text-slate-500 max-w-[280px] truncate">{it.note || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{it.actor || "-"}</td>
                    </>) : (<>
                      <td className="px-3 py-2 text-slate-900 font-medium max-w-[240px] truncate">{it.nama_barang}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[160px] truncate">{it.type || "-"}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate">{it.maker || "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{it.line_area}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{it.qty_order}</td>
                      <td className="px-3 py-2 text-slate-600">{it.status}</td>
                    </>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StockDrillModal({ open, title, items, variant, onClose, onLocClick }) {
  const isCritical = variant === "critical";
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col" data-testid="stock-drill-modal">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${isCritical ? "text-red-700" : ""}`}>
            {isCritical && <AlertOctagon className="w-5 h-5" />}
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">Tidak ada data.</div>
          ) : (
            <table className="w-full text-sm" data-testid="stock-drill-table">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name Part</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-left font-medium">Maker</th>
                  <th className="px-3 py-2 text-left font-medium">Line / Area</th>
                  <th className="px-3 py-2 text-left font-medium">Location</th>
                  <th className="px-3 py-2 text-right font-medium">Current Stock</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-3 py-2 text-left font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, i) => (
                  <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50" data-testid={`stock-drill-row-${i}`}>
                    <td className="px-3 py-2 text-slate-900 font-medium max-w-[260px] truncate">{m.part_name}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">{m.type || "-"}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[140px] truncate">{m.maker || "-"}</td>
                    <td className="px-3 py-2 text-slate-700">{m.line_area}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {m.location ? (
                        <button onClick={() => onLocClick(m)} className="text-blue-600 hover:underline text-xs font-mono" data-testid={`stock-drill-loc-${i}`}>{m.location}</button>
                      ) : <span className="text-slate-400">-</span>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${m.current_stock === 0 ? "text-red-600" : ""}`}>{m.current_stock ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{m.minimum_stock ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.level_part === "Critical" ? "bg-red-100 text-red-700" :
                        m.level_part === "Substitusi" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}>{m.level_part}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button onClick={onClose} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5" data-testid="stock-drill-close">
            <X className="w-4 h-4" /> Tutup
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
