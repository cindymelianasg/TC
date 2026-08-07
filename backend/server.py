from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal, Dict, Any

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Query, Response, Header
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict

# -------------------------------------------------------------------
# Setup & Constants
# -------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = os.environ.get('APP_NAME', 'spare-part-control')
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
DEFAULT_PASSWORD = os.environ.get('DEFAULT_PASSWORD', '123456')
CREATOR_NIK = os.environ.get('CREATOR_NIK', '32521')

LINE_AREAS = ["PRESSING", "WELDING", "PAINTING", "INJECTION", "SEAT", "ASSEMBLING & FI"]
VALID_LINE_AREAS = set(LINE_AREAS)
RANK_OPTIONS = ["SEC.HEAD", "SUPERVISOR", "SENIOR FOREMAN", "FOREMAN", "PELAKSANA"]

# ---- Suzuki Location Code Parser (SOP: OPL PENOMORAN RAK GUDANG) ----
# Format: [XX Gudang][XX Rak][XX Tingkat][L|R Sisi][XX Urutan]  → 9 chars
LOCATION_SECTION_MAP = {
    "10": "Pressing",
    "20": "Welding",
    "30": "Painting Body",
    "40": "Central Maintenance / Assembling, FI & Common Part",
    "50": "Resin (Injection & Painting Bumper)",
    "60": "Seat",
}
LOCATION_SIDE_MAP = {"L": "Posisi Kiri (Left)", "R": "Posisi Kanan (Right)"}

def parse_location_code(code: Optional[str]) -> Dict[str, Any]:
    """Decode Suzuki 9-char location code into structured fields."""
    if not code:
        return {"raw": code, "valid": False, "reason": "kosong"}
    c = str(code).strip().upper()
    if len(c) != 9:
        return {"raw": code, "valid": False, "reason": f"Panjang kode {len(c)} (harus 9 karakter)"}
    section = c[0:2]
    rack = c[2:4]
    tingkat = c[4:6]
    sisi = c[6:7]
    urutan = c[7:9]
    return {
        "raw": c,
        "valid": True,
        "gudang": {"code": section, "name": LOCATION_SECTION_MAP.get(section, "Unknown Section")},
        "rak": {"code": rack, "label": f"Rak No. {int(rack)}" if rack.isdigit() else rack},
        "tingkat": {"code": tingkat, "label": f"Tingkat/Susunan ke No. {int(tingkat)}" if tingkat.isdigit() else tingkat},
        "sisi": {"code": sisi, "label": LOCATION_SIDE_MAP.get(sisi, sisi)},
        "urutan": {"code": urutan, "label": f"Barisan No. {int(urutan)}" if urutan.isdigit() else urutan},
    }

def normalize_line(line: Optional[str]) -> Optional[str]:
    """Normalise for query filtering only. Does NOT silently migrate legacy values.
    Use validate_line_area() for write operations to reject invalid values."""
    if not line:
        return line
    return line.upper().strip()

def validate_line_area(line: Optional[str]) -> str:
    """Strict validation for create/update/import. Raises 422 if invalid."""
    if not line:
        raise HTTPException(422, "Line/Area wajib diisi")
    u = line.upper().strip()
    if u not in VALID_LINE_AREAS:
        raise HTTPException(422, f"Line/Area '{line}' tidak valid. Pilih salah satu: {', '.join(LINE_AREAS)}")
    return u

INITIAL_USERS = [
    {"name": "ZULKIFLI", "email": "zulkifli@suzuki.co.id", "nik": "6282", "rank": "SEC.HEAD", "area": "TC BODY"},
    {"name": "HERI IRAWAN", "email": "heri.irawan@suzuki.co.id", "nik": "19376", "rank": "SUPERVISOR", "area": "TC BODY"},
    {"name": "EKA AGUS ERAWILUTA", "email": "eka.agus@suzuki.co.id", "nik": "18195", "rank": "SUPERVISOR", "area": "TC BODY"},
    {"name": "DIDIK LUKITO", "email": "didik.lukito@suzuki.co.id", "nik": "8899", "rank": "SUPERVISOR", "area": "PRESSING & WELDING"},
    {"name": "HARWANTO TRI PITOYO", "email": "Harwanto.Pitoyo@suzuki.co.id", "nik": "6737", "rank": "SENIOR FOREMAN", "area": "ASSEMBLING, FI & SEAT"},
    {"name": "AHMAD ROHMAN", "email": "ahmad.Rohman@suzuki.co.id", "nik": "6118", "rank": "SUPERVISOR", "area": "ADMIN TC BODY"},
    {"name": "AFIF NAUFAL FAUZAN", "email": "afif.fauzan@suzuki.co.id", "nik": "28403", "rank": "FOREMAN", "area": "PAINTING & INJECTION"},
    {"name": "ZAQI AZKA ARMANDA M.", "email": "zaqi.azka@suzuki.co.id", "nik": "30771", "rank": "FOREMAN", "area": "PAINTING"},
    {"name": "HERI DARWANTO", "email": "heri.darwanto@suzuki.co.id", "nik": "8803", "rank": "FOREMAN", "area": "SEAT"},
    {"name": "BUDI YUNANTO", "email": "budi.yunanto@suzuki.co.id", "nik": "6429", "rank": "FOREMAN", "area": "INJECTION"},
    {"name": "AFIQ RAKA PRADIPTA", "email": "afiq.raka@suzuki.co.id", "nik": "32523", "rank": "PELAKSANA", "area": "PRESSING"},
    {"name": "BAGAS NUR SUSANTO", "email": "bagas.susanto@suzuki.co.id", "nik": "32511", "rank": "PELAKSANA", "area": "WELDING"},
    {"name": "CINDY MELIANA SARI GUNAWAN", "email": "cindy.meliana@suzuki.co.id", "nik": "32521", "rank": "PELAKSANA", "area": "ASSEMBLING & FI"},
    {"name": "FAHREZA ALDRYAN MAULANA", "email": "fahreza.aldryan@suzuki.co.id", "nik": "32522", "rank": "PELAKSANA", "area": "INJECTION"},
    {"name": "SUGIYANTO", "email": "sugiyanto@suzuki.co.id", "nik": "19561", "rank": "PELAKSANA", "area": "ADMIN TC BODY"},
]

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------
TRACKED_EDIT_FIELDS = {"qty_order", "level_part", "lampiran_status", "lampiran_date"}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, nik: str, role: str) -> str:
    payload = {
        "sub": user_id, "nik": nik, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def strip_user(u: dict) -> dict:
    if not u:
        return u
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u

def compute_status(part: dict) -> str:
    if part.get("datang_date") and part.get("datang_no"):
        return "DATANG"
    if part.get("po_date") and part.get("po_no"):
        return "PO PROCESS"
    if part.get("afa_date") and part.get("afa_no"):
        return "AFA PROCESS"
    if part.get("nego_date"):
        return "NEGO"
    if part.get("penawaran_date"):
        return "PENAWARAN"
    return "REQUEST"

def part_with_status(part: dict) -> dict:
    if not part:
        return part
    part = dict(part)
    part.pop("_id", None)
    part["status"] = compute_status(part)
    return part

# -------------------------------------------------------------------
# Storage (Emergent Managed Object Storage)
# -------------------------------------------------------------------
storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY not set, storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 403:
        # refresh
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not initialized")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    if resp.status_code == 403:
        global storage_key
        storage_key = None
        key = init_storage()
        resp = requests.get(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key}, timeout=60,
        )
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="File not found")
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

