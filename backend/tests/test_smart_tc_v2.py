"""
Iteration 2 — SMART-TC additions
Covers: level_part required + enum, lampiran_status, persisted status, PATCH edit endpoint
+ audit (edit_history) + permissions, backfill, indexes, pagination skip/limit,
filter by status/level_part, foto_datang upload, history[] preserved.
"""
import io
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREATOR_NIK = "32521"   # Cindy
REQUESTOR_NIK = "19376"  # Heri (original requestor in tests)
OTHER_NIK = "6282"       # Zulkifli (someone else)
DEFAULT_PWD = "123456"

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0"
    b"\x00\x00\x00\x03\x00\x01\xb5\x83\xda\x14\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _login(nik, pwd=DEFAULT_PWD):
    r = requests.post(f"{API}/auth/login", json={"nik": nik, "password": pwd})
    assert r.status_code == 200, f"login {nik} failed: {r.text}"
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def creator_token():
    return _login(CREATOR_NIK)


@pytest.fixture(scope="module")
def requestor_token():
    return _login(REQUESTOR_NIK)


@pytest.fixture(scope="module")
def other_token():
    return _login(OTHER_NIK)


def _make_part(token, **overrides):
    payload = {
        "line_area": "PRESSING",
        "nama_barang": "TEST_SMART_PART",
        "type": "X-1",
        "maker": "ACME",
        "part_mesin": "Mesin Z",
        "qty_order": 1,
        "order_tanggal": "2026-01-15",
        "level_part": "Critical",
        "keterangan": "iter2",
    }
    payload.update(overrides)
    r = requests.post(f"{API}/spare-parts", headers=H(token), json=payload)
    return r


# ============== CREATE: level_part required + enum ==============
class TestLevelPartCreate:
    def test_missing_level_part_returns_422(self, creator_token):
        r = requests.post(
            f"{API}/spare-parts",
            headers=H(creator_token),
            json={
                "line_area": "PRESSING",
                "nama_barang": "TEST_NOLEVEL",
                "type": "T", "maker": "M", "part_mesin": "P",
                "qty_order": 1, "order_tanggal": "2026-01-15",
            },
        )
        assert r.status_code == 422

    def test_invalid_level_part_returns_422(self, creator_token):
        r = _make_part(creator_token, level_part="Invalid", nama_barang="TEST_INVALID_LEVEL")
        assert r.status_code == 422

    @pytest.mark.parametrize("level", ["Critical", "Substitusi", "Stock"])
    def test_each_valid_level_part_accepted(self, creator_token, level):
        r = _make_part(creator_token, level_part=level, nama_barang=f"TEST_LEVEL_{level}")
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["level_part"] == level
        assert d["status"] == "REQUEST"
        # Defaults
        assert d.get("lampiran_status") == "BELUM"
        assert d.get("edit_history") == []
        # Cleanup
        requests.delete(f"{API}/spare-parts/{d['id']}", headers=H(creator_token))

    def test_missing_other_required_str_returns_422(self, creator_token):
        # Missing nama_barang (no default in model -> 422)
        r = requests.post(
            f"{API}/spare-parts",
            headers=H(creator_token),
            json={"line_area": "PRESSING", "type": "T", "maker": "M", "part_mesin": "P",
                  "order_tanggal": "2026-01-15", "level_part": "Stock"},
        )
        assert r.status_code == 422


