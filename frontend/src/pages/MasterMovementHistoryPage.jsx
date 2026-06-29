import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import AppShell from "@/components/AppShell";
import { api } from "@/lib/api";
import { formatDateID } from "@/lib/dateUtils";

export default function MasterMovementHistoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [part, setPart] = useState(null);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get(`/master-parts/${id}`), api.get(`/master-parts/${id}/movements`)])
      .then(([p, mv]) => { setPart(p.data); setMovements(mv.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AppShell><div className="text-center py-20 text-slate-400">Memuat...</div></AppShell>;
  if (!part) return <AppShell><div className="text-center py-20 text-slate-400">Tidak ditemukan</div></AppShell>;

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => nav("/master")} className="p-2 rounded-lg hover:bg-slate-100" data-testid="movement-back"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{part.part_name}</h1>
          <p className="text-xs text-slate-500">{part.type} · {part.maker} · {part.line_area} · Stock saat ini: <strong>{part.current_stock ?? "—"}</strong></p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="text-sm font-semibold text-slate-700 mb-3">Movement History ({movements.length})</div>
        {movements.length === 0 ? (
          <div className="text-sm text-slate-400 py-8 text-center">Belum ada IN/OUT untuk part ini.</div>
        ) : (
          <ul className="space-y-3">
            {movements.map((m) => (
              <li key={m.id} className="flex items-start gap-3 p-3 border border-slate-100 rounded-lg" data-testid={`movement-${m.id}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${m.type === "IN" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
                  {m.type === "IN" ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">
                      {m.type} <span className={m.type === "IN" ? "text-emerald-700" : "text-orange-700"}>{m.type === "IN" ? "+" : "-"}{m.quantity} pcs</span>
                    </div>
                    <div className="text-xs text-slate-500">{formatDateID(m.date)}</div>
                  </div>
                  {m.no_datang && <div className="text-xs text-slate-500">No Datang: {m.no_datang}</div>}
                  <div className="text-xs text-slate-500">{m.line_area} · oleh {m.actor}</div>
                  {m.note && <div className="text-xs text-slate-600 mt-0.5">{m.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