MIME_BY_EXT = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp", "pdf": "application/pdf",
}

# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------
class LoginRequest(BaseModel):
    nik: str
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserCreate(BaseModel):
    name: str
    email: str
    nik: str
    rank: str
    area: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    nik: Optional[str] = None
    rank: Optional[str] = None
    area: Optional[str] = None

class FileRef(BaseModel):
    id: str
    path: str
    filename: str
    content_type: str

class SparePartCreate(BaseModel):
    line_area: str
    nama_barang: str
    type: str
    maker: str
    part_mesin: str
    qty_order: int = 1
    order_tanggal: str  # ISO date string YYYY-MM-DD
    level_part: str  # "Critical" | "Substitusi" | "Stock"
    keterangan: Optional[str] = ""
    lampiran_status: Optional[str] = "BELUM"  # "BELUM" | "DONE"
    lampiran_date: Optional[str] = None
    lampiran_note: Optional[str] = ""
    foto_part: List[FileRef] = []
    ttd_requestor: Optional[FileRef] = None
    ttd_approval: Optional[FileRef] = None

class SparePartEdit(BaseModel):
    line_area: Optional[str] = None
    nama_barang: Optional[str] = None
    type: Optional[str] = None
    maker: Optional[str] = None
    part_mesin: Optional[str] = None
    qty_order: Optional[int] = None
    order_tanggal: Optional[str] = None
    level_part: Optional[str] = None
    keterangan: Optional[str] = None
    lampiran_status: Optional[str] = None
    lampiran_date: Optional[str] = None
    lampiran_note: Optional[str] = None
    foto_part: Optional[List[FileRef]] = None
    ttd_requestor: Optional[FileRef] = None
    ttd_approval: Optional[FileRef] = None

class PenawaranUpdate(BaseModel):
    penawaran_date: Optional[str] = None
    penawaran_note: Optional[str] = ""
    nego_date: Optional[str] = None
    nego_note: Optional[str] = ""

class AFAUpdate(BaseModel):
    afa_date: Optional[str] = None
    afa_no: Optional[str] = ""
    afa_note: Optional[str] = ""

class POUpdate(BaseModel):
    po_date: Optional[str] = None
    po_no: Optional[str] = ""
    po_note: Optional[str] = ""

class DatangUpdate(BaseModel):
    datang_date: Optional[str] = None
    datang_no: Optional[str] = ""
    datang_note: Optional[str] = ""
    foto_datang: List[FileRef] = []

class StampUpdate(BaseModel):
    stamp_file: Optional[FileRef] = None

# -------------------------------------------------------------------
# FastAPI App & Auth
# -------------------------------------------------------------------
app = FastAPI(title="SMART-TC — Sparepart Monitoring and Request Tracking")
api_router = APIRouter(prefix="/api")

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return strip_user(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_creator(user: dict):
    if user.get("role") != "creator":
        raise HTTPException(status_code=403, detail="Only Creator can perform this action")

# -------------------------------------------------------------------
# Startup
# -------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("nik", unique=True)
    await db.users.create_index("email")
    await db.spare_parts.create_index("line_area")
    await db.spare_parts.create_index("status")
    await db.spare_parts.create_index("level_part")
    await db.spare_parts.create_index([("line_area", 1), ("status", 1)])
    await db.spare_parts.create_index([("order_tanggal", -1)])
    await db.spare_parts.create_index("requestor_id")
    await db.master_parts.create_index([("line_area", 1), ("part_name", 1)])
    await db.master_parts.create_index([("line_area", 1), ("level_part", 1)])
    await db.master_parts.create_index("part_name")
    await db.movements.create_index([("master_part_id", 1), ("date", -1)])
    await db.movements.create_index([("line_area", 1), ("type", 1), ("date", -1)])
    await db.files.create_index("path", unique=True)

    # Init storage
    init_storage()

    # Seed users
    existing = await db.users.count_documents({})
    if existing == 0:
        for u in INITIAL_USERS:
            role = "creator" if u["nik"] == CREATOR_NIK else "user"
            doc = {
                "id": str(uuid.uuid4()),
                "name": u["name"],
                "email": u["email"],
                "nik": u["nik"],
                "rank": u["rank"],
                "area": u["area"],
                "role": role,
                "password_hash": hash_password(DEFAULT_PASSWORD),
                "must_change_password": False,
                "created_at": now_iso(),
            }
            await db.users.insert_one(doc)
        logger.info(f"Seeded {len(INITIAL_USERS)} initial users")

    # One-time backfill for parts missing new fields
    await db.spare_parts.update_many(
        {"status": {"$exists": False}},
        [{"$set": {"status": "REQUEST"}}],
    )
    await db.spare_parts.update_many(
        {"level_part": {"$exists": False}},
        {"$set": {"level_part": "Stock"}},
    )
    await db.spare_parts.update_many(
        {"lampiran_status": {"$exists": False}},
        {"$set": {"lampiran_status": "BELUM", "lampiran_date": None, "lampiran_note": ""}},
    )
    await db.spare_parts.update_many(
        {"edit_history": {"$exists": False}},
        {"$set": {"edit_history": []}},
    )
    # Recompute status for any docs whose status is stale vs date fields
    async for doc in db.spare_parts.find({}, {"penawaran_date": 1, "nego_date": 1, "afa_date": 1, "afa_no": 1, "po_date": 1, "po_no": 1, "datang_date": 1, "datang_no": 1, "status": 1, "id": 1}):
        expected = compute_status(doc)
        if doc.get("status") != expected:
            await db.spare_parts.update_one({"id": doc["id"]}, {"$set": {"status": expected}})

# -------------------------------------------------------------------
# Auth Endpoints
# -------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    user = await db.users.find_one({"nik": payload.nik})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="NIK atau password salah")
    token = create_access_token(user["id"], user["nik"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": strip_user(user)}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user=Depends(get_current_user)):
    db_user = await db.users.find_one({"id": user["id"]})
    if not verify_password(payload.current_password, db_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password saat ini salah")
    if len(payload.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password baru minimal 4 karakter")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "must_change_password": False}}
    )
    return {"ok": True}

@api_router.post("/auth/logout")
async def logout():
    return {"ok": True}

# -------------------------------------------------------------------
# User Management Endpoints
# -------------------------------------------------------------------
@api_router.get("/users")
async def list_users(user=Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    users.sort(key=lambda x: x.get("nik", ""))
    return users

@api_router.post("/users")
async def create_user(payload: UserCreate, user=Depends(get_current_user)):
    require_creator(user)
    existing = await db.users.find_one({"nik": payload.nik})
    if existing:
        raise HTTPException(status_code=400, detail="NIK sudah terdaftar")
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email,
        "nik": payload.nik,
        "rank": payload.rank,
        "area": payload.area,
        "role": "user",
        "password_hash": hash_password(DEFAULT_PASSWORD),
        "must_change_password": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return strip_user(doc)

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, payload: UserUpdate, user=Depends(get_current_user)):
    require_creator(user)
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "nik" in update_data and update_data["nik"] != existing["nik"]:
        other = await db.users.find_one({"nik": update_data["nik"]})
        if other:
            raise HTTPException(status_code=400, detail="NIK sudah terdaftar")
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    updated = await db.users.find_one({"id": user_id})
    return strip_user(updated)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user=Depends(get_current_user)):
    require_creator(user)
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus akun sendiri")
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if target.get("role") == "creator":
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus Creator")
    await db.users.delete_one({"id": user_id})
    return {"ok": True}

@api_router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, user=Depends(get_current_user)):
    require_creator(user)
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(DEFAULT_PASSWORD), "must_change_password": True}}
    )
    return {"ok": True, "default_password": DEFAULT_PASSWORD}

