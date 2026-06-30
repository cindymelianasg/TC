"""
Iteration 4 — SMART-TC Line/Area migration fix + Master Reset.
Covers:
- Strict line_area validation on POST/PUT /master-parts and import/preview
- GET /master-parts-admin/invalid-lines
- DELETE /master-parts-admin/reset-all (Creator only; NON-CREATOR -> 403)
- normalize_line no longer silently migrates legacy ASSEMBLING -> ASSEMBLING & FI

IMPORTANT: Do NOT actually call reset-all as Creator — DB has ~1209 legacy parts.
We only verify (a) endpoint exists and (b) non-creator returns 403.
"""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

CREATOR_NIK = "32521"
REQUESTOR_NIK = "19376"
PWD = "123456"


def _login(nik, pwd=PWD):
    r = requests.post(f"{API}/auth/login", json={"nik": nik, "password": pwd}, timeout=15)
    assert r.status_code == 200, f"login {nik}: {r.text}"
    return r.json()["access_token"]


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def creator_token():
    return _login(CREATOR_NIK)


@pytest.fixture(scope="module")
def req_token():
    return _login(REQUESTOR_NIK)


# =====================================================================
# Strict line_area validation on master-parts create/update
# =====================================================================
class TestLineAreaValidationCreateUpdate:
    def _mk(self, line_area, suffix=""):
        return {
            "line_area": line_area,
            "part_name": f"TEST_V4_{suffix or uuid.uuid4().hex[:6]}",
            "type": "T",
            "maker": "M",
            "level_part": "Stock",
            "stock_awal": 0,
            "current_stock": 0,
            "location": "X",
        }

    def test_create_with_invalid_assembling_returns_422(self, creator_token):
        r = requests.post(f"{API}/master-parts", headers=H(creator_token),
                          json=self._mk("ASSEMBLING"))
        assert r.status_code == 422, r.text
        assert "tidak valid" in r.text.lower()

    def test_create_with_invalid_fi_returns_422(self, creator_token):
        r = requests.post(f"{API}/master-parts", headers=H(creator_token),
                          json=self._mk("FI"))
        assert r.status_code == 422, r.text

    def test_create_with_invalid_final_inspection_returns_422(self, creator_token):
        r = requests.post(f"{API}/master-parts", headers=H(creator_token),
                          json=self._mk("FINAL INSPECTION"))
        assert r.status_code == 422, r.text

    def test_create_with_valid_assembling_and_fi_returns_200(self, creator_token):
        payload = self._mk("ASSEMBLING & FI", suffix=uuid.uuid4().hex[:6])
        r = requests.post(f"{API}/master-parts", headers=H(creator_token), json=payload)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d["line_area"] == "ASSEMBLING & FI"
        mid = d["id"]
        # cleanup
        requests.delete(f"{API}/master-parts/{mid}", headers=H(creator_token))

    def test_update_with_invalid_assembling_returns_422(self, creator_token):
        # create a valid one first
        payload = self._mk("PRESSING", suffix=uuid.uuid4().hex[:6])
        cr = requests.post(f"{API}/master-parts", headers=H(creator_token), json=payload)
        assert cr.status_code in (200, 201), cr.text
        mid = cr.json()["id"]
        try:
            r = requests.put(f"{API}/master-parts/{mid}",
                             headers=H(creator_token),
                             json={"line_area": "ASSEMBLING"})
            assert r.status_code == 422, r.text
        finally:
            requests.delete(f"{API}/master-parts/{mid}", headers=H(creator_token))

    def test_update_with_valid_returns_200(self, creator_token):
        payload = self._mk("PRESSING", suffix=uuid.uuid4().hex[:6])
        cr = requests.post(f"{API}/master-parts", headers=H(creator_token), json=payload)
        assert cr.status_code in (200, 201)
        mid = cr.json()["id"]
        try:
            r = requests.put(f"{API}/master-parts/{mid}",
                             headers=H(creator_token),
                             json={"line_area": "WELDING"})
            assert r.status_code == 200, r.text
            assert r.json()["line_area"] == "WELDING"
        finally:
            requests.delete(f"{API}/master-parts/{mid}", headers=H(creator_token))