# ============== Stored status field ==============
class TestStoredStatus:
    @pytest.fixture(scope="class")
    def part_id(self, requestor_token, creator_token):
        r = _make_part(requestor_token, nama_barang="TEST_STATUS_FLOW",
                       line_area="WELDING", order_tanggal="2026-01-15")
        assert r.status_code in (200, 201), r.text
        pid = r.json()["id"]
        yield pid
        requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))

    def test_initial_status_request(self, requestor_token, part_id):
        r = requests.get(f"{API}/spare-parts/{part_id}", headers=H(requestor_token))
        assert r.status_code == 200
        assert r.json()["status"] == "REQUEST"

    def test_penawaran_then_nego_updates_stored_status(self, requestor_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/penawaran", headers=H(requestor_token),
                           json={"penawaran_date": "2026-01-16"})
        assert r.status_code == 200 and r.json()["status"] == "PENAWARAN"
        # Verify filterable via stored status
        l = requests.get(f"{API}/spare-parts", headers=H(requestor_token),
                        params={"status": "PENAWARAN", "q": "TEST_STATUS_FLOW"})
        assert l.status_code == 200
        ids = [p["id"] for p in l.json()["items"]]
        assert part_id in ids
        # Nego
        r2 = requests.patch(f"{API}/spare-parts/{part_id}/penawaran", headers=H(requestor_token),
                            json={"nego_date": "2026-01-17"})
        assert r2.json()["status"] == "NEGO"

    def test_afa_po_datang_status_chain(self, requestor_token, part_id):
        r = requests.patch(f"{API}/spare-parts/{part_id}/afa", headers=H(requestor_token),
                           json={"afa_date": "2026-01-18", "afa_no": "AFA-T1"})
        assert r.json()["status"] == "AFA PROCESS"
        r = requests.patch(f"{API}/spare-parts/{part_id}/po", headers=H(requestor_token),
                           json={"po_date": "2026-01-19", "po_no": "PO-T1"})
        assert r.json()["status"] == "PO PROCESS"
        r = requests.patch(f"{API}/spare-parts/{part_id}/datang", headers=H(requestor_token),
                           json={"datang_date": "2026-01-20", "datang_no": "DN-T1"})
        assert r.json()["status"] == "DATANG"

    def test_history_array_still_appended(self, requestor_token, part_id):
        # Backend uses {"_id":0} projection; history should be in GET
        r = requests.get(f"{API}/spare-parts/{part_id}", headers=H(requestor_token))
        d = r.json()
        assert "history" in d and isinstance(d["history"], list)
        stages = [h.get("stage") for h in d["history"]]
        # Includes REQUEST at creation + stage entries
        assert "REQUEST" in stages
        assert any(s in stages for s in ("PENAWARAN", "AFA", "PO", "DATANG"))


# ============== Filters & pagination ==============
class TestFiltersAndPagination:
    def test_filter_by_level_part(self, creator_token):
        # Create a unique-marked Critical part to ensure presence
        r = _make_part(creator_token, level_part="Critical",
                       nama_barang="TEST_FILTER_CRIT", line_area="PRESSING")
        pid = r.json()["id"]
        try:
            l = requests.get(f"{API}/spare-parts", headers=H(creator_token),
                             params={"level_part": "Critical", "q": "TEST_FILTER_CRIT"})
            assert l.status_code == 200
            items = l.json()["items"]
            assert any(p["id"] == pid and p["level_part"] == "Critical" for p in items)
            # Ensure none has different level
            assert all(p["level_part"] == "Critical" for p in items)
        finally:
            requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))

    def test_pagination_skip_limit(self, creator_token):
        # Create 6 parts in same line
        ids = []
        for i in range(6):
            r = _make_part(creator_token, nama_barang=f"TEST_PAG_{i}",
                           line_area="INJECTION", order_tanggal=f"2026-01-{i+1:02d}",
                           level_part="Stock")
            ids.append(r.json()["id"])
        try:
            p1 = requests.get(f"{API}/spare-parts", headers=H(creator_token),
                              params={"line": "INJECTION", "year": 2026, "month": 1,
                                      "page": 1, "page_size": 5, "q": "TEST_PAG_"})
            p2 = requests.get(f"{API}/spare-parts", headers=H(creator_token),
                              params={"line": "INJECTION", "year": 2026, "month": 1,
                                      "page": 2, "page_size": 5, "q": "TEST_PAG_"})
            assert p1.status_code == 200 and p2.status_code == 200
            d1, d2 = p1.json(), p2.json()
            assert d1["total"] == d2["total"] >= 6
            assert len(d1["items"]) == 5
            assert 1 <= len(d2["items"]) <= 5
            ids1 = {x["id"] for x in d1["items"]}
            ids2 = {x["id"] for x in d2["items"]}
            assert ids1.isdisjoint(ids2)
        finally:
            for pid in ids:
                requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))


