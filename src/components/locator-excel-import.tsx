"use client";
import { useEffect,useRef,useState } from "react";
import { FileSpreadsheet,Upload,Download,Trash2,CircleAlert,CheckCircle2 } from "lucide-react";
import { parseOpportunityRows,templateHeaders,type Daily } from "@/lib/locator-excel";

async function downloadTemplate(){
  const {default:JSZip}=await import("jszip");
  const z=new JSZip();
  z.file("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  z.file("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  z.file("xl/workbook.xml",'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dados" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file("xl/_rels/workbook.xml.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  const cells=templateHeaders.map((h,i)=>'<c r="'+String.fromCharCode(65+i)+'1" t="inlineStr"><is><t>'+h+'</t></is></c>').join("");
  z.file("xl/worksheets/sheet1.xml",'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">'+cells+'</row></sheetData></worksheet>');
  const blob=await z.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="Modelo_Oportunidades_Locator.xlsx";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function LocatorExcelImport({loaded,onImport,onClear}:{loaded:{name:string;sheet:string;rows:Daily[]}|null;onImport:(rows:Daily[],name:string,sheet:string)=>void;onClear:()=>void}){
  const [file,setFile]=useState<File|null>(null),[sheets,setSheets]=useState<string[]>([]),[sheet,setSheet]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const token=useRef(0);const input=useRef<HTMLInputElement>(null);
  useEffect(()=>()=>{token.current++;},[]);
  async function choose(f:File|null){
    const id=++token.current;setFile(null);setSheets([]);setSheet("");setError("");setBusy(false);if(!f)return;
    if(!/\.xlsx$/i.test(f.name)||f.size>10*1024*1024){setError("Selecione um Excel .xlsx de até 10 MB.");return;}
    setBusy(true);
    try{const {readSheetNames}=await import("read-excel-file/browser");const names=await readSheetNames(f);if(id!==token.current)return;if(!names.length)throw Error("Arquivo sem planilhas.");setFile(f);setSheets(names);setSheet(names[0]);}
    catch(e){if(id===token.current)setError(e instanceof Error?e.message:"Não foi possível abrir o Excel.");}
    finally{if(id===token.current)setBusy(false);}
  }
  async function load(){
    if(!file||!sheet)return;const id=++token.current;setBusy(true);setError("");
    try{const {default:read}=await import("read-excel-file/browser");const cells=await read(file,{sheet});const rows=parseOpportunityRows(cells);if(id===token.current)onImport(rows,file.name,sheet);}
    catch(e){if(id===token.current)setError(e instanceof Error?e.message:"Falha na importação.");}
    finally{if(id===token.current)setBusy(false);}
  }
  function clear(){token.current++;setBusy(false);setError("");setFile(null);setSheets([]);setSheet("");if(input.current)input.current.value="";onClear();}
  return <section className="lo-panel lo-excel-panel">
    <div className="lo-section-head"><div><small>FONTE INDEPENDENTE · EXCEL</small><h2>Importar base de oportunidades</h2></div><button className="lo-btn lo-btn-secondary" onClick={()=>void downloadTemplate().catch(()=>setError("Falha ao gerar modelo."))}><Download size={16}/> Baixar modelo XLSX</button></div>
    <p>Use uma linha por cliente, servidor, campanha e dia. O arquivo é lido apenas neste navegador e não é enviado ao Neon. Colunas obrigatórias: Data, Cliente, NomeCampanha, Mailing, Logados, Tentativas e Atendidas. Servidor, CampaignId, Tipo e MailingData são opcionais; informe os dois primeiros para distinguir campanhas com nomes iguais.</p>
    <div className="lo-excel-controls"><label className="lo-excel-file"><FileSpreadsheet size={24}/><span><b>{file?.name||"Selecionar arquivo Excel"}</b><small>.xlsx · até 10 MB / 50 mil registros</small></span><input ref={input} type="file" accept=".xlsx" disabled={busy} onChange={e=>void choose(e.target.files?.[0]??null)}/></label>
    {sheets.length>0&&<label className="lo-excel-sheet">Planilha<select value={sheet} disabled={busy} onChange={e=>setSheet(e.target.value)}>{sheets.map(s=><option key={s}>{s}</option>)}</select></label>}
    <button className="lo-btn lo-excel-primary" disabled={!file||!sheet||busy} onClick={()=>void load()}><Upload size={16}/>{busy?"Lendo…":"Importar e analisar"}</button>
    {loaded&&<button className="lo-btn lo-btn-secondary" onClick={clear}><Trash2 size={16}/> Limpar base</button>}</div>
    {error&&<div className="lo-warning" role="alert"><CircleAlert size={17}/>{error} {loaded?"A base anterior continua ativa.":""}</div>}
    {loaded&&<><div className="lo-excel-success"><CheckCircle2 size={18}/><span><b>{loaded.name} · {loaded.sheet}</b> · {loaded.rows.length.toLocaleString("pt-BR")} linhas válidas · somente Excel</span></div><div className="lo-table-scroll"><table className="lo-table"><thead><tr><th>Data</th><th>Cliente</th><th>Campanha</th><th>Mailing</th><th>Logados</th><th>Tentativas</th><th>Atendidas</th></tr></thead><tbody>{loaded.rows.slice(0,5).map((r,i)=><tr key={i}><td>{r.date}</td><td>{r.client}</td><td>{r.campaign}</td><td>{r.mailing??"—"}</td><td>{r.logged}</td><td>{r.attempts}</td><td>{r.answered}</td></tr>)}</tbody></table></div><p className="lo-fineprint">Prévia das primeiras 5 linhas. Todos os registros válidos entram na análise abaixo. A base fica disponível enquanto esta página estiver aberta.</p></>}
  </section>;
}
