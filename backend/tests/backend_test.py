"""
Backend tests — Spare Part Control System
Covers: auth, users, files, spare-parts CRUD + stage updates, dashboard, reports, meta.
"""
import io
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

# Read REACT_APP_BACKEND_URL from frontend/.env
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREATOR_NIK = "32521"
USER_NIK = "19376"  # Heri
USER2_NIK = "6282"  # Zulkifli
DEFAULT_PWD = "123456"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(s, nik, pwd):
    r = s.post(f"{API}/auth/login", json={"nik": nik, "password": pwd})
    return r


@pytest.fixture(scope="session")
def creator_token(session):
    r = _login(session, CREATOR_NIK, DEFAULT_PWD)
    assert r.status_code == 200, f"Creator login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def user_token(session):
    r = _login(session, USER_NIK, DEFAULT_PWD)
    assert r.status_code == 200, f"User login failed: {r.text}"
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Auth ----------
class TestAuth:
    def test_login_success_creator(self, session):
        r = _login(session, CREATOR_NIK, DEFAULT_PWD)
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert data["user"]["nik"] == CREATOR_NIK
        assert data["user"]["role"] == "creator"
        assert "password_hash" not in data["user"]

    def test_login_success_user(self, session):
        r = _login(session, USER_NIK, DEFAULT_PWD)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "user"

    def test_login_user_zulkifli(self, session):
        r = _login(session, USER2_NIK, DEFAULT_PWD)
        assert r.status_code == 200
        assert r.json()["user"]["nik"] == USER2_NIK

    def test_login_wrong_password(self, session):
        r = _login(session, CREATOR_NIK, "wrong")
        assert r.status_code == 401

    def test_login_unknown_nik(self, session):
        r = _login(session, "999999", DEFAULT_PWD)
        assert r.status_code == 401

    def test_me_requires_auth(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, creator_token):
        r = requests.get(f"{API}/auth/me", headers=H(creator_token))
        assert r.status_code == 200
        assert r.json()["role"] == "creator"

    def test_change_password_wrong_current(self, user_token):
        r = requests.post(
            f"{API}/auth/change-password",
            headers=H(user_token),
            json={"current_password": "wrong", "new_password": "abcdef"},
        )
        assert r.status_code == 400

    def test_change_password_success_and_revert(self, session):
        # Use a non-critical user (Zulkifli) — change then revert
        login = _login(session, USER2_NIK, DEFAULT_PWD).json()
        tok = login["access_token"]
        new_pwd = "newpass1"
        r = requests.post(
            f"{API}/auth/change-password",
            headers=H(tok),
            json={"current_password": DEFAULT_PWD, "new_password": new_pwd},
        )
        assert r.status_code == 200
        # verify new password works
        r2 = _login(session, USER2_NIK, new_pwd)
        assert r2.status_code == 200
        # revert
        tok2 = r2.json()["access_token"]
        r3 = requests.post(
            f"{API}/auth/change-password",
            headers=H(tok2),
            json={"current_password": new_pwd, "new_password": DEFAULT_PWD},
        )
        assert r3.status_code == 200


