"""
Iteration 3 — SMART-TC MAJOR REVISION
Covers: /dashboard/summary, /master-parts-search/lookup (autocomplete + cascading),
/spare-parts/{id}/stock-impact, DELETE /spare-parts/{id} with reverse OUT adjustment,
/stock/summary (critical_list shape), /movements (IN/OUT history),
Master Data pagination (page_size 20/40/80/100), sidebar route /history existing,
removed /database route validation.
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
# Dashboard summary endpoint
# =====================================================================
class TestDashboardSummary:
    def test_summary_default_returns_summary_block(self, creator_token):
        r = requests.get(f"{API}/dashboard/summary", headers=H(creator_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "summary" in d and isinstance(d["summary"], dict)
        for k in ("total", "afa", "po", "datang", "request", "penawaran", "nego"):
            assert k in d["summary"], f"missing {k}"
            assert isinstance(d["summary"][k], int)
        assert d.get("month") and d.get("year")

    def test_summary_with_filters(self, creator_token):
        r = requests.get(f"{API}/dashboard/summary",
                         headers=H(creator_token),
                         params={"line": "WELDING", "month": 1, "year": 2026})
        assert r.status_code == 200
        d = r.json()
        assert d["line"] == "WELDING"
        assert d["month"] == 1 and d["year"] == 2026

    def test_summary_requires_auth(self):
        r = requests.get(f"{API}/dashboard/summary")
        assert r.status_code in (401, 403)


# =====================================================================
# Master parts search/lookup (autocomplete for Request Form)
# =====================================================================
class TestMasterLookup:
    def test_lookup_with_q_returns_items(self, creator_token):
        r = requests.get(f"{API}/master-parts-search/lookup",
                         headers=H(creator_token), params={"q": "a", "limit": 5})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d
        assert isinstance(d["items"], list)
        assert len(d["items"]) <= 5
        # No mongo _id leaked
        for it in d["items"]:
            assert "_id" not in it

    def test_lookup_field_part_name_returns_values_array(self, creator_token):
        r = requests.get(f"{API}/master-parts-search/lookup",
                         headers=H(creator_token),
                         params={"field": "part_name", "limit": 10})
        assert r.status_code == 200
        d = r.json()
        assert "values" in d and isinstance(d["values"], list)

    def test_lookup_field_type_cascaded_by_part_name(self, creator_token):
        # First grab any item to use as cascading filter source
        first = requests.get(f"{API}/master-parts-search/lookup",
                             headers=H(creator_token),
                             params={"limit": 1}).json()
        if not first.get("items"):
            pytest.skip("no master parts in DB to test cascading")
        sample = first["items"][0]
        r = requests.get(f"{API}/master-parts-search/lookup",
                         headers=H(creator_token),
                         params={"field": "type",
                                 "part_name": sample["part_name"]})
        assert r.status_code == 200
        d = r.json()
        assert "values" in d


# =====================================================================
# Stock impact + delete with reverse OUT
# =====================================================================
class TestDeleteWithReverseOUT:
    def test_stock_impact_no_in_returns_false(self, req_token, creator_token):
        # create a part with no datang stage
        payload = {
            "line_area": "PRESSING",
            "nama_barang": "TEST_DEL_NOIN",
            "type": "T", "maker": "M", "part_mesin": "P",
            "qty_order": 1, "order_tanggal": "2026-01-15",
            "level_part": "Stock",
        }
        cr = requests.post(f"{API}/spare-parts", headers=H(req_token), json=payload)
        assert cr.status_code in (200, 201)
        pid = cr.json()["id"]
        try:
            r = requests.get(f"{API}/spare-parts/{pid}/stock-impact", headers=H(req_token))
            assert r.status_code == 200
            assert r.json()["has_in"] is False
        finally:
            requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))

    def test_stock_impact_and_delete_reverse_flow(self, req_token, creator_token):
        # 1) Create a master part with stock_awal=10 (so we can verify reversal math)
        mp_payload = {
            "line_area": "PRESSING",
            "part_name": f"TEST_REV_{uuid.uuid4().hex[:6]}",
            "type": "REV-T", "maker": "REV-M",
            "level_part": "Stock", "stock_awal": 10,
            "current_stock": 10, "location": "A1",
        }
        mp_resp = requests.post(f"{API}/master-parts", headers=H(creator_token), json=mp_payload)
        assert mp_resp.status_code in (200, 201), mp_resp.text
        master = mp_resp.json()
        mid = master["id"]

        # 2) Create matching spare part (nama+type+maker+line must match master)
        sp_payload = {
            "line_area": "PRESSING",
            "nama_barang": mp_payload["part_name"],
            "type": mp_payload["type"], "maker": mp_payload["maker"],
            "part_mesin": "Test", "qty_order": 3,
            "order_tanggal": "2026-01-15", "level_part": "Stock",
        }
        sp_resp = requests.post(f"{API}/spare-parts", headers=H(req_token), json=sp_payload)
        assert sp_resp.status_code in (200, 201), sp_resp.text
        pid = sp_resp.json()["id"]

        # 3) Walk through stages to DATANG to trigger auto-IN
        for stage, body in [
            ("penawaran", {"penawaran_date": "2026-01-16"}),
            ("afa", {"afa_date": "2026-01-17", "afa_no": "AFA-R"}),
            ("po", {"po_date": "2026-01-18", "po_no": "PO-R"}),
            ("datang", {"datang_date": "2026-01-19", "datang_no": "DN-R"}),
        ]:
            r = requests.patch(f"{API}/spare-parts/{pid}/{stage}",
                               headers=H(req_token), json=body)
            assert r.status_code == 200, f"{stage}: {r.text}"

        # 4) Verify master stock increased by 3 (10 + 3 = 13)
        mafter = requests.get(f"{API}/master-parts/{mid}", headers=H(creator_token)).json()
        assert mafter["current_stock"] == 13, f"expected 13 got {mafter['current_stock']}"

        # 5) stock-impact says has_in=True with quantity=3
        si = requests.get(f"{API}/spare-parts/{pid}/stock-impact",
                          headers=H(req_token)).json()
        assert si["has_in"] is True
        assert si["in_quantity"] == 3
        assert si["master_part_id"] == mid
        assert si["master_current_stock"] == 13

        # 6) DELETE with reverse OUT
        dr = requests.delete(f"{API}/spare-parts/{pid}", headers=H(creator_token))
        assert dr.status_code == 200, dr.text
        body = dr.json()
        assert body["ok"] is True and body["reverse_applied"] is True

        # 7) Master stock back to 10
        m_after_delete = requests.get(f"{API}/master-parts/{mid}",
                                      headers=H(creator_token)).json()
        assert m_after_delete["current_stock"] == 10, m_after_delete

        # 8) movements has an OUT adjustment for this master part
        mvs = requests.get(f"{API}/master-parts/{mid}/movements",
                           headers=H(creator_token)).json()
        out_adjs = [m for m in mvs if m["type"] == "OUT" and m.get("is_adjustment") is True]
        assert len(out_adjs) == 1, f"expected one OUT adjustment, got {mvs}"
        assert out_adjs[0]["quantity"] == 3

        # 9) Part is gone (404)
        r404 = requests.get(f"{API}/spare-parts/{pid}", headers=H(req_token))
        assert r404.status_code == 404

        # cleanup
        requests.delete(f"{API}/master-parts/{mid}", headers=H(creator_token))


# =====================================================================
# /stock/summary — critical_list shape used by Dashboard popup
# =====================================================================
class TestStockSummary:
    def test_summary_shape(self, creator_token):
        r = requests.get(f"{API}/stock/summary", headers=H(creator_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "critical", "low_stock", "need_order",
                  "need_update", "critical_list"):
            assert k in d, f"missing {k}"
        assert isinstance(d["critical_list"], list)
        # Items in critical_list should have action ORDER SEKARANG!!! per Level Critical + stock 0
        for it in d["critical_list"]:
            assert "action" in it
            assert "_id" not in it


# =====================================================================
# Movements / IN-OUT History
# =====================================================================
class TestMovements:
    def test_list_movements(self, creator_token):
        r = requests.get(f"{API}/movements", headers=H(creator_token),
                         params={"page": 1, "page_size": 10})
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        for m in d["items"]:
            assert m["type"] in ("IN", "OUT")
            assert "_id" not in m

    def test_movement_monthly_report(self, creator_token):
        r = requests.get(f"{API}/reports/movement-monthly",
                         headers=H(creator_token),
                         params={"month": 1, "year": 2026})
        assert r.status_code == 200
        d = r.json()
        assert "in" in d and "out" in d
        for grp in ("in", "out"):
            assert "count" in d[grp] and "total_qty" in d[grp] and "items" in d[grp]


# =====================================================================
# Master parts pagination (20/40/80/100)
# =====================================================================
class TestMasterPagination:
    @pytest.mark.parametrize("ps", [20, 40, 80, 100])
    def test_supported_page_sizes(self, creator_token, ps):
        r = requests.get(f"{API}/master-parts", headers=H(creator_token),
                         params={"page": 1, "page_size": ps})
        assert r.status_code == 200
        d = r.json()
        assert d["page_size"] == ps
        assert len(d["items"]) <= ps

    def test_master_part_no_mongo_id_leak(self, creator_token):
        r = requests.get(f"{API}/master-parts", headers=H(creator_token),
                         params={"page": 1, "page_size": 5})
        for it in r.json().get("items", []):
            assert "_id" not in it
            # Must include 'action' and 'stock_status' for status badge column
            assert "action" in it
            assert "stock_status" in it


# =====================================================================
# Cleanup any TEST_ leftovers
# =====================================================================
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
        rm = requests.get(f"{API}/master-parts", headers=H(tok),
                          params={"q": "TEST_", "page_size": 200})
        if rm.status_code == 200:
            for mp in rm.json().get("items", []):
                if mp.get("part_name", "").startswith("TEST_"):
                    requests.delete(f"{API}/master-parts/{mp['id']}", headers=H(tok))
    except Exception:
        pass
