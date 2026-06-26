# SMART-TC — Sparepart Monitoring and Request Tracking for TC Body

## Original Problem Statement (latest update — Feb 2026)
Internal app for **TC Body Maintenance** to monitor spare part requests from initial request → received. Replaces manual Excel. Stages: **Request → Penawaran → Nego → AFA → PO → Datang**. NOT inventory/warehouse/ERP.

## User Personas
- **Creator / Super Admin**: Cindy (NIK 32521) — manages users + edits any part.
- **Original Requestor** — can edit own request (audit-logged).
- **Other users** — read-only on others' parts, full create + stage-update rights.

## Core Requirements
1. NIK + password login (`123456` default), password change in app.
2. 7 production lines: PRESSING, WELDING, PAINTING, INJECTION, SEAT, ASSEMBLING, FINAL INSPECTION.
3. Status stored & indexed (computed from dates/numbers): REQUEST → PENAWARAN → NEGO → AFA PROCESS → PO PROCESS → DATANG.
4. Mandatory fields: line_area, nama_barang, type, maker, part_mesin, qty_order, order_tanggal, level_part (Critical/Substitusi/Stock).
5. Lampiran = status BELUM/DONE + tanggal penyerahan + catatan. **NOT file upload.** Auto-clears date when status reverts to BELUM, shows warning.
6. Foto Barang Datang = optional image upload (auto-compressed) with lightbox preview.
7. Signatures (Requestor + Approval) — **paste-only from Shokuin** via Ctrl+V. No file upload, no JPG/PNG upload, no digital stamp generation.
8. Edit after save: creator OR original requestor; audit log in `edit_history` (tracks only qty_order, level_part, lampiran_status, lampiran_date — per spec).
9. Friendly ErrorBoundary with Refresh/Logout + ERR-XXX code.
10. SMART-TC branding everywhere — login, sidebar header "TC BODY MAINTENANCE", browser title, footer, Excel/PDF exports.
11. Performance: stored status field, MongoDB indexes (status, level_part, line_area, order_tanggal), skip+limit pagination, server-side search.
12. URL-driven filters (back navigation preserves filter/page state automatically).
13. **Login always redirects to /dashboard** (home) regardless of previous page.
14. **Current Status Card** at top of detail page: status dot + prose ("Sedang Proses PO") + Last Update (DD MMMM YYYY · HH:MM WIB) + Updated By + action.

## What's Been Implemented (latest — 2026-06-26)
- Backend: `TRACKED_EDIT_FIELDS={qty_order, level_part, lampiran_status, lampiran_date}` filters edit_history. `updated_by={name,nik,action}` written on create/_update_stage/edit. Lampiran DONE→BELUM auto-clears `lampiran_date` server-side. 59+ tests pass.
- Frontend: SignaturePaste component (clipboard `onPaste` + focused document-level listener), `dateUtils.formatDateTimeWIB` (uses Intl `Asia/Jakarta`), Current Status Card with blue gradient, EditHistoryCard filtered + strikethrough/green styling, Lampiran warning when BELUM, Database page reordered columns + removed Action.
- Login: warehouse parts-bins background + always redirect to `/dashboard`.

## Prioritized Backlog
- **P1**: Bulk Excel import from legacy "Kontrol Order Part Assy & Seat" sheet.
- **P1**: Mobile-responsive drawer sidebar (currently desktop-only).
- **P2**: Weekly email digest of stuck parts (>14 days same stage).
- **P2**: "Days-in-stage" highlight in tables.
- **P3**: Split server.py into modules once >1000 LOC.

## Next Tasks
1. Bulk Excel import wizard.
2. Critical-parts heatmap on overview dashboard (was potential improvement from previous finish).
3. Mobile drawer sidebar.
