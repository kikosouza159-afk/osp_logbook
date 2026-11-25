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

    def test_sql_consolidated_uses_two_parameters_and_agent_aggregation(self):
        sql = etl.QUERY_FILE.read_text(encoding="utf-8-sig")
        self.assertEqual(sql.count("?"), 2)
        self.assertIn("ImportExportControl.dbo.ReportImport", sql)
        self.assertNotIn("OLOSMEFFLADTB01.ImportExportControl", sql)
        self.assertIn("GROUP BY A.CampaignId, A.AgentId", sql)
        self.assertIn("OPTION (MAXDOP 2, RECOMPILE)", sql)
        self.assertIn("QUOTENAME(@NomeTabela)", sql)
        self.assertIn("SELECT Data, NomeTabela", sql)
        self.assertIn("M.Data AS MailingData", sql)
        self.assertIn("IF @DataAtual = @Hoje", sql)

    def test_extract_period_two_results_with_missing_partition(self):
        from datetime import date
        class FakeCursor:
            sets = [
                (["Nome_Servidor", "Data", "CampaignId", "NomeCampanha", "Mailing",
                  "Logados", "Tentativas", "Atendidas", "VirtualAgentTypeId", "MailingData"],
                 [("TEST", date(2026,11,10), 123, "Teste", 60000, 40, 100000, 3500, 4,
                   date(2026,11,9))]),
                (["Data", "NomeTabela"], [(date(2026,11,11), "AttemptsRawData_2026_11_11")])
            ]
            def __init__(self):
                self.idx = 0
                self.description = None
            def execute(self, sql, start, end):
                self.start, self.end = start, end
                self.sql = sql
                self.description = [(k,) for k in self.sets[0][0]]
                return self
            def fetchall(self):
                return self.sets[self.idx][1]
            def nextset(self):
                self.idx += 1
                if self.idx >= len(self.sets):
                    return False
                self.description = [(k,) for k in self.sets[self.idx][0]]
                return True

        cur=FakeCursor()
        calls,missing=etl.extract_period(cur,date(2026,11,10),date(2026,11,11))
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0]["CampaignId"],123)
        self.assertEqual(missing[0]["NomeTabela"],"AttemptsRawData_2026_11_11")
        self.assertEqual(cur.start,date(2026,11,10))
        self.assertEqual(cur.end,date(2026,11,11))

    def test_extract_period_requires_both_result_sets(self):
        from datetime import date
        class MissingSet:
            description = [("CampaignId",), ("Data",)]
            def execute(self, sql, start, end):return self
            def fetchall(self):return []
            def nextset(self):return False
        with self.assertRaises(RuntimeError):
            etl.extract_period(MissingSet(),date(2026,11,10),date(2026,11,11))

    def test_period_dry_run_skips_missing_and_preserves_existing(self):
        from datetime import date
        from unittest.mock import patch
        class FakeConn:
            closed=False
            def cursor(self):return object()
            def close(self):self.closed=True
        conn=FakeConn()
        row={"Data":date(2026,11,10),"CampaignId":123,"Nome_Servidor":"TEST",
             "NomeCampanha":"Teste", "Mailing":60000, "MailingData":date(2026,11,9),
             "VirtualAgentTypeId":4,"Logados":40,"Tentativas":100000,"Atendidas":3500}
        with patch.object(etl,"sql_connection",return_value=conn),patch.object(etl,"extract_period",return_value=([row],
            [{"Data":date(2026,11,11),"NomeTabela":"AttemptsRawData_2026_11_11"}])):
            counts,total=etl.process_period(None,{"host":"10.0.0.1","client":"Teste",
                "cliente_painel":"Teste"},date(2026,11,10),date(2026,11,11),True)
        self.assertTrue(conn.closed)
        self.assertEqual(total,1)
        self.assertEqual(counts["SUCCESS"],1)
        self.assertEqual(counts["SKIPPED"],1)

    def test_reject_duplicate_daily_campaign_rows(self):
        from datetime import date
        from unittest.mock import patch
        class FakeConn:
            def cursor(self):return object()
            def close(self):pass
        row={"Data":date(2026,11,10),"CampaignId":123}
        with patch.object(etl,"sql_connection",return_value=FakeConn()),patch.object(
            etl,"extract_period",return_value=([row,row],[])):
            with self.assertRaisesRegex(ValueError,"duplicada"):
                etl.process_period(None,{"host":"10.0.0.1"},date(2026,11,10),
                                   date(2026,11,10),True)


if __name__ == "__main__":
    unittest.main()
