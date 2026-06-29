# SMART-TC — Sparepart Monitoring & Request Tracking for TC Body

## Modules (after v1.1 — June 2026)

### 1. Procurement Tracking (existing, unchanged)
Request → Penawaran → Nego → AFA → PO → Datang. NIK login, per-line dashboards, monthly report.

### 2. Master Data & Part Movement Monitoring (NEW)
- **MasterPart** collection: `{part_name, type, maker, line_area, current_stock (Optional[int]), minimum_stock, level_part, reff, location}`. Unique key = `part_name + type + maker + line_area`.
- **Stock semantics**: `current_stock = null` ⇒ `NEED UPDATE`; `0` ⇒ `NO STOCK`; `<= minimum_stock` ⇒ `BELOW MIN`; else `OK`.
- **Warnings**: Critical+no/below/null ⇒ `CRITICAL` (red, Order Immediately); Substitusi+no/below ⇒ `CHECK_SUBSTITUTE`; below min ⇒ `BELOW_MIN`.
- **Excel import wizard** (client-side parsing with `xlsx`):
  - Parses sheet with `NAME OF PART` header. Splits "Name/Type/Maker" by `/`. Picks rightmost `STOCK` column for current_stock.
  - 3-step UI: Upload → Preview (sheet picker + row inspection) → Validate (new/duplicate/invalid count + skip/update conflict resolution).
- **Movements** collection: `{type: IN|OUT, master_part_id, spare_part_id?, date, quantity, no_datang?, line_area, actor, note}`.
- **Auto-IN trigger**: when stage update `/spare-parts/{id}/datang` succeeds with `datang_date`+`datang_no`, backend looks up matching master_part. If found, creates IN movement + increments stock. If not found, returns `auto_in.reason` warning. Idempotent (1 IN per spare_part_id).
- **OUT** manual via dialog from Master Data page — decrements stock with validation (can't go negative).
- **Movement history** page per master part.
- **Permission**: creator-only mutations (create/edit/delete master, import). Anyone can view + create OUT.

## Endpoints (new)
- `GET /api/master-parts` (filters: line, level_part, status, q, page) – paginated via skip+limit, indexed.
- `GET /api/master-parts/{id}` · `POST /api/master-parts` · `PUT /api/master-parts/{id}` (with edit history) · `DELETE`
- `GET /api/master-parts/{id}/movements`
- `POST /api/master-parts/import/preview` → returns rows with `_status: NEW|DUPLICATE|INVALID`.
- `POST /api/master-parts/import/save` → bulk insert with conflict_resolution (skip|update).
- `POST /api/movements/out` · `GET /api/movements` (paginated).
- `GET /api/stock/summary` (total, critical, need_order, need_update, no_stock, below_min, critical_list).
- `GET /api/reports/movement-monthly`.

## Frontend (new)
- `/master` — MasterDataPage (filter, edit, delete, OUT button per row).
- `/master/import` — 3-step Excel import wizard, parses `Sample Master part Gudang Assy body 2026` Excel format (NO.REFF, NAME OF PART slash-separated, LOCATION, Min, multi-period Stock).
- `/master/:id/movements` — IN/OUT history timeline with IN↗ + OUT↘ icons + qty deltas.
- **Dashboard upgraded**: 4 new Stock Monitoring stat cards + red "Critical Parts — Order Immediately" table when any exist.
- **Sidebar**: new "Master Data" item.

## Indexes (added)
- `master_parts: (line_area, part_name)`, `(line_area, level_part)`, `part_name`
- `movements: (master_part_id, date desc)`, `(line_area, type, date desc)`

## Backlog (P1+)
- Movement monthly report UI page (backend endpoint exists).
- Stock filter applied as URL query (currently in-component state).
- Critical-parts pulsing alert on dashboard cards.
- Bulk Excel import for procurement legacy data (separate Excel from master).

## Next Tasks
1. Build dedicated Stock Monitor page using `/api/reports/movement-monthly` with IN/OUT charts.
2. Filter critical-list by line on the dashboard card.
3. Mobile responsive drawer.
