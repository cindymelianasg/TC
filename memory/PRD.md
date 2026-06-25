# Spare Part Control System — PRD

## Original Problem Statement
A full-stack internal maintenance spare part tracking system for Suzuki manufacturing. It replaces manual Excel tracking and lets maintenance leaders answer "Where is this spare part right now?" through the procurement timeline: **Request → Penawaran → Nego → AFA → PO → Datang**. NOT inventory / stock / purchasing — only progress monitoring. Bahasa Indonesia UI, NIK-based login.

## User Personas
- **Creator / Super Admin**: Cindy Meliana Sari Gunawan (NIK 32521). Sole user able to manage (add/edit/delete/reset) users and delete spare parts.
- **Maintenance leaders & PIC** (14 other seeded users): can create requests, update Penawaran/AFA/PO/Datang, view all parts, run monthly reports, but cannot edit user list.

## Core Requirements (static)
1. NIK + password login (default `123456`).
2. 7 production lines: PRESSING, WELDING, PAINTING, INJECTION, SEAT, ASSEMBLING, FINAL INSPECTION.
3. Spare part tracking with stages: REQUEST → PENAWARAN → NEGO → AFA PROCESS → PO PROCESS → DATANG. Status is **derived** from stored dates/numbers (no separate status field).
4. No price / no stock / no approval workflow. Digital stamp uploadable per part.
5. File uploads (Foto Part, Drawing, Spesifikasi, TTD Requestor, TTD Approval, Foto Datang) via **Emergent Managed Object Storage**.
6. Browser-back must preserve list filter/page state (achieved via URL search params).
7. Monthly report with Excel (xlsx) + PDF (jsPDF) export.
8. Only Cindy can mutate user list.

## What's Been Implemented (1st finish — 2026-06-25)
### Backend (`/app/backend/server.py`)
- JWT auth (12h tokens) using NIK as the identifier (`/api/auth/login`, `/me`, `/change-password`, `/logout`).
- 15 seeded users with default password `123456`; Cindy auto-marked `role=creator`.
- User CRUD (`/api/users` and `/api/users/{id}` and `/reset-password`) — mutations creator-only.
- Spare parts CRUD (`/api/spare-parts`) with stage-update endpoints (`/penawaran`, `/afa`, `/po`, `/datang`, `/stamp`). Each update appends an entry to `history[]` for full audit trail.
- File upload/download (`/api/files/upload`, `/api/files/{id}`) backed by Emergent Object Storage. Supports `?auth=` query param for `<img>` tag display.
- Dashboard line (`/api/dashboard/{slug}`) and monthly report (`/api/reports/monthly`).
- Status precedence: DATANG > PO PROCESS > AFA PROCESS > NEGO > PENAWARAN > REQUEST.
- 37/37 pytest tests passing (100%).

### Frontend (React + Tailwind + shadcn/ui)
- IBM Plex Sans typography, dark navy sidebar + white content (per design guidelines).
- Pages: Login, Overview Dashboard, Line/Area, Dashboard Line, Spare Part Database (filters + pagination + URL state), Spare Part Detail (timeline + lampiran + digital stamp), Form Request, Update Process (modal with 4 tabs), User Management (Cindy-only edit), Monthly Report (with xlsx + jsPDF export), Settings (change password).
- Auth context, ProtectedRoute, AuthFileImage (blob-fetch for protected images), FileUploader (multi-file + single).
- Status badges with proper colour mapping (REQUEST/PENAWARAN/NEGO/AFA PROCESS/PO PROCESS/DATANG).
- Toast notifications via `sonner`.

## Prioritized Backlog (P0/P1/P2)

### P1 — short-term polish
- Allow editing basic spare-part fields (nama_barang, qty, etc.) after creation (currently only stage updates).
- Audit log timeline view per part (history is stored, not displayed).
- Bulk Excel **import** from existing Excel "Kontrol Order Part Assy dan Seat" — preserve legacy data.
- Email/in-app notification when a part transitions to Datang or stays >X days in same stage.

### P2 — nice-to-have
- Charts on overview dashboard (stages funnel, line comparison).
- Photo signature pad (draw with mouse/touch) as alternative to upload.
- "Stuck items" automatic detection (parts > 30 days in same stage).
- Per-user activity log + admin user search/filter.
- Mobile-responsive sidebar (currently hidden on lg screens; provide drawer for tablet).

## Next Tasks
1. Bulk import wizard from Excel (most likely next user need).
2. Add inline editor for basic part fields.
3. Display `history[]` timeline on the Detail page (already captured server-side).
