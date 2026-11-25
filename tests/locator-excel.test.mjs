import test from "node:test";
import assert from "node:assert/strict";
import {parseOpportunityRows,templateHeaders} from "../src/lib/locator-excel.ts";
const row=["24/11/2026","PagBank","Servidor A",123,"Cobrança",0,50000,30,100000,3000,null];
test("imports independent daily Excel data",()=>{const [r]=parseOpportunityRows([templateHeaders,row]);assert.equal(r.date,"2026-11-24");assert.equal(r.client,"PagBank");assert.equal(r.attempts,100000);assert.equal(r.agentType,0);});
test("rejects duplicate daily records",()=>assert.throws(()=>parseOpportunityRows([templateHeaders,row,row]),/duplicado/));
test("rejects missing required data and impossible totals",()=>{assert.throws(()=>parseOpportunityRows([["Data"],["2026-11-24"]]),/ausentes/);const bad=[...row];bad[9]=100001;assert.throws(()=>parseOpportunityRows([templateHeaders,bad]),/superar/);});
test("accepts blank mailing and optional dimensions",()=>{const [r]=parseOpportunityRows([["Data","Cliente","Campanha","Mailing","Logados","Discado","Atendidas"],[new Date("2026-11-24"),"PagBank","Teste",null,30,"100.000",3000]]);assert.equal(r.mailing,null);assert.equal(r.server,"Excel");assert.equal(r.campaignId,"Teste");assert.equal(r.attempts,100000);});