# ---------- Users ----------
class TestUsers:
    def test_list_users_authenticated(self, user_token):
        r = requests.get(f"{API}/users", headers=H(user_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 15
        niks = [u["nik"] for u in data]
        assert CREATOR_NIK in niks
        for u in data:
            assert "password_hash" not in u

    def test_list_users_requires_auth(self):
        r = requests.get(f"{API}/users")
        assert r.status_code == 401

    def test_create_user_forbidden_for_non_creator(self, user_token):
        r = requests.post(
            f"{API}/users",
            headers=H(user_token),
            json={"name": "TEST_X", "email": "t@t.id", "nik": "TEST_99001",
                  "rank": "PELAKSANA", "area": "PRESSING"},
        )
        assert r.status_code == 403

    def test_user_crud_as_creator(self, creator_token):
        # CREATE
        payload = {"name": "TEST_USER_AUTO", "email": "test_auto@suzuki.co.id",
                   "nik": "TEST_AUTO_001", "rank": "PELAKSANA", "area": "PRESSING"}
        r = requests.post(f"{API}/users", headers=H(creator_token), json=payload)
        assert r.status_code in (200, 201), r.text
        created = r.json()
        assert created["nik"] == payload["nik"]
        assert created["role"] == "user"
        uid = created["id"]

        # Verify in list
        r2 = requests.get(f"{API}/users", headers=H(creator_token))
        assert any(u["id"] == uid for u in r2.json())

        # UPDATE
        r3 = requests.put(f"{API}/users/{uid}", headers=H(creator_token),
                          json={"name": "TEST_USER_RENAMED"})
        assert r3.status_code == 200
        assert r3.json()["name"] == "TEST_USER_RENAMED"

        # Login as new user, then reset
        login = _login(requests.Session(), payload["nik"], DEFAULT_PWD)
        assert login.status_code == 200

        # RESET password (should still be 123456 — verify still works)
        r4 = requests.post(f"{API}/users/{uid}/reset-password", headers=H(creator_token))
        assert r4.status_code == 200
        assert r4.json().get("default_password") == DEFAULT_PWD
        login2 = _login(requests.Session(), payload["nik"], DEFAULT_PWD)
        assert login2.status_code == 200

        # DELETE
        r5 = requests.delete(f"{API}/users/{uid}", headers=H(creator_token))
        assert r5.status_code == 200

        # Verify gone
        r6 = requests.get(f"{API}/users", headers=H(creator_token))
        assert not any(u["id"] == uid for u in r6.json())

    def test_cannot_delete_creator(self, creator_token):
        r = requests.get(f"{API}/users", headers=H(creator_token))
        creator = next(u for u in r.json() if u["role"] == "creator")
        # cannot delete self (creator IS self in this case)
        r2 = requests.delete(f"{API}/users/{creator['id']}", headers=H(creator_token))
        assert r2.status_code == 400

    def test_update_user_forbidden_for_non_creator(self, user_token, creator_token):
        users = requests.get(f"{API}/users", headers=H(user_token)).json()
        someone = next(u for u in users if u["role"] == "user")
        r = requests.put(f"{API}/users/{someone['id']}", headers=H(user_token),
                         json={"name": "X"})
        assert r.status_code == 403


# ---------- Meta ----------
class TestMeta:
    def test_meta_options(self, user_token):
        r = requests.get(f"{API}/meta/options", headers=H(user_token))
        assert r.status_code == 200
        data = r.json()
        for k in ("lines", "ranks", "statuses"):
            assert k in data and isinstance(data[k], list) and len(data[k]) > 0
        assert "PRESSING" in data["lines"]
        assert "REQUEST" in data["statuses"]
        assert "DATANG" in data["statuses"]


# ---------- Files ----------
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x00\x03\x00\x01\xb5\x83\xda\x14\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestFiles:
    def test_upload_requires_auth(self):
        r = requests.post(f"{API}/files/upload",
                          files={"file": ("a.png", io.BytesIO(PNG_BYTES), "image/png")})
        assert r.status_code == 401

    def test_upload_and_fetch(self, creator_token):
        # multipart, no JSON content-type
        r = requests.post(f"{API}/files/upload",
                          headers={"Authorization": f"Bearer {creator_token}"},
                          files={"file": ("test.png", io.BytesIO(PNG_BYTES), "image/png")})
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "path", "filename", "content_type"):
            assert k in data
        assert data["content_type"] == "image/png"
        file_id = data["id"]
        # Fetch via header
        r2 = requests.get(f"{API}/files/{file_id}",
                          headers={"Authorization": f"Bearer {creator_token}"})
        assert r2.status_code == 200
        assert r2.content == PNG_BYTES
        assert r2.headers.get("content-type", "").startswith("image/png")
        # Fetch via query param
        r3 = requests.get(f"{API}/files/{file_id}", params={"auth": creator_token})
        assert r3.status_code == 200
        assert r3.content == PNG_BYTES
        # Fetch without auth
        r4 = requests.get(f"{API}/files/{file_id}")
        assert r4.status_code == 401


# ---------- Spare Parts ----------
class TestSpareParts:
    @pytest.fixture(scope="class")
    def part_id(self, creator_token):
        payload = {
            "line_area": "pressing",  # lower-case to check uppercasing
            "nama_barang": "TEST_BEARING_AUTO",
            "type": "SKF-6203",
            "maker": "SKF",
            "part_mesin": "Mesin A",
            "qty_order": 2,
            "order_tanggal": "2026-01-15",
            "keterangan": "Test auto",
        }
        r = requests.post(f"{API}/spare-parts", headers=H(creator_token), json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data["status"] == "REQUEST"
        assert data["line_area"] == "PRESSING"
        assert data["nama_barang"] == "TEST_BEARING_AUTO"
        return data["id"]

    def test_create_validation_missing_required(self, creator_token):
        r = requests.post(f"{API}/spare-parts", headers=H(creator_token),
                          json={"line_area": "", "nama_barang": ""})
        assert r.status_code == 422

    def test_get_by_id(self, user_token, part_id):
        r = requests.get(f"{API}/spare-parts/{part_id}", headers=H(user_token))
        assert r.status_code == 200
        assert r.json()["id"] == part_id
        assert r.json()["status"] == "REQUEST"

    def test_list_with_filters_and_pagination(self, user_token, part_id):
        r = requests.get(f"{API}/spare-parts",
                         headers=H(user_token),
                         params={"line": "PRESSING", "month": 1, "year": 2026,
                                 "page": 1, "page_size": 5})
        assert r.status_code == 200
        d = r.json()
        for k in ("items", "total", "page", "page_size"):
            assert k in d
        assert d["page"] == 1 and d["page_size"] == 5
        assert any(p["id"] == part_id for p in d["items"])

        # q filter
        r2 = requests.get(f"{API}/spare-parts", headers=H(user_token),
                          params={"q": "TEST_BEARING_AUTO"})
        assert r2.status_code == 200
        assert r2.json()["total"] >= 1

    def test_pagination_consistency(self, creator_token, user_token):
        # Create a couple more parts to ensure pagination
        for i in range(3):
            requests.post(f"{API}/spare-parts", headers=H(creator_token),
                          json={"line_area": "WELDING",
                                "nama_barang": f"TEST_PAGE_{i}",
                                "maker": "X", "qty_order": 1,
                                "order_tanggal": "2026-01-10"})
        r1 = requests.get(f"{API}/spare-parts", headers=H(user_token),
                          params={"line": "WELDING", "year": 2026,
                                  "page": 1, "page_size": 2})
        r2 = requests.get(f"{API}/spare-parts", headers=H(user_token),
                          params={"line": "WELDING", "year": 2026,
                                  "page": 2, "page_size": 2})
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["total"] == r2.json()["total"]
        ids1 = {p["id"] for p in r1.json()["items"]}
        ids2 = {p["id"] for p in r2.json()["items"]}
        assert ids1.isdisjoint(ids2)

    def test_penawaran_then_nego(self, user_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/penawaran",
                           headers=H(user_token),
                           json={"penawaran_date": "2026-01-16",
                                 "penawaran_note": "vendor A"})
        assert r.status_code == 200
        assert r.json()["status"] == "PENAWARAN"
        # nego
        r2 = requests.patch(f"{API}/spare-parts/{part_id}/penawaran",
                            headers=H(user_token),
                            json={"nego_date": "2026-01-17", "nego_note": "nego ok"})
        assert r2.status_code == 200
        assert r2.json()["status"] == "NEGO"

    def test_afa_precedence(self, user_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/afa",
                           headers=H(user_token),
                           json={"afa_date": "2026-01-18", "afa_no": "AFA-001"})
        assert r.status_code == 200
        # AFA should take precedence over PENAWARAN/NEGO
        assert r.json()["status"] == "AFA PROCESS"

    def test_po(self, user_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/po",
                           headers=H(user_token),
                           json={"po_date": "2026-01-19", "po_no": "PO-001"})
        assert r.status_code == 200
        assert r.json()["status"] == "PO PROCESS"

    def test_datang(self, user_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/datang",
                           headers=H(user_token),
                           json={"datang_date": "2026-01-20", "datang_no": "DN-001"})
        assert r.status_code == 200
        assert r.json()["status"] == "DATANG"

    def test_stamp(self, creator_token, user_token, part_id):
        # upload a small file first
        up = requests.post(f"{API}/files/upload",
                           headers={"Authorization": f"Bearer {creator_token}"},
                           files={"file": ("s.png", io.BytesIO(PNG_BYTES), "image/png")})
        assert up.status_code == 200
        fref = up.json()
        r = requests.patch(f"{API}/spare-parts/{part_id}/stamp",
                           headers=H(user_token),
                           json={"stamp_file": fref})
        assert r.status_code == 200
        assert r.json().get("stamp_file", {}).get("id") == fref["id"]

    def test_delete_forbidden_for_user(self, user_token, part_id):
        r = requests.delete(f"{API}/spare-parts/{part_id}", headers=H(user_token))
        assert r.status_code == 403

    def test_delete_by_creator(self, creator_token, part_id):
        r = requests.delete(f"{API}/spare-parts/{part_id}", headers=H(creator_token))
        assert r.status_code == 200
        # verify 404
        r2 = requests.get(f"{API}/spare-parts/{part_id}", headers=H(creator_token))
        assert r2.status_code == 404


# ---------- Dashboard & Reports ----------
class TestDashboardReports:
    @pytest.mark.parametrize("slug", [
        "pressing", "welding", "painting", "injection", "seat",
        "assembling", "final-inspection",
    ])
    def test_dashboard_all_lines(self, user_token, slug):
        r = requests.get(f"{API}/dashboard/{slug}", headers=H(user_token))
        assert r.status_code == 200, f"{slug}: {r.text}"
        d = r.json()
        assert "summary" in d and "items" in d
        for k in ("total", "request", "penawaran", "nego", "afa", "po", "datang"):
            assert k in d["summary"]

    def test_monthly_report(self, user_token):
        r = requests.get(f"{API}/reports/monthly",
                         headers=H(user_token),
                         params={"month": 1, "year": 2026})
        assert r.status_code == 200
        d = r.json()
        for k in ("total", "by_status", "by_line", "items"):
            assert k in d
        for s in ("REQUEST", "PENAWARAN", "NEGO", "AFA PROCESS", "PO PROCESS", "DATANG"):
            assert s in d["by_status"]


# ---------- Cleanup leftover TEST_ parts ----------
@pytest.fixture(scope="session", autouse=True)
def _cleanup(creator_token):
    yield
    try:
        r = requests.get(f"{API}/spare-parts", headers=H(creator_token),
                         params={"q": "TEST_", "page_size": 100})
        if r.status_code == 200:
            for p in r.json().get("items", []):
                if p.get("nama_barang", "").startswith("TEST_"):
                    requests.delete(f"{API}/spare-parts/{p['id']}", headers=H(creator_token))
    except Exception:
        pass
