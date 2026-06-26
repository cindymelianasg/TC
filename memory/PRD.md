# SMART-TC — Sparepart Monitoring and Request Tracking for TC Body
**Renamed from "Spare Part Control System" — official name effective from v1.0**

## Original Problem Statement (latest update — Feb 2026)
Internal application for TC Body Maintenance Division to monitor and track spare part requests from initial request until receipt. Replaces manual Excel tracking. Lets leaders answer "Where is this spare part now?" instantly. Procurement timeline stages: **Request → Penawaran → Nego → AFA → PO → Datang**.

This is NOT inventory/warehouse/purchasing/ERP. It IS a **Spare Part Request Monitoring & Tracking System**.

## User Personas
- **Creator / Super Admin**: Cindy Meliana Sari Gunawan (NIK 32521) — manages users + edits any part.
- **Original Requestor**: can edit only their own request after save (audit-logged).
- **Other authenticated users**: read-only on others' parts, full create + stage-update rights.

## Core Requirements (current static set)
1. NIK + password login, default `123456`, in-app password change.
2. 7 production lines: PRESSING, WELDING, PAINTING, INJECTION, SEAT, ASSEMBLING, FINAL INSPECTION.
3. Stages: REQUEST → PENAWARAN → NEGO → AFA PROCESS → PO PROCESS → DATANG. Status now **stored** on document for indexed querying (computed via `compute_status`).
4. Mandatory fields: line_area, nama_barang, type, maker, part_mesin, qty_order, order_tanggal, **level_part (Critical/Substitusi/Stock)**.
5. Lampiran = status enum (BELUM/DONE) + tanggal penyerahan + catatan (NOT file upload).
6. Foto Barang Datang = optional image upload (auto-compressed) with lightbox preview.
7. Edit after save: creator OR original requestor; all changes audit-logged in `edit_history`.
8. Friendly ErrorBoundary with Refresh/Logout actions and ERR-XXX code.
9. Brand: SMART-TC across login, sidebar, browser title, footer, Excel/PDF exports.
10. Performance: server-side filters/search/pagination via MongoDB skip+limit + indexes on status, level_part, line_area, order_tanggal.

## What's Been Implemented (latest run — 2026-02-26)
- **Backend** (`server.py`, ~810 lines): SparePartEdit model, PATCH `/spare-parts/{id}` with permission gating + audit history, stored status field with compute_status, new fields (level_part enum, lampiran_status enum, edit_history), startup backfill migration, indexes: line_area, status, level_part, (line_area,status), order_tanggal, requestor_id. 59/59 backend tests pass (37 iter1 + 22 iter2).
- **Frontend**: SMART-TC branding (Logo component, sidebar header "TC BODY MAINTENANCE", browser title, login page, footer); ErrorBoundary; Lightbox; image compression (canvas-based, ≥600KB); FileUploader with progress; full required-field validation with red borders + inline "Field ini wajib diisi." + auto-scroll to first invalid; Level Part dropdown + filter; Lampiran status pill; EditInfoDialog gated by role/requestor; EditHistoryCard with field-by-field diff; FotoDatangCard with thumbnails → Lightbox; new "Data Sparepart" sidebar link.

## Prioritized Backlog
- **P1**: Bulk Excel import from legacy "Kontrol Order Part Assy & Seat" sheet.
- **P1**: Mobile responsive drawer sidebar.
- **P2**: Weekly email digest of stuck parts (>14 days same stage) to Section Head.
- **P2**: Inline "days-in-stage" highlight in tables (visually flag bottlenecks).
- **P2**: Logout flow in detail page should redirect to /login (testing agent noted manual workaround).
- **P3**: Split server.py into modules (auth, users, parts, files) once it exceeds ~1000 LOC.
- **P3**: Backend `Field(min_length=1)` defensive validation for required strings (frontend already validates).

## Next Tasks
1. Confirm visual approval of SMART-TC branding & login background with user.
2. Build bulk Excel import wizard.
3. Mobile sidebar drawer.
