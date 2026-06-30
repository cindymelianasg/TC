# SMART-TC — Sparepart Monitoring & Request Tracking

## Original Problem
SMART-TC adalah aplikasi internal pabrik untuk monitor progress permintaan spare part (Request → Penawaran → Nego → AFA → PO → Datang).
Bukan inventory/stock management system, melainkan progress tracker untuk maintenance team.

## User Personas
- **Creator (Cindy Meliana)**: full CRUD, kelola user, semua data.
- **Supervisor/Foreman**: lihat data, ajukan request, update progress untuk request mereka.

## Core Requirements
- Login pakai NIK
- Tracking progress per stage dengan tanggal & nomor dokumen
- Master Data spare part dengan klasifikasi Level Part (Critical / Substitusi / Stock)
- Auto-IN movement saat Datang stage diisi → update stock master
- Manual OUT movement & reverse OUT saat request dihapus
- Filter & monitoring per Line/Area

## Architecture
- Backend: FastAPI + MongoDB (motor async) di /app/backend
- Frontend: React + Tailwind + Shadcn UI di /app/frontend
- Auth: JWT bearer token, password hashed via bcrypt
- File uploads via GridFS

## What's Implemented (latest first)

### Major Revision (Iteration 3) — Feb 2026
- **Dashboard redesign** (/dashboard): Filter Line/Bulan/Tahun + Procurement This Month cards (Total, AFA, PO, Datang) + Stock Action Required cards (Critical Part w/ View All popup, Low Stock/Need Order, Need Update).
- **Critical Parts Modal** popup table (Name, Type, Maker, Line, Location, Stock, Status).
- **Master Data** (/master): Pagination 20/40/80/100 (default 20). 3 search fields (Name, Type, Maker). Filter Line, Level, Status (Aman/Low/Critical/Need Update). **Inline editable Location** (icon MapPin). Removed Warning column.
- **Request Form** (/parts/new): Autocomplete Name/Type/Maker terhubung ke Master Data. Cascade filter. "Part not found" dialog → Tambahkan ke Master / Tetap simpan / Batal.
- **Delete Request** dengan reverse stock: DeleteDialog menampilkan stock impact via GET /spare-parts/{id}/stock-impact. Saat confirm → backend DELETE + create OUT adjustment + decrement master.current_stock. Histori movement preserved.
- **IN / OUT History page** (/history): 2 ResumeCard (IN/OUT) dengan Total Transaksi & Total Quantity per bulan/line.
- **Sidebar refresh**: Removed "Data Sparepart"; added "IN / OUT History".
- **Stock action logic**:
  - Critical + stock 0 → "ORDER SEKARANG!!!"
  - Substitusi + stock 0 → "CHECK SUBSTITUTE"
  - Stock + stock 0 → "MONITOR"
  - cs=null → "NEED UPDATE"; cs<2 → "LOW STOCK"; else "AMAN"
- **Auto-IN on Datang**: PATCH /spare-parts/{id}/datang trigger _try_auto_in() saat datang_date+datang_no diisi.

### Iteration 2 — Master Data import + IN/OUT
- Import Excel (xlsx) ke Master Data
- Manual OUT movements
- Movement monthly report endpoint

### Iteration 1 — Core flows
- Auth (NIK+password JWT)
- 7 LINE_AREAS (Pressing, Welding, Painting, Injection, Seat, Assembling & FI)
- CRUD spare parts dengan stages
- File uploads (foto part, ttd) + signature paste

## Backlog
- P1: Export Excel/PDF dari Master Data & Monthly Report dengan formatting
- P1: Move /dashboard/summary aggregation ke MongoDB $facet (saat data > 5000 rows)
- P2: Split server.py jadi modules (auth, parts, master, movements, dashboard)
- P2: Master Data status filter di backend (saat ini client-side after pagination)
- P2: Push notifications saat ada Critical Part baru

## Iteration 4 — Line/Area Migration Fix + Master Reset (Feb 2026)
- Strict validation: VALID_LINE_AREAS = [PRESSING, WELDING, PAINTING, INJECTION, SEAT, ASSEMBLING & FI]. Reject ASSEMBLING/FI/FINAL INSPECTION di POST/PUT /master-parts dan import preview/save.
- Removed silent migration di `normalize_line()` & `lineFromKey()` — invalid values dipertahankan apa adanya supaya UI bisa surface migration warning.
- New endpoint: DELETE /api/master-parts-admin/reset-all (Creator) — wipe all master_parts + movements.
- New endpoint: GET /api/master-parts-admin/invalid-lines — count + samples of invalid line_area entries.
- Migration warning banner di Master Data page dengan count, samples, dan Reset link.
- Reset Master Data dialog dengan "Type RESET to confirm" pattern.
- Edit Master Dialog: preserve invalid value as flagged option (⚠ ASSEMBLING (invalid)), tampilkan inline warning, block Simpan.
- Dashboard: section "Total Part — {line}" hanya muncul saat specific line dipilih (hidden saat Semua).
- Form Request: text "ke supervisor" → "ke atasan".
- All 17 backend tests pass (test_smart_tc_v4.py).
