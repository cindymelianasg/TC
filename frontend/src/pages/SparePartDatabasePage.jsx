import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { LINE_AREAS, MONTHS_ID, STATUS_LIST } from "@/constants/lines";

export default function SparePartDatabasePage() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const line = params.get("line") || "SEMUA";
  const month = params.get("month") || "";
  const year = params.get("year") || "";
  const status = params.get("status") || "SEMUA";
  const levelPart = params.get("level") || "SEMUA";
  const q = params.get("q") || "";
  const page = parseInt(params.get("page") || "1", 10);
  const pageSize = 10;

  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(q);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === "" || v === null || v === undefined) next.delete(k);
    else next.set(k, v);
    if (k !== "page") next.set("page", "1");
    setParams(next);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/spare-parts", {
        params: {
          line, status, q,
          level_part: levelPart === "SEMUA" ? undefined : levelPart,
          month: month || undefined,
          year: year || undefined,
          page, page_size: pageSize,
        },
      });
      setData(data);
    } finally {
      setLoading(false);
    }
  }, [line, status, q, levelPart, month, year, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil((data.total || 0) / pageSize));

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">List Data Sparepart</h1>
          <p className="text-sm text-slate-500">Riwayat lengkap permintaan spare part semua line.</p>
        </div>
        <button onClick={() => nav(`/parts/new`)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5" data-testid="database-add-btn">
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Line / Area</label>
            <select value={line} onChange={(e) => setParam("line", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="filter-line">
              <option value="SEMUA">Semua</option>
              {LINE_AREAS.map((l) => <option key={l.key} value={l.key}>{l.key}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Bulan</label>
            <select value={month} onChange={(e) => setParam("month", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="filter-month">
              <option value="">Semua</option>
              {MONTHS_ID.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Tahun</label>
            <select value={year} onChange={(e) => setParam("year", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="filter-year">
              <option value="">Semua</option>
              {Array.from({ length: 6 }).map((_, i) => {
                const y = new Date().getFullYear() - 3 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Status</label>
            <select value={status} onChange={(e) => setParam("status", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="filter-status">
              <option value="SEMUA">Semua</option>
              {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Level Part</label>
            <select value={levelPart} onChange={(e) => setParam("level", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white" data-testid="filter-level">
              <option value="SEMUA">Semua</option>
              <option value="Critical">Critical</option>
              <option value="Substitusi">Substitusi</option>
              <option value="Stock">Stock</option>
            </select>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setParam("q", searchInput); }}
            className="relative"
          >
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Cari</label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-[34px]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari part, maker..."
              data-testid="filter-search"
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm bg-white"
            />
          </form>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm" data-testid="database-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-3 text-left font-medium">No</th>
                <th className="px-3 py-3 text-left font-medium">Nama Barang / Type / Maker</th>
                <th className="px-3 py-3 text-left font-medium">Maker</th>
                <th className="px-3 py-3 text-left font-medium">Part Mesin</th>
                <th className="px-3 py-3 text-left font-medium">Qty</th>
                <th className="px-3 py-3 text-left font-medium">Order Tgl</th>
                <th className="px-3 py-3 text-left font-medium">Lampiran</th>
                <th className="px-3 py-3 text-left font-medium">Tgl Lampiran</th>
                <th className="px-3 py-3 text-left font-medium">No AFA</th>
                <th className="px-3 py-3 text-left font-medium">Tgl AFA</th>
                <th className="px-3 py-3 text-left font-medium">No PO</th>
                <th className="px-3 py-3 text-left font-medium">Tgl PO</th>
                <th className="px-3 py-3 text-left font-medium">No Datang</th>
                <th className="px-3 py-3 text-left font-medium">Tgl Datang</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={15} className="text-center py-10 text-slate-400">Memuat...</td></tr>
              )}
              {!loading && data.items.length === 0 && (
                <tr><td colSpan={15} className="text-center py-10 text-slate-400">Tidak ada data ditemukan.</td></tr>
              )}
              {!loading && data.items.map((p, i) => (
                <tr key={p.id} onClick={() => nav(`/parts/${p.id}`, { state: { from: "database" } })} className="border-t border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors" data-testid={`database-row-${i}`}>
                  <td className="px-3 py-3 text-slate-700">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-3 py-3 text-slate-900 font-medium max-w-[260px]">
                    <div className="truncate">{p.nama_barang}{p.type ? ` / ${p.type}` : ""}</div>
                    <div className="text-xs text-slate-400 truncate">{p.line_area} · {p.level_part || "-"}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{p.maker}</td>
                  <td className="px-3 py-3 text-slate-700">{p.part_mesin || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.qty_order}</td>
                  <td className="px-3 py-3 text-slate-700">{p.order_tanggal}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs font-semibold ${p.lampiran_status === "DONE" ? "text-emerald-700" : "text-slate-500"}`}>{p.lampiran_status || "BELUM"}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{p.lampiran_date || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.afa_no || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.afa_date || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.po_no || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.po_date || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.datang_no || "-"}</td>
                  <td className="px-3 py-3 text-slate-700">{p.datang_date || "-"}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 text-sm">
          <div className="text-slate-500">
            Menampilkan {data.items.length === 0 ? 0 : (page - 1) * pageSize + 1}-{(page - 1) * pageSize + data.items.length} dari {data.total} data
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setParam("page", String(page - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" data-testid="page-prev">‹</button>
            <span className="px-3 py-1.5 rounded-md bg-blue-600 text-white font-semibold" data-testid="page-current">{page}</span>
            <span className="text-slate-400">/ {totalPages}</span>
            <button onClick={() => setParam("page", String(page + 1))} disabled={page >= totalPages} className="px-3 py-1.5 rounded-md border border-slate-200 disabled:opacity-40" data-testid="page-next">›</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