# ============== PATCH /spare-parts/{id} permissions + audit ==============
class TestPatchEditPermissionsAndAudit:
    @pytest.fixture
    def heri_part(self, requestor_token, creator_token):
        """Heri creates a part."""
        r = _make_part(requestor_token, nama_barang="TEST_EDIT_PERM",
                       level_part="Stock", line_area="SEAT")
        assert r.status_code in (200, 201)
        d = r.json()
        assert d["requestor_nik"] == REQUESTOR_NIK
        yield d
        requests.delete(f"{API}/spare-parts/{d['id']}", headers=H(creator_token))

    def test_requestor_can_edit_own(self, requestor_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token),
                           json={"qty_order": 5, "level_part": "Critical"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["qty_order"] == 5
        assert d["level_part"] == "Critical"
        # edit_history grew
        assert len(d["edit_history"]) == 1
        entry = d["edit_history"][0]
        assert entry["type"] == "EDIT"
        assert entry["actor_nik"] == REQUESTOR_NIK
        fields = {c["field"] for c in entry["changes"]}
        assert {"qty_order", "level_part"}.issubset(fields)

    def test_other_user_cannot_edit_403(self, other_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(other_token),
                           json={"qty_order": 9})
        assert r.status_code == 403

    def test_creator_can_edit_anyones(self, creator_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(creator_token),
                           json={"keterangan": "edited by creator"})
        assert r.status_code == 200
        assert r.json()["keterangan"] == "edited by creator"
        # Creator's entry appended
        assert any(e["actor_nik"] == CREATOR_NIK for e in r.json()["edit_history"])

    def test_no_change_no_history_entry(self, requestor_token, heri_part):
        # First get current state to determine current keterangan
        cur = requests.get(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token)).json()
        before = len(cur["edit_history"])
        # Send same value
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token),
                           json={"keterangan": cur["keterangan"]})
        assert r.status_code == 200
        assert len(r.json()["edit_history"]) == before  # no new entry

    def test_invalid_level_part_422(self, requestor_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token), json={"level_part": "Bogus"})
        assert r.status_code == 422

    def test_invalid_lampiran_status_422(self, requestor_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token), json={"lampiran_status": "MAYBE"})
        assert r.status_code == 422

    def test_lampiran_done_persists(self, requestor_token, heri_part):
        r = requests.patch(f"{API}/spare-parts/{heri_part['id']}",
                           headers=H(requestor_token),
                           json={"lampiran_status": "DONE",
                                 "lampiran_date": "2026-01-22",
                                 "lampiran_note": "diserahkan ke admin"})
        assert r.status_code == 200, r.text
        # Verify via subsequent GET
        g = requests.get(f"{API}/spare-parts/{heri_part['id']}",
                         headers=H(requestor_token)).json()
        assert g["lampiran_status"] == "DONE"
        assert g["lampiran_date"] == "2026-01-22"
        assert g["lampiran_note"] == "diserahkan ke admin"

    def test_patch_nonexistent_returns_404(self, creator_token):
        r = requests.patch(f"{API}/spare-parts/nonexistent-id-xyz",
                           headers=H(creator_token), json={"qty_order": 1})
        assert r.status_code == 404


# ============== Foto datang upload + persistence ==============
class TestFotoDatang:
    def test_upload_then_attach_foto_datang(self, requestor_token, creator_token):
        # Create part
        r = _make_part(requestor_token, nama_barang="TEST_FOTO_DATANG",
                       level_part="Stock", line_area="PAINTING")
        pid = r.json()["id"]
        try:
            up = requests.post(f"{API}/files/upload",
                               headers={"Authorization": f"Bearer {requestor_token}"},
                               files={"file": ("d.png", io.BytesIO(PNG_BYTES), "image/png")})
            assert up.status_code == 200
            fref = up.json()
            r = requests.patch(f"{API}/spare-parts/{pid}/datang", headers=H(requestor_token),
                               json={"datang_date": "2026-01-25", "datang_no": "DN-FD-1",
                                     "foto_datang": [fref]})
            assert r.status_code == 200
            d = r.json()
            assert d["status"] == "DATANG"
            assert isinstance(d.get("foto_datang"), list) and len(d["foto_datang"]) == 1
            assert d["foto_datang"][0]["id"] == fref["id"]
        finally:
            requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))


# ============== Backfill verification (all listed parts have new fields) ==============
class TestBackfill:
    def test_all_parts_have_new_fields(self, creator_token):
        r = requests.get(f"{API}/spare-parts", headers=H(creator_token),
                         params={"page": 1, "page_size": 50})
        assert r.status_code == 200
        for p in r.json()["items"]:
            assert "level_part" in p and p["level_part"] in {"Critical", "Substitusi", "Stock"}
            assert p.get("lampiran_status") in {"BELUM", "DONE"}
            assert "edit_history" in p and isinstance(p["edit_history"], list)
            assert "status" in p


# ============== Cleanup ==============
@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    try:
        tok = _login(CREATOR_NIK)
        r = requests.get(f"{API}/spare-parts", headers=H(tok),
                         params={"q": "TEST_", "page_size": 200})
        if r.status_code == 200:
            for p in r.json().get("items", []):
                if p.get("nama_barang", "").startswith("TEST_"):
                    requests.delete(f"{API}/spare-parts/{p['id']}", headers=H(tok))
    except Exception:
        pass