# =====================================================================
# Import preview line_area validation
# =====================================================================
class TestImportPreviewValidation:
    def test_import_preview_invalid_line_returns_422(self, creator_token):
        payload = {
            "line_area": "ASSEMBLING",
            "rows": [{"part_name": "TEST_V4_IMP", "type": "T", "maker": "M", "current_stock": 0}],
        }
        r = requests.post(f"{API}/master-parts/import/preview",
                          headers=H(creator_token), json=payload)
        assert r.status_code == 422, r.text

    def test_import_preview_valid_welding_returns_200(self, creator_token):
        payload = {
            "line_area": "WELDING",
            "rows": [{"part_name": f"TEST_V4_IMP_{uuid.uuid4().hex[:6]}",
                      "type": "T", "maker": "M", "current_stock": 5}],
        }
        r = requests.post(f"{API}/master-parts/import/preview",
                          headers=H(creator_token), json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "rows" in d and "summary" in d
        assert d["summary"]["total"] == 1


# =====================================================================
# invalid-lines endpoint
# =====================================================================
class TestInvalidLinesEndpoint:
    def test_invalid_lines_shape(self, creator_token):
        r = requests.get(f"{API}/master-parts-admin/invalid-lines",
                         headers=H(creator_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "count" in d and "samples" in d and "valid_lines" in d
        assert isinstance(d["count"], int)
        assert isinstance(d["samples"], list)
        assert d["valid_lines"] == ["PRESSING", "WELDING", "PAINTING",
                                    "INJECTION", "SEAT", "ASSEMBLING & FI"]
        # No _id leak
        for s in d["samples"]:
            assert "_id" not in s

    def test_invalid_lines_requires_auth(self):
        r = requests.get(f"{API}/master-parts-admin/invalid-lines")
        assert r.status_code in (401, 403)


# =====================================================================
# reset-all endpoint — Creator only. We DO NOT actually delete data.
# =====================================================================
class TestResetAllEndpoint:
    def test_reset_all_non_creator_403(self, req_token):
        r = requests.delete(f"{API}/master-parts-admin/reset-all",
                            headers=H(req_token))
        assert r.status_code == 403, r.text

    def test_reset_all_unauthenticated_returns_401_or_403(self):
        r = requests.delete(f"{API}/master-parts-admin/reset-all")
        assert r.status_code in (401, 403)

    # NOTE: Deliberately NO positive test that runs reset as Creator — would
    # wipe ~1209 production-like rows in the preview DB.


# =====================================================================
# normalize_line behavior — query filter should NOT migrate ASSEMBLING -> ASSEMBLING & FI
# Verified via GET /master-parts?line=ASSEMBLING (legacy data only)
# =====================================================================
class TestNormalizeLineNoSilentMigration:
    def test_filter_assembling_returns_only_legacy_assembling(self, creator_token):
        r = requests.get(f"{API}/master-parts", headers=H(creator_token),
                         params={"line": "ASSEMBLING", "page_size": 5})
        assert r.status_code == 200, r.text
        items = r.json().get("items", [])
        # Every returned item must have line_area exactly "ASSEMBLING" (legacy),
        # not "ASSEMBLING & FI".
        for it in items:
            assert it["line_area"] == "ASSEMBLING", (
                f"normalize_line is silently migrating: got {it['line_area']}"
            )

    def test_filter_valid_assembling_and_fi(self, creator_token):
        r = requests.get(f"{API}/master-parts", headers=H(creator_token),
                         params={"line": "ASSEMBLING & FI", "page_size": 5})
        assert r.status_code == 200
        for it in r.json().get("items", []):
            assert it["line_area"] == "ASSEMBLING & FI"


# =====================================================================
# Regression — Form Request still functional (autocomplete lookup intact)
# =====================================================================
class TestRequestFormAutocompleteRegression:
    def test_lookup_q_still_works(self, req_token):
        r = requests.get(f"{API}/master-parts-search/lookup",
                         headers=H(req_token), params={"q": "a", "limit": 3})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d


# =====================================================================
# Stock summary by specific line — used by Dashboard "Total Part" card
# =====================================================================
class TestStockSummaryByLine:
    def test_stock_summary_specific_line(self, creator_token):
        r = requests.get(f"{API}/stock/summary", headers=H(creator_token),
                         params={"line": "ASSEMBLING & FI"})
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and isinstance(d["total"], int)

    def test_stock_summary_no_line(self, creator_token):
        r = requests.get(f"{API}/stock/summary", headers=H(creator_token))
        assert r.status_code == 200
        d = r.json()
        assert "total" in d


# =====================================================================
# Cleanup any TEST_V4 leftovers
# =====================================================================
@pytest.fixture(scope="session", autouse=True)
def _cleanup():
    yield
    try:
        tok = _login(CREATOR_NIK)
        rm = requests.get(f"{API}/master-parts", headers=H(tok),
                          params={"q": "TEST_V4", "page_size": 200})
        if rm.status_code == 200:
            for mp in rm.json().get("items", []):
                if mp.get("part_name", "").startswith("TEST_V4"):
                    requests.delete(f"{API}/master-parts/{mp['id']}", headers=H(tok))
    except Exception:
        pass