# -------------------------------------------------------------------
# File Upload / Download
# -------------------------------------------------------------------
@api_router.post("/files/upload")
async def upload_file(file: UploadFile = File(...), user=Depends(get_current_user)):
    filename = file.filename or "upload.bin"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    content_type = file.content_type or MIME_BY_EXT.get(ext, "application/octet-stream")
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/uploads/{user['id']}/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File terlalu besar (max 10MB)")
    result = put_object(path, data, content_type)
    doc = {
        "id": file_id,
        "path": result["path"],
        "filename": filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "user_id": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    }
    await db.files.insert_one(doc)
    return {"id": file_id, "path": result["path"], "filename": filename, "content_type": content_type}

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, auth: Optional[str] = Query(None), authorization: Optional[str] = Header(None)):
    # accept token via header or query (img tags can't send headers)
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.files.find_one({"id": file_id, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(record["path"])
    return Response(content=data, media_type=record.get("content_type") or ct)

# -------------------------------------------------------------------
# Spare Parts Endpoints
# -------------------------------------------------------------------
@api_router.get("/spare-parts")
async def list_spare_parts(
    line: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    level_part: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
    user=Depends(get_current_user),
):
    """Server-side filter + paginate. Uses stored `status` field for index efficiency."""
    query: Dict[str, Any] = {}
    if line and line.upper() != "SEMUA":
        query["line_area"] = line.upper()
    if status and status.upper() != "SEMUA":
        query["status"] = status.upper()
    if level_part and level_part != "SEMUA":
        query["level_part"] = level_part
    if month and year:
        m = f"{int(month):02d}"
        query["order_tanggal"] = {"$regex": f"^{int(year)}-{m}"}
    elif year:
        query["order_tanggal"] = {"$regex": f"^{int(year)}-"}
    if q:
        query["$or"] = [
            {"nama_barang": {"$regex": q, "$options": "i"}},
            {"maker": {"$regex": q, "$options": "i"}},
            {"part_mesin": {"$regex": q, "$options": "i"}},
            {"type": {"$regex": q, "$options": "i"}},
            {"afa_no": {"$regex": q, "$options": "i"}},
            {"po_no": {"$regex": q, "$options": "i"}},
            {"datang_no": {"$regex": q, "$options": "i"}},
        ]

    total = await db.spare_parts.count_documents(query)
    skip = max(0, (page - 1) * page_size)
    cursor = (
        db.spare_parts.find(query, {"_id": 0})
        .sort("order_tanggal", -1)
        .skip(skip)
        .limit(page_size)
    )
    items = await cursor.to_list(page_size)
    enriched = [part_with_status(p) for p in items]
    return {"items": enriched, "total": total, "page": page, "page_size": page_size}

@api_router.get("/spare-parts/{part_id}")
async def get_spare_part(part_id: str, user=Depends(get_current_user)):
    part = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")
    return part_with_status(part)

@api_router.post("/spare-parts")
async def create_spare_part(payload: SparePartCreate, user=Depends(get_current_user)):
    # Validate level_part enum
    valid_levels = {"Critical", "Substitusi", "Stock"}
    if payload.level_part not in valid_levels:
        raise HTTPException(status_code=422, detail="Level Part harus salah satu: Critical, Substitusi, Stock")
    if payload.lampiran_status and payload.lampiran_status not in {"BELUM", "DONE"}:
        raise HTTPException(status_code=422, detail="Lampiran status harus BELUM atau DONE")

    part_id = str(uuid.uuid4())
    doc = payload.model_dump()
    doc["line_area"] = doc["line_area"].upper()
    doc["id"] = part_id
    doc["requestor_id"] = user["id"]
    doc["requestor_name"] = user["name"]
    doc["requestor_nik"] = user["nik"]
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    # Init process fields
    doc["penawaran_date"] = None
    doc["penawaran_note"] = ""
    doc["nego_date"] = None
    doc["nego_note"] = ""
    doc["afa_date"] = None
    doc["afa_no"] = ""
    doc["afa_note"] = ""
    doc["po_date"] = None
    doc["po_no"] = ""
    doc["po_note"] = ""
    doc["datang_date"] = None
    doc["datang_no"] = ""
    doc["datang_note"] = ""
    doc["foto_datang"] = []
    doc["stamp_file"] = None
    doc["status"] = "REQUEST"  # Stored, indexable
    doc["updated_by"] = {"name": user["name"], "nik": user["nik"], "action": "Request dibuat"}
    # Audit log
    doc["history"] = [{
        "stage": "REQUEST",
        "date": doc["order_tanggal"],
        "actor": user["name"],
        "actor_nik": user["nik"],
        "timestamp": now_iso(),
    }]
    doc["edit_history"] = []
    await db.spare_parts.insert_one(doc)
    return part_with_status(doc)

@api_router.patch("/spare-parts/{part_id}")
async def edit_spare_part(part_id: str, payload: SparePartEdit, user=Depends(get_current_user)):
    """Edit basic part fields. Permission: creator OR original requestor."""
    part = await db.spare_parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")
    is_creator = user.get("role") == "creator"
    is_requestor = part.get("requestor_id") == user["id"]
    if not (is_creator or is_requestor):
        raise HTTPException(status_code=403, detail="Hanya creator atau requestor asli yang dapat mengedit request ini")

    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "level_part" in update_data and update_data["level_part"] not in {"Critical", "Substitusi", "Stock"}:
        raise HTTPException(status_code=422, detail="Level Part tidak valid")
    if "lampiran_status" in update_data and update_data["lampiran_status"] not in {"BELUM", "DONE"}:
        raise HTTPException(status_code=422, detail="Lampiran status harus BELUM atau DONE")
    if "line_area" in update_data:
        update_data["line_area"] = update_data["line_area"].upper()
    # Lampiran logic: DONE -> BELUM clears the submission date automatically
    if update_data.get("lampiran_status") == "BELUM":
        update_data["lampiran_date"] = None
    if not update_data:
        return part_with_status({**part})

    # Track changed fields (only display-tracked subset goes into edit_history)
    changes = []
    for k, v in update_data.items():
        if k not in TRACKED_EDIT_FIELDS:
            continue
        old_val = part.get(k)
        if old_val != v:
            changes.append({"field": k, "old": old_val, "new": v})

    update_data["updated_at"] = now_iso()
    update_data["updated_by"] = {"name": user["name"], "nik": user["nik"], "action": "Edit Info"}
    ops = {"$set": update_data}
    if changes:
        edit_entry = {
            "actor": user["name"],
            "actor_nik": user["nik"],
            "timestamp": now_iso(),
            "changes": changes,
        }
        ops["$push"] = {"edit_history": edit_entry}
    await db.spare_parts.update_one({"id": part_id}, ops)
    updated = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
    return part_with_status(updated)

async def _update_stage(part_id: str, stage: str, fields: dict, user: dict):
    part = await db.spare_parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")
    fields = {k: v for k, v in fields.items() if v is not None}
    fields["updated_at"] = now_iso()
    # Compute new status based on merged fields
    merged = {**part, **fields}
    fields["status"] = compute_status(merged)
    fields["updated_by"] = {"name": user["name"], "nik": user["nik"], "action": f"Update {stage}"}
    history_entry = {
        "stage": stage,
        "date": fields.get(f"{stage.lower()}_date") or now_iso()[:10],
        "actor": user["name"],
        "actor_nik": user["nik"],
        "timestamp": now_iso(),
    }
    await db.spare_parts.update_one(
        {"id": part_id},
        {"$set": fields, "$push": {"history": history_entry}}
    )
    updated = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
    return part_with_status(updated)

@api_router.patch("/spare-parts/{part_id}/penawaran")
async def update_penawaran(part_id: str, payload: PenawaranUpdate, user=Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    return await _update_stage(part_id, "PENAWARAN", data, user)

@api_router.patch("/spare-parts/{part_id}/afa")
async def update_afa(part_id: str, payload: AFAUpdate, user=Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    return await _update_stage(part_id, "AFA", data, user)

@api_router.patch("/spare-parts/{part_id}/po")
async def update_po(part_id: str, payload: POUpdate, user=Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    return await _update_stage(part_id, "PO", data, user)

@api_router.patch("/spare-parts/{part_id}/datang")
async def update_datang(part_id: str, payload: DatangUpdate, user=Depends(get_current_user)):
    data = payload.model_dump(exclude_unset=True)
    updated = await _update_stage(part_id, "DATANG", data, user)
    # Trigger Auto-IN when both datang_date & datang_no are set on the part
    if updated.get("datang_date") and updated.get("datang_no"):
        auto_in = await _try_auto_in(updated, user)
        if auto_in.get("created"):
            # Refresh part data after auto-IN
            refreshed = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
            return part_with_status(refreshed)
    return updated

@api_router.patch("/spare-parts/{part_id}/stamp")
async def update_stamp(part_id: str, payload: StampUpdate, user=Depends(get_current_user)):
    part = await db.spare_parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")
    await db.spare_parts.update_one(
        {"id": part_id},
        {"$set": {"stamp_file": payload.stamp_file.model_dump() if payload.stamp_file else None, "updated_at": now_iso()}}
    )
    updated = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
    return part_with_status(updated)

@api_router.get("/spare-parts/{part_id}/stock-impact")
async def get_stock_impact(part_id: str, user=Depends(get_current_user)):
    """Check whether this request already triggered an IN movement (affecting stock)."""
    part = await db.spare_parts.find_one({"id": part_id}, {"_id": 0})
    if not part:
        raise HTTPException(404, "Part tidak ditemukan")
    in_mv = await db.movements.find_one({"spare_part_id": part_id, "type": "IN"}, {"_id": 0})
    if not in_mv:
        return {"has_in": False}
    master = await db.master_parts.find_one({"id": in_mv["master_part_id"]}, {"_id": 0}) if in_mv else None
    return {
        "has_in": True,
        "in_quantity": in_mv["quantity"],
        "in_date": in_mv["date"],
        "master_part_id": in_mv["master_part_id"],
        "master_part_name": (master or {}).get("part_name"),
        "master_current_stock": (master or {}).get("current_stock"),
    }

@api_router.delete("/spare-parts/{part_id}")
async def delete_spare_part(part_id: str, user=Depends(get_current_user)):
    """Allowed for creator OR original requestor.
    If an auto-IN movement was created earlier, a compensating OUT movement is appended
    to revert stock. The original IN movement is preserved in history."""
    part = await db.spare_parts.find_one({"id": part_id})
    if not part:
        raise HTTPException(status_code=404, detail="Part tidak ditemukan")
    is_creator = user.get("role") == "creator"
    is_requestor = part.get("requestor_id") == user["id"]
    if not (is_creator or is_requestor):
        raise HTTPException(status_code=403, detail="Hanya creator atau requestor asli yang dapat menghapus request ini")

    # Reverse IN if exists
    in_mv = await db.movements.find_one({"spare_part_id": part_id, "type": "IN"})
    if in_mv:
        master = await db.master_parts.find_one({"id": in_mv["master_part_id"]})
        if master:
            qty = int(in_mv.get("quantity") or 0)
            adj = {
                "id": str(uuid.uuid4()),
                "master_part_id": in_mv["master_part_id"],
                "spare_part_id": part_id,
                "type": "OUT",
                "date": now_iso()[:10],
                "quantity": qty,
                "line_area": master["line_area"],
                "note": f"Reverse OUT — penghapusan request '{part.get('nama_barang')}' (No. Datang {part.get('datang_no') or '-'})",
                "actor": user["name"],
                "actor_nik": user["nik"],
                "is_adjustment": True,
                "created_at": now_iso(),
            }
            await db.movements.insert_one(adj)
            new_stock = max(0, (master.get("current_stock") or 0) - qty)
            await db.master_parts.update_one(
                {"id": master["id"]},
                {"$set": {
                    "current_stock": new_stock,
                    "updated_at": now_iso(),
                    "updated_by": {"name": user["name"], "nik": user["nik"], "action": f"Reverse OUT -{qty} (delete request)"},
                }},
            )

    await db.spare_parts.delete_one({"id": part_id})
    return {"ok": True, "reverse_applied": bool(in_mv)}

# -------------------------------------------------------------------
# Dashboard & Reports
# -------------------------------------------------------------------
@api_router.get("/dashboard/summary")
async def dashboard_summary(line: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    """Aggregated procurement + movement summary. Filters:
    - line: 'PLANT' | 'SEMUA' | None → all lines. Else specific line.
    - month, year: default current month/year.
    Returns procurement counts, progress deltas, and IN/OUT quantities for the period.
    """
    now = datetime.now(timezone.utc)
    if not month: month = now.month
    if not year: year = now.year
    m = f"{int(month):02d}"
    ym = f"{int(year)}-{m}"

    line_filter: Dict[str, Any] = {}
    if line and line.upper() not in ("PLANT", "SEMUA"):
        line_filter["line_area"] = normalize_line(line)

    # Procurement counts by month (based on order_tanggal)
    part_query: Dict[str, Any] = {**line_filter, "order_tanggal": {"$regex": f"^{ym}"}}
    parts = await db.spare_parts.find(part_query, {"_id": 0}).sort("order_tanggal", -1).to_list(100000)
    enriched = [part_with_status(p) for p in parts]
    total = len(enriched)
    afa_reached = sum(1 for p in enriched if p.get("afa_no") or p.get("afa_date"))
    po_reached = sum(1 for p in enriched if p.get("po_no") or p.get("po_date"))
    datang_reached = sum(1 for p in enriched if p.get("datang_no") or p.get("datang_date"))

    # Movements this month (based on movement.date). Uses master_part.line_area for filtering.
    mv_query: Dict[str, Any] = {"date": {"$regex": f"^{ym}"}, **line_filter}
    in_mvs = await db.movements.find({**mv_query, "type": "IN"}, {"_id": 0}).to_list(100000)
    out_mvs = await db.movements.find({**mv_query, "type": "OUT"}, {"_id": 0}).to_list(100000)
    in_qty = sum(int(mv.get("quantity") or 0) for mv in in_mvs)
    out_qty = sum(int(mv.get("quantity") or 0) for mv in out_mvs)

    return {
        "line": line or "PLANT", "month": month, "year": year,
        "procurement": {
            "total_request": total,
            "afa_reached": afa_reached,
            "remaining_request": total - afa_reached,
            "po_reached": po_reached,
            "waiting_po": afa_reached - po_reached,
            "datang_reached": datang_reached,
            "waiting_arrival": po_reached - datang_reached,
        },
        "movements": {
            "in_count": len(in_mvs), "in_qty": in_qty,
            "out_count": len(out_mvs), "out_qty": out_qty,
        },
        # Kept for backwards compat with older Dashboard
        "summary": {
            "total": total,
            "request": sum(1 for p in enriched if p["status"] == "REQUEST"),
            "penawaran": sum(1 for p in enriched if p["status"] == "PENAWARAN"),
            "nego": sum(1 for p in enriched if p["status"] == "NEGO"),
            "afa": sum(1 for p in enriched if p["status"] == "AFA PROCESS"),
            "po": sum(1 for p in enriched if p["status"] == "PO PROCESS"),
            "datang": sum(1 for p in enriched if p["status"] == "DATANG"),
        },
    }

@api_router.get("/dashboard/drilldown/{card}")
async def dashboard_drilldown(card: str, line: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    """Return list of items for a Dashboard card. card ∈ {total_request, afa, po, arrival, out, remaining, waiting_po, waiting_arrival}."""
    now = datetime.now(timezone.utc)
    if not month: month = now.month
    if not year: year = now.year
    m = f"{int(month):02d}"
    ym = f"{int(year)}-{m}"
    line_filter: Dict[str, Any] = {}
    if line and line.upper() not in ("PLANT", "SEMUA"):
        line_filter["line_area"] = normalize_line(line)

    if card in ("arrival", "out"):
        mv_query: Dict[str, Any] = {"date": {"$regex": f"^{ym}"}, **line_filter,
                                    "type": "IN" if card == "arrival" else "OUT"}
        items = await db.movements.find(mv_query, {"_id": 0}).sort("date", -1).limit(500).to_list(500)
        return {"card": card, "count": len(items), "items": items}

    part_query: Dict[str, Any] = {**line_filter, "order_tanggal": {"$regex": f"^{ym}"}}
    if card == "afa":
        part_query["$or"] = [{"afa_no": {"$exists": True, "$ne": None}}, {"afa_date": {"$exists": True, "$ne": None}}]
    elif card == "po":
        part_query["$or"] = [{"po_no": {"$exists": True, "$ne": None}}, {"po_date": {"$exists": True, "$ne": None}}]
    elif card == "remaining":  # requests without AFA yet
        part_query["$and"] = [
            {"$or": [{"afa_no": None}, {"afa_no": {"$exists": False}}]},
            {"$or": [{"afa_date": None}, {"afa_date": {"$exists": False}}]},
        ]
    elif card == "waiting_po":
        part_query["$or"] = [{"afa_no": {"$exists": True, "$ne": None}}, {"afa_date": {"$exists": True, "$ne": None}}]
        part_query["$and"] = [
            {"$or": [{"po_no": None}, {"po_no": {"$exists": False}}]},
            {"$or": [{"po_date": None}, {"po_date": {"$exists": False}}]},
        ]
    elif card == "waiting_arrival":
        part_query["$or"] = [{"po_no": {"$exists": True, "$ne": None}}, {"po_date": {"$exists": True, "$ne": None}}]
        part_query["$and"] = [
            {"$or": [{"datang_no": None}, {"datang_no": {"$exists": False}}]},
            {"$or": [{"datang_date": None}, {"datang_date": {"$exists": False}}]},
        ]
    items = await db.spare_parts.find(part_query, {"_id": 0}).sort("order_tanggal", -1).limit(500).to_list(500)
    return {"card": card, "count": len(items), "items": [part_with_status(p) for p in items]}

@api_router.get("/dashboard/{line}")
async def dashboard_line(line: str, month: int = None, year: int = None, user=Depends(get_current_user)):
    line_up = line.upper().replace("-", " ")
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    m = f"{int(month):02d}"
    query: Dict[str, Any] = {"line_area": line_up, "order_tanggal": {"$regex": f"^{int(year)}-{m}"}}
    parts = await db.spare_parts.find(query, {"_id": 0}).sort("order_tanggal", -1).to_list(1000)
    enriched = [part_with_status(p) for p in parts]
    summary = {
        "total": len(enriched),
        "request": sum(1 for p in enriched if p["status"] == "REQUEST"),
        "penawaran": sum(1 for p in enriched if p["status"] == "PENAWARAN"),
        "nego": sum(1 for p in enriched if p["status"] == "NEGO"),
        "afa": sum(1 for p in enriched if p["status"] == "AFA PROCESS"),
        "po": sum(1 for p in enriched if p["status"] == "PO PROCESS"),
        "datang": sum(1 for p in enriched if p["status"] == "DATANG"),
    }
    return {"line": line_up, "month": month, "year": year, "summary": summary, "items": enriched}

@api_router.get("/reports/monthly")
async def monthly_report(line: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    m = f"{int(month):02d}"
    query: Dict[str, Any] = {"order_tanggal": {"$regex": f"^{int(year)}-{m}"}}
    if line and line.upper() != "SEMUA":
        query["line_area"] = line.upper()
    parts = await db.spare_parts.find(query, {"_id": 0}).to_list(10000)
    enriched = [part_with_status(p) for p in parts]
    total = len(enriched)
    by_status = {}
    for s in ["REQUEST", "PENAWARAN", "NEGO", "AFA PROCESS", "PO PROCESS", "DATANG"]:
        by_status[s] = sum(1 for p in enriched if p["status"] == s)
    by_line = {}
    for p in enriched:
        la = p.get("line_area", "-")
        by_line[la] = by_line.get(la, 0) + 1
    return {
        "line": line or "SEMUA",
        "month": month,
        "year": year,
        "total": total,
        "by_status": by_status,
        "by_line": by_line,
        "items": enriched,
    }

@api_router.get("/meta/options")
async def meta_options(user=Depends(get_current_user)):
    return {
        "lines": LINE_AREAS,
        "ranks": RANK_OPTIONS,
        "statuses": ["REQUEST", "PENAWARAN", "NEGO", "AFA PROCESS", "PO PROCESS", "DATANG"],
    }

# -------------------------------------------------------------------
# Master Data & Movements helpers
# -------------------------------------------------------------------
LEVEL_OPTIONS = {"Critical", "Substitusi", "Stock"}

async def _try_auto_in(part: dict, user: dict):
    """Look up master part by (name+type+maker+line_area). Skip with warning if missing (option 3b)."""
    master = await db.master_parts.find_one({
        "part_name": part.get("nama_barang"),
        "type": part.get("type"),
        "maker": part.get("maker"),
        "line_area": part.get("line_area"),
    })
    if not master:
        return {"created": False, "reason": "Master part tidak ditemukan. Tambahkan part ke Master Data lalu input ulang Tanggal Datang."}
    qty = int(part.get("qty_order") or 0)
    if qty <= 0:
        return {"created": False, "reason": "Qty 0"}
    existing = await db.movements.find_one({"spare_part_id": part["id"], "type": "IN"})
    if existing:
        return {"created": False, "reason": "IN sudah pernah dibuat untuk part ini"}
    mv = {
        "id": str(uuid.uuid4()),
        "master_part_id": master["id"],
        "spare_part_id": part["id"],
        "type": "IN",
        "date": part.get("datang_date"),
        "quantity": qty,
        "no_datang": part.get("datang_no"),
        "line_area": master["line_area"],
        "note": f"Auto-IN dari procurement {part.get('nama_barang')}",
        "actor": user["name"],
        "actor_nik": user["nik"],
        "created_at": now_iso(),
    }
    await db.movements.insert_one(mv)
    cs = master.get("current_stock")
    new_stock = (cs or 0) + qty
    await db.master_parts.update_one(
        {"id": master["id"]},
        {"$set": {"current_stock": new_stock, "updated_at": now_iso(), "updated_by": {"name": user["name"], "nik": user["nik"], "action": f"Auto-IN +{qty}"}}},
    )
    return {"created": True, "master_part_id": master["id"], "new_stock": new_stock, "qty": qty}

def compute_stock_status(p: dict) -> str:
    cs = p.get("current_stock")
    if cs is None:
        return "NEED UPDATE"
    if cs <= 0:
        return "NO STOCK"
    if cs < 2:
        return "LOW STOCK"
    return "AMAN"

def compute_action(p: dict) -> str:
    """Action label per spec: AMAN / LOW STOCK / ORDER SEKARANG!!! / CHECK SUBSTITUTE / MONITOR / NEED UPDATE."""
    cs = p.get("current_stock")
    lvl = p.get("level_part") or "Stock"
    if cs is None:
        return "NEED UPDATE"
    if cs <= 0:
        if lvl == "Critical":
            return "ORDER SEKARANG!!!"
        if lvl == "Substitusi":
            return "CHECK SUBSTITUTE"
        return "MONITOR"
    if cs < 2:
        return "LOW STOCK"
    return "AMAN"

def compute_warning(p: dict):
    """Backwards-compat warning used by old endpoints."""
    a = compute_action(p)
    if a == "ORDER SEKARANG!!!":
        return "CRITICAL"
    if a == "CHECK SUBSTITUTE":
        return "CHECK_SUBSTITUTE"
    if a in ("LOW STOCK", "MONITOR"):
        return "BELOW_MIN"
    return None

def master_with_status(m: dict) -> dict:
    if not m:
        return m
    m = dict(m)
    m.pop("_id", None)
    m["stock_status"] = compute_stock_status(m)
    m["action"] = compute_action(m)
    m["warning"] = compute_warning(m)
    return m

# -------------------------------------------------------------------
# Master Data & Movements models
# -------------------------------------------------------------------
class MasterPartCreate(BaseModel):
    part_name: str
    type: str = ""
    maker: str = ""
    line_area: str
    current_stock: Optional[int] = None
    minimum_stock: Optional[int] = 0
    level_part: str = "Stock"
    reff: Optional[str] = ""
    location: Optional[str] = ""

class MasterPartEdit(BaseModel):
    part_name: Optional[str] = None
    type: Optional[str] = None
    maker: Optional[str] = None
    line_area: Optional[str] = None
    current_stock: Optional[int] = None
    minimum_stock: Optional[int] = None
    level_part: Optional[str] = None
    reff: Optional[str] = None
    location: Optional[str] = None

class ImportPreviewRequest(BaseModel):
    line_area: str
    rows: List[Dict[str, Any]]

class ImportSaveRequest(BaseModel):
    line_area: str
    rows: List[Dict[str, Any]]
    resolutions: Optional[List[str]] = None
    default_resolution: str = "skip"
    # Optional: seed month for creating initial IN/OUT movement records.
    # Format YYYY-MM. If omitted, uses current month.
    seed_month: Optional[str] = None

class MovementOutCreate(BaseModel):
    master_part_id: str
    date: str
    quantity: int
    note: Optional[str] = ""

# -------------------------------------------------------------------
# Master Data & Movements endpoints
# -------------------------------------------------------------------
@api_router.get("/master-parts")
async def list_master_parts(
    line: Optional[str] = None,
    level_part: Optional[str] = None,
    status: Optional[str] = None,
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if line and line.upper() != "SEMUA":
        query["line_area"] = line.upper()
    if level_part and level_part != "SEMUA":
        query["level_part"] = level_part
    if q:
        query["$or"] = [
            {"part_name": {"$regex": q, "$options": "i"}},
            {"type": {"$regex": q, "$options": "i"}},
            {"maker": {"$regex": q, "$options": "i"}},
            {"reff": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
        ]
    total = await db.master_parts.count_documents(query)
    skip = max(0, (page - 1) * page_size)
    cursor = db.master_parts.find(query, {"_id": 0}).sort("part_name", 1).skip(skip).limit(page_size)
    items = await cursor.to_list(page_size)
    enriched = [master_with_status(m) for m in items]
    if status and status != "SEMUA":
        enriched = [m for m in enriched if m["stock_status"] == status]
    return {"items": enriched, "total": total, "page": page, "page_size": page_size}

@api_router.get("/master-parts/{mid}")
async def get_master_part(mid: str, user=Depends(get_current_user)):
    m = await db.master_parts.find_one({"id": mid}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Master part tidak ditemukan")
    return master_with_status(m)

@api_router.get("/master-parts-search/lookup")
async def master_lookup(
    q: Optional[str] = None,
    field: Optional[str] = None,
    part_name: Optional[str] = None,
    type: Optional[str] = None,
    maker: Optional[str] = None,
    line: Optional[str] = None,
    limit: int = 25,
    user=Depends(get_current_user),
):
    """Autocomplete / cascading lookup for Request Form.
    - field=part_name|type|maker: returns distinct values for that field, filtered by other params.
    - else: returns matching master parts (filtered by all provided params).
    """
    base: Dict[str, Any] = {}
    if line and line.upper() != "SEMUA":
        base["line_area"] = normalize_line(line)
    if part_name:
        base["part_name"] = {"$regex": f"^{part_name}", "$options": "i"}
    if type:
        base["type"] = {"$regex": f"^{type}", "$options": "i"}
    if maker:
        base["maker"] = {"$regex": f"^{maker}", "$options": "i"}
    if q:
        base["$or"] = [
            {"part_name": {"$regex": q, "$options": "i"}},
            {"type": {"$regex": q, "$options": "i"}},
            {"maker": {"$regex": q, "$options": "i"}},
        ]

    if field in ("part_name", "type", "maker"):
        values = await db.master_parts.distinct(field, base)
        values = [v for v in values if v]
        values.sort(key=lambda x: str(x).lower())
        return {"values": values[:limit]}

    cursor = db.master_parts.find(base, {"_id": 0}).sort("part_name", 1).limit(limit)
    items = await cursor.to_list(limit)
    return {"items": [master_with_status(m) for m in items]}

@api_router.post("/master-parts")
async def create_master_part(payload: MasterPartCreate, user=Depends(get_current_user)):
    require_creator(user)
    if payload.level_part not in LEVEL_OPTIONS:
        raise HTTPException(422, "Level Part tidak valid")
    line_area = validate_line_area(payload.line_area)
    existing = await db.master_parts.find_one({
        "part_name": payload.part_name, "type": payload.type or "", "maker": payload.maker or "", "line_area": line_area,
    })
    if existing:
        raise HTTPException(400, "Master part dengan kombinasi Name+Type+Maker+Line sudah ada")
    doc = payload.model_dump()
    doc["line_area"] = line_area
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = now_iso()
    doc["updated_at"] = now_iso()
    doc["updated_by"] = {"name": user["name"], "nik": user["nik"], "action": "Tambah manual"}
    doc["edit_history"] = []
    await db.master_parts.insert_one(doc)
    return master_with_status(doc)

@api_router.put("/master-parts/{mid}")
async def edit_master_part(mid: str, payload: MasterPartEdit, user=Depends(get_current_user)):
    require_creator(user)
    existing = await db.master_parts.find_one({"id": mid})
    if not existing:
        raise HTTPException(404, "Master part tidak ditemukan")
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "level_part" in update_data and update_data["level_part"] not in LEVEL_OPTIONS:
        raise HTTPException(422, "Level Part tidak valid")
    if "line_area" in update_data:
        update_data["line_area"] = validate_line_area(update_data["line_area"])
    if not update_data:
        return master_with_status(existing)
    changes = []
    for k, v in update_data.items():
        if existing.get(k) != v:
            changes.append({"field": k, "old": existing.get(k), "new": v})
    update_data["updated_at"] = now_iso()
    update_data["updated_by"] = {"name": user["name"], "nik": user["nik"], "action": "Edit Master"}
    ops = {"$set": update_data}
    if changes:
        ops["$push"] = {"edit_history": {"actor": user["name"], "actor_nik": user["nik"], "timestamp": now_iso(), "changes": changes}}
    await db.master_parts.update_one({"id": mid}, ops)
    updated = await db.master_parts.find_one({"id": mid}, {"_id": 0})
    return master_with_status(updated)

@api_router.delete("/master-parts-admin/reset-all")
async def reset_master_data(user=Depends(get_current_user)):
    """Creator-only: Wipe ALL master_parts + their movements. Used after structure changes."""
    require_creator(user)
    mp_res = await db.master_parts.delete_many({})
    mv_res = await db.movements.delete_many({})
    return {"ok": True, "deleted_master_parts": mp_res.deleted_count, "deleted_movements": mv_res.deleted_count}

@api_router.delete("/master-parts-admin/reset-line/{line}")
async def reset_master_data_line(line: str, user=Depends(get_current_user)):
    """Creator-only: Wipe master_parts + movements only for the specified line."""
    require_creator(user)
    line_area = validate_line_area(line)
    part_ids = [p["id"] async for p in db.master_parts.find({"line_area": line_area}, {"id": 1})]
    mp_res = await db.master_parts.delete_many({"line_area": line_area})
    mv_res = await db.movements.delete_many({"master_part_id": {"$in": part_ids}})
    return {"ok": True, "line": line_area, "deleted_master_parts": mp_res.deleted_count, "deleted_movements": mv_res.deleted_count}

@api_router.get("/master-parts-admin/parse-location")
async def api_parse_location(code: str, user=Depends(get_current_user)):
    """Decode a Suzuki location code (e.g. '300105L05') into structured parts (SOP OPL PENOMORAN RAK GUDANG)."""
    return parse_location_code(code)

@api_router.get("/master-parts-admin/invalid-lines")
async def list_invalid_line_parts(user=Depends(get_current_user)):
    """Returns count + sample of master_parts whose line_area is not in VALID_LINE_AREAS.
    Used by UI to surface migration warnings."""
    invalid = await db.master_parts.find(
        {"line_area": {"$nin": list(VALID_LINE_AREAS)}}, {"_id": 0}
    ).limit(50).to_list(50)
    count = await db.master_parts.count_documents({"line_area": {"$nin": list(VALID_LINE_AREAS)}})
    return {"count": count, "samples": [master_with_status(m) for m in invalid], "valid_lines": LINE_AREAS}

@api_router.delete("/master-parts/{mid}")
async def delete_master_part(mid: str, user=Depends(get_current_user)):
    require_creator(user)
    res = await db.master_parts.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await db.movements.delete_many({"master_part_id": mid})
    return {"ok": True}

@api_router.get("/master-parts/{mid}/movements")
async def list_master_part_movements(mid: str, user=Depends(get_current_user)):
    mvs = await db.movements.find({"master_part_id": mid}, {"_id": 0}).sort("date", -1).to_list(1000)
    return mvs

@api_router.post("/master-parts/import/preview")
async def import_preview(payload: ImportPreviewRequest, user=Depends(get_current_user)):
    require_creator(user)
    line_area = validate_line_area(payload.line_area)
    out_rows = []
    for r in payload.rows:
        name = (r.get("part_name") or "").strip()
        if not name:
            out_rows.append({**r, "_status": "INVALID", "_reason": "Part Name kosong"})
            continue
        existing = await db.master_parts.find_one({
            "part_name": name, "type": r.get("type") or "", "maker": r.get("maker") or "", "line_area": line_area,
        })
        out_rows.append({
            **r,
            "_status": "DUPLICATE" if existing else "NEW",
            "_existing_id": existing.get("id") if existing else None,
            "_current_stock_existing": existing.get("current_stock") if existing else None,
        })
    new_count = sum(1 for r in out_rows if r["_status"] == "NEW")
    dup_count = sum(1 for r in out_rows if r["_status"] == "DUPLICATE")
    invalid_count = sum(1 for r in out_rows if r["_status"] == "INVALID")
    return {"rows": out_rows, "summary": {"total": len(out_rows), "new": new_count, "duplicate": dup_count, "invalid": invalid_count}}

@api_router.post("/master-parts/import/save")
async def import_save(payload: ImportSaveRequest, user=Depends(get_current_user)):
    require_creator(user)
    line_area = validate_line_area(payload.line_area)
    resolutions = payload.resolutions or []
    default_res = payload.default_resolution
    # Seed month for initial IN/OUT movements
    now = datetime.now(timezone.utc)
    seed_month = payload.seed_month or f"{now.year}-{now.month:02d}"
    seed_date = f"{seed_month}-01"  # first of the seed month
    created = updated = skipped = invalid = 0
    movements_created = 0
    for i, r in enumerate(payload.rows):
        name = (r.get("part_name") or "").strip()
        if not name:
            invalid += 1
            continue
        res = resolutions[i] if i < len(resolutions) else default_res
        type_v = r.get("type") or ""
        maker_v = r.get("maker") or ""
        existing = await db.master_parts.find_one({
            "part_name": name, "type": type_v, "maker": maker_v, "line_area": line_area,
        })
        # Level Part: default 'Stock' per spec
        lvl = r.get("level_part") or "Stock"
        if lvl not in LEVEL_OPTIONS:
            lvl = "Stock"
        # Minimum Stock: default 2 per spec (unless user gave a value)
        ms = r.get("minimum_stock")
        if ms in (None, ""):
            ms = 2
        else:
            try: ms = int(ms)
            except Exception: ms = 2
        # IN / OUT / Current Stock from Excel (last-update month values)
        in_qty = _to_int_or_zero(r.get("in_qty"))
        out_qty = _to_int_or_zero(r.get("out_qty"))
        remark = (r.get("remark") or "").strip()
        cs_raw = r.get("current_stock")
        if cs_raw == "" or cs_raw is None:
            cs = None
        else:
            try: cs = int(cs_raw)
            except Exception: cs = None
        if existing:
            if res == "skip":
                skipped += 1
                continue
            if res == "update":
                upd = {
                    "current_stock": cs,
                    "minimum_stock": ms,
                    "level_part": lvl,
                    "reff": r.get("reff") or existing.get("reff", ""),
                    "location": r.get("location") or existing.get("location", ""),
                    "remark": remark or existing.get("remark", ""),
                    "updated_at": now_iso(),
                    "updated_by": {"name": user["name"], "nik": user["nik"], "action": "Update via Import"},
                }
                await db.master_parts.update_one({"id": existing["id"]}, {"$set": upd})
                # Seed movements for the last-update month if provided
                mid = existing["id"]
                if in_qty > 0:
                    await _seed_movement(mid, line_area, "IN", in_qty, seed_date, user, note=f"Seed Import {seed_month}")
                    movements_created += 1
                if out_qty > 0:
                    await _seed_movement(mid, line_area, "OUT", out_qty, seed_date, user, note=f"Seed Import {seed_month}")
                    movements_created += 1
                updated += 1
                continue
        doc = {
            "id": str(uuid.uuid4()),
            "part_name": name, "type": type_v, "maker": maker_v, "line_area": line_area,
            "current_stock": cs, "minimum_stock": ms, "level_part": lvl,
            "reff": r.get("reff") or "", "location": r.get("location") or "",
            "remark": remark,
            "created_at": now_iso(), "updated_at": now_iso(),
            "updated_by": {"name": user["name"], "nik": user["nik"], "action": "Import Excel"},
            "edit_history": [],
        }
        try:
            await db.master_parts.insert_one(doc)
            created += 1
            # Seed movements
            if in_qty > 0:
                await _seed_movement(doc["id"], line_area, "IN", in_qty, seed_date, user, note=f"Seed Import {seed_month}")
                movements_created += 1
            if out_qty > 0:
                await _seed_movement(doc["id"], line_area, "OUT", out_qty, seed_date, user, note=f"Seed Import {seed_month}")
                movements_created += 1
        except Exception:
            skipped += 1
    return {"created": created, "updated": updated, "skipped": skipped, "invalid": invalid, "movements_created": movements_created, "seed_month": seed_month}

def _to_int_or_zero(v) -> int:
    if v in (None, ""):
        return 0
    try:
        return max(0, int(float(v)))
    except Exception:
        return 0

async def _seed_movement(master_part_id: str, line_area: str, mv_type: str, qty: int, date: str, user, note: str = ""):
    doc = {
        "id": str(uuid.uuid4()),
        "master_part_id": master_part_id,
        "spare_part_id": None,
        "type": mv_type,
        "date": date,
        "quantity": int(qty),
        "line_area": line_area,
        "note": note,
        "actor": user["name"],
        "actor_nik": user["nik"],
        "is_adjustment": False,
        "is_seed": True,
        "created_at": now_iso(),
    }
    await db.movements.insert_one(doc)

@api_router.post("/movements/out")
async def create_out(payload: MovementOutCreate, user=Depends(get_current_user)):
    master = await db.master_parts.find_one({"id": payload.master_part_id})
    if not master:
        raise HTTPException(404, "Master part tidak ditemukan")
    if payload.quantity <= 0:
        raise HTTPException(400, "Qty harus > 0")
    cs = master.get("current_stock") or 0
    if cs < payload.quantity:
        raise HTTPException(400, f"Stock tidak cukup. Current: {cs}, OUT: {payload.quantity}")
    mv = {
        "id": str(uuid.uuid4()),
        "master_part_id": payload.master_part_id,
        "type": "OUT",
        "date": payload.date,
        "quantity": payload.quantity,
        "line_area": master["line_area"],
        "note": payload.note or "",
        "actor": user["name"],
        "actor_nik": user["nik"],
        "created_at": now_iso(),
    }
    await db.movements.insert_one(mv)
    new_stock = cs - payload.quantity
    await db.master_parts.update_one(
        {"id": master["id"]},
        {"$set": {"current_stock": new_stock, "updated_at": now_iso(), "updated_by": {"name": user["name"], "nik": user["nik"], "action": f"OUT -{payload.quantity}"}}},
    )
    return {"movement": {k: v for k, v in mv.items() if k != "_id"}, "new_stock": new_stock}

@api_router.get("/movements")
async def list_movements(
    line: Optional[str] = None,
    type: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
    user=Depends(get_current_user),
):
    query: Dict[str, Any] = {}
    if line and line.upper() != "SEMUA":
        query["line_area"] = line.upper()
    if type and type in ("IN", "OUT"):
        query["type"] = type
    if month and year:
        query["date"] = {"$regex": f"^{int(year)}-{int(month):02d}"}
    elif year:
        query["date"] = {"$regex": f"^{int(year)}-"}
    total = await db.movements.count_documents(query)
    skip = max(0, (page - 1) * page_size)
    items = await db.movements.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(page_size).to_list(page_size)
    return {"items": items, "total": total, "page": page, "page_size": page_size}

@api_router.get("/stock/summary")
async def stock_summary(line: Optional[str] = None, user=Depends(get_current_user)):
    """Categorises master parts into GOOD / MINIMUM / ZERO / CRITICAL buckets.
    - GOOD: current_stock > minimum_stock
    - MINIMUM: 0 < current_stock <= minimum_stock
    - ZERO: current_stock == 0
    - CRITICAL: level_part == 'Critical' AND current_stock == 0
    Also returns need_update (current_stock is None) for informational purposes.
    """
    query: Dict[str, Any] = {}
    if line and line.upper() != "PLANT" and line.upper() != "SEMUA":
        query["line_area"] = normalize_line(line)
    all_parts = await db.master_parts.find(query, {"_id": 0}).to_list(200000)
    total = len(all_parts)
    good_list, minimum_list, zero_list, critical_list, need_update_list = [], [], [], [], []
    for p in all_parts:
        cs = p.get("current_stock")
        mn = p.get("minimum_stock") or 0
        level = p.get("level_part") or "Stock"
        p_out = {**p, "location_parsed": parse_location_code(p.get("location"))}
        if cs is None:
            need_update_list.append(p_out); continue
        if cs == 0 and level == "Critical":
            critical_list.append(p_out); continue
        if cs == 0:
            zero_list.append(p_out); continue
        if cs <= mn:
            minimum_list.append(p_out); continue
        good_list.append(p_out)
    return {
        "total": total,
        "good": len(good_list),
        "minimum": len(minimum_list),
        "zero": len(zero_list),
        "critical": len(critical_list),
        "need_update": len(need_update_list),
        # bounded lists for popup drilldown; full list available via /master-parts endpoint
        "good_list": good_list[:500],
        "minimum_list": minimum_list[:500],
        "zero_list": zero_list[:500],
        "critical_list": critical_list[:500],
        "need_update_list": need_update_list[:500],
    }

@api_router.get("/reports/movement-monthly")
async def movement_monthly_report(line: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    m = f"{int(month):02d}"
    query: Dict[str, Any] = {"date": {"$regex": f"^{int(year)}-{m}"}}
    if line and line.upper() != "SEMUA":
        query["line_area"] = line.upper()
    items = await db.movements.find(query, {"_id": 0}).sort("date", -1).to_list(100000)
    in_items = [m for m in items if m["type"] == "IN"]
    out_items = [m for m in items if m["type"] == "OUT"]
    return {
        "month": month, "year": year, "line": line or "SEMUA",
        "in": {"count": len(in_items), "total_qty": sum(m["quantity"] for m in in_items), "items": in_items},
        "out": {"count": len(out_items), "total_qty": sum(m["quantity"] for m in out_items), "items": out_items},
    }

# -------------------------------------------------------------------
# Register router & middleware
# -------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
