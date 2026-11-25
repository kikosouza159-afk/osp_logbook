import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "etl_locator.py"
spec = importlib.util.spec_from_file_location("locator_etl", SCRIPT)
etl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(etl)


class LocatorEtlTests(unittest.TestCase):
    def test_campaign_depara_prevents_shared_client_misassignment(self):
        source = {
            "host": "10.0.0.1", "client": "FastFlow",
            "depara_campanhas_painel": {"202": "AssistPay"},
            "vinculos_painel": [{"cliente": "AssistPay"},{"cliente": "PagBank"}]
        }
        self.assertEqual(etl.resolve_client(source, 202), ("AssistPay", "RESOLVED"))
        name, status = etl.resolve_client(source, 999)
        self.assertEqual(status, "UNRESOLVED")
        self.assertIn("A validar", name)

    def test_energisa_345_vendas_other_cobranca(self):
        source = {"host": "10.0.0.2", "client": "Energisa"}
        self.assertEqual(etl.resolve_client(source, 345), ("Energisa - SDR", "RESOLVED"))
        self.assertEqual(etl.resolve_client(source, 356), ("Energisa - Cobrança", "RESOLVED"))

    def test_single_client_even_when_two_products(self):
        source = {"client": "Boticario", "vinculos_painel": [
            {"cliente": "Boticário", "produto": "ADA"},
            {"cliente": "Boticário", "produto": "Locator"}]}
        self.assertEqual(etl.resolve_client(source, 125), ("Boticário", "RESOLVED"))

    def test_sources_exclude_inactive_and_do_not_duplicate_hosts(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp)/"servidores.json"
            p.write_text(json.dumps([
                {"Ativo": 1, "host": "10.0.0.1", "client": "A"},
                {"Ativo": 0, "host": "10.0.0.2", "client": "B"}]), encoding="utf-8")
            self.assertEqual(len(etl.get_sources(p)),1)
            p.write_text(json.dumps([
                {"Ativo": 1, "host": "10.0.0.1"},
                {"Ativo": 1, "host": "10.0.0.1"}]),encoding="utf-8")
            with self.assertRaises(ValueError):
                etl.get_sources(p)

    def test_unsafe_attempts_table_rejected(self):
        class FakeCursor:
            pass
        from datetime import date
        with self.assertRaises(ValueError):
            etl.extract_calls(FakeCursor(),date(2026,11,10),"AttemptsRawData];DROP TABLE foo")


if __name__ == "__main__":
    unittest.main()
