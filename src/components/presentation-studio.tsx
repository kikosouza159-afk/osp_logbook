"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, ChevronDown, Download, FileSpreadsheet, FileUp, Image as ImageIcon, Maximize2, Presentation, RefreshCw, Save, Sparkles } from "lucide-react";
import "./presentation-studio.css";

type Line = { indicador: string; grupo: string; [key: string]: string };
type Cost = { indicador: string; tipo: string; estimado: string; projetado: string; observacao?: string };
type Model = {
  meta: { cliente: string; prefixo: string; subtitulo_funil: string; subtitulo_financeiro: string; comparabilidade_confirmada: boolean; layout: string };
  funnel: { periods: string[]; rows: Line[]; produtividade_modo?: string; executive: { kpi_rows: string[]; destaques: string[]; banner_inicio: string; banner_destaque: string; banner_fim: string; observacoes: string; sintese_executiva: string } };
  financial: { rows: Cost[]; auto_total: boolean; cenario_atual: string; cenario_projetado: string; custo_hc: string; custo_infra: string; cards: { top: string[]; bottom: string[] }; executive: { equalizacao: string; regra_logado: string; titulo_resultado: string; sintese_executiva: string; insight: string; receita_adicional: string } };
};
const ORANGE = "#FB5C28", NAVY = "#000049", BLUE = "#345F99";
const KPIS = ["Mailing","Discado","Atendimento","Localização","Negócio","Spin","% Atendimento (período)","% Localização (período)","% Conversão (período)","Abandonadas","Logados","Telecom","Mailing por Logado","CPC por Logado","Sucesso / Logado","Telecom por CPC (período)"];
const INPUTS = ["Campanha","Mailing","Discado","Atendimento","Localização","Negócio","Abandonadas","Logados","Telecom","Telecom por CPC (período)"];
const AUTO = ["Spin","% Atendimento (período)","% Localização (período)","% Conversão (período)","Mailing por Logado","CPC por Logado","Sucesso / Logado"];
const cardNames:Record<string,string> = {economia:"Economia custo mês",reducao_percentual:"Redução percentual",economia_anual:"Economia ano",receita_adicional:"Acréscimo Receita",reducao_pa:"Redução de PA",reducao_hc:"Redução de HC",custo_estimado:"Custo estimado",custo_projetado:"Custo projetado",pa_estimado:"PA estimado",pa_projetado:"PA projetado",hc_estimado:"HC estimado",hc_projetado:"HC projetado"};
const cardOptions = ["economia","reducao_percentual","economia_anual","receita_adicional","reducao_pa","reducao_hc","custo_estimado","custo_projetado","pa_estimado","pa_projetado","hc_estimado","hc_projetado"];
const demo: Model = {
 meta:{cliente:"CLIENTE",prefixo:"POC LOCATOR",subtitulo_funil:"Comparativo de performance média diária",subtitulo_financeiro:"Visão comparativa mensal equalizada",comparabilidade_confirmada:false,layout:"executivo"},
 funnel:{periods:["Setembro","08.10 a 23.10"],produtividade_modo:"automatico",rows:[
 {grupo:"FUNIL",indicador:"Campanha",Setembro:"Ativo","08.10 a 23.10":"Locator"},
 ...[["Mailing","14.340","8.499"],["Discado","40.889","152.482"],["Atendimento","734","4.030"],["Localização","23","293"],["Negócio","6","7"],["Abandonadas","–","–"],["Logados","17","9,0"],["Telecom","R$ 346,54","R$ 1.292,31"],["Telecom por CPC (período)","R$ 15,07","R$ 4,41"]].map(([indicador,one,two])=>({grupo:"FUNIL",indicador,Setembro:one,"08.10 a 23.10":two}))],
 executive:{kpi_rows:KPIS.slice(0,12),destaques:["Mailing por Logado","CPC por Logado","Sucesso / Logado","Telecom por CPC (período)"],banner_inicio:"Comparativo entre cenários",banner_destaque:"Indicadores por logado",banner_fim:"Confirme a comparabilidade para apresentar as variações.",observacoes:"Revise a duração e a origem dos indicadores.",sintese_executiva:"Preencha aqui a Síntese Executiva revisada pelo responsável pela POC."}},
 financial:{auto_total:true,cenario_atual:"Ativo",cenario_projetado:"Locator",custo_hc:"2.917,80",custo_infra:"650",rows:[
 ...[["PA","Número","9","3"],["Qtde Pessoas CLT","Número","17","4"],["Dias operação mês","Número","21","21"],["Custos Pessoas","Moeda","R$ 49.603","R$ 12.213"],["Infraestrutura física","Moeda","R$ 5.850","R$ 1.950"],["Telecom","Moeda","R$ 7.277","R$ 27.139"],["Locator","Moeda","R$ –","R$ 8.110"],["Custo","Moeda","R$ 62.730","R$ 49.412"]].map(([indicador,tipo,estimado,projetado])=>({indicador,tipo,estimado,projetado,observacao:""}))],
 cards:{top:["economia","reducao_percentual"],bottom:["economia_anual","receita_adicional","reducao_pa","reducao_hc"]},
 executive:{equalizacao:"Para o comparativo, equalizamos a quantidade de pessoas e telecom necessária para o mesmo patamar de acordos.",regra_logado:"Logado = tempo logado / 08h12min",titulo_resultado:"Síntese Financeira",sintese_executiva:"Resultado obtido a partir dos custos informados.",insight:"Registre aqui as conclusões executivas, após revisão das premissas.",receita_adicional:""}}
};
function val(input:unknown):number|null {
 if(typeof input === "number")return Number.isFinite(input)?input:null;
 let v=String(input??"").trim().replace(/[^\d,.\-]/g,"");
 if(!v || v==="-")return null;
 if(v.includes(","))v=v.replace(/\./g,"").replace(",",".");
 else if((v.match(/\./g)||[]).length>1)v=v.replace(/\./g,"");
 else if(v.includes(".") && v.split(".").at(-1)?.length===3)v=v.replace(".","");
 const n=Number(v);return Number.isFinite(n)?n:null;
}
const br=(n:number,d=0)=>n.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d});
const money=(n:number)=>"R$ "+br(n,0);
function raw(model:Model,label:string,period:string):string {
 return String(model.funnel.rows.find(r=>r.indicador===label)?.[period]??"–");
}
function kpi(model:Model,label:string,period:string):string {
 const n=(name:string)=>val(raw(model,name,period));
 const ratio=(a:number|null,b:number|null,d=1,isPercent=false)=>a!==null && b!==null && b!==0?br(a/b*(isPercent?100:1),d)+(isPercent?"%":""):"–";
 switch(label){
 case "Spin":return ratio(n("Discado"),n("Mailing"),2);
 case "% Atendimento (período)":return ratio(n("Atendimento"),n("Discado"),2,true);
 case "% Localização (período)":return ratio(n("Localização"),n("Atendimento"),2,true);
 case "% Conversão (período)":return ratio(n("Negócio"),n("Localização"),2,true);
 case "Mailing por Logado":return ratio(n("Mailing"),n("Logados"));
 case "CPC por Logado":return model.funnel.produtividade_modo==="manual"?raw(model,label,period):ratio(n("Localização"),n("Logados"));
 case "Sucesso / Logado":return model.funnel.produtividade_modo==="manual"?raw(model,label,period):ratio(n("Negócio"),n("Logados"));
 default:return raw(model,label,period);
 }
}
function costs(model:Model) {
 const rows=model.financial.rows;
 const costLine=rows.find(r=>r.indicador.trim().toLowerCase()==="custo");
 const sum=(key:"estimado"|"projetado")=>model.financial.auto_total?rows.filter(r=>r.tipo==="Moeda" && r!==costLine).reduce((a,r)=>a+(val(r[key])||0),0):val(costLine?.[key])||0;
 const estimated=sum("estimado"),projected=sum("projetado");
 return {estimated,projected,saving:estimated-projected,delta:estimated?(projected/estimated-1)*100:null};
}
function card(model:Model,id:string):[string,string] {
 const t=costs(model),row=(name:string,key:"estimado"|"projetado")=>val(model.financial.rows.find(r=>r.indicador===name)?.[key])||0;
 const dictionary:Record<string,string> = {
 economia:money(t.saving),reducao_percentual:t.delta===null?"–":br(t.delta,1)+"%",economia_anual:money(t.saving*12),
 receita_adicional:model.financial.executive.receita_adicional||"R$ –",
 reducao_pa:br(row("PA","projetado")-row("PA","estimado"))+" PA",
 reducao_hc:br(row("Qtde Pessoas CLT","projetado")-row("Qtde Pessoas CLT","estimado"))+" HC",
 custo_estimado:money(t.estimated),custo_projetado:money(t.projected),
 pa_estimado:br(row("PA","estimado")),pa_projetado:br(row("PA","projetado")),
 hc_estimado:br(row("Qtde Pessoas CLT","estimado")),hc_projetado:br(row("Qtde Pessoas CLT","projetado"))
 };
 return [cardNames[id]||"Indicador",dictionary[id]||"–"];
}
function wrapSvg(value:string,max=52,maxLines=5) {
 const lines:string[]=[];let line="";
 for(const word of String(value||"").replace(/\r/g,"").split(/\s+/)){
   if(!word)continue;
   if((line+" "+word).trim().length>max){if(line)lines.push(line);line=word.slice(0,max);}
   else line=(line+" "+word).trim();
 }
 if(line)lines.push(line);
 if(lines.length>maxLines){const limited=lines.slice(0,maxLines);limited[maxLines-1]=limited[maxLines-1].slice(0,max-1)+"…";return limited;}
 return lines;
}
function SlideShell({heading,subtitle,children}:{heading:string;subtitle:string;children:React.ReactNode}) {
 return <><defs><linearGradient id="n" x1="0" y1="0" x2="1" y2="0"><stop stopColor={NAVY}/><stop offset="1" stopColor="#183D83"/></linearGradient><linearGradient id="o" x1="0" x2="1"><stop stopColor="#FC6E33"/><stop offset="1" stopColor={ORANGE}/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#15245E" floodOpacity=".13"/></filter></defs>
 <rect width="1600" height="900" fill="#F5F7FB"/><g fill="none" stroke="#DCE2EC" opacity=".45" strokeWidth="2"><ellipse cx="175" cy="200" rx="185" ry="78" transform="rotate(-47 175 200)"/><ellipse cx="420" cy="320" rx="180" ry="78" transform="rotate(-47 420 320)"/><ellipse cx="240" cy="690" rx="200" ry="84" transform="rotate(-47 240 690)"/></g>
 <text x="72" y="59" fill={NAVY} fontSize="13" fontWeight="600">ELEVANDO EXPERIÊNCIAS</text><text x="1420" y="63" fill={ORANGE} fontSize="37" fontWeight="900" letterSpacing="-1">OLOS</text>
 <rect x="69" y="103" width="10" height="83" rx="5" fill={ORANGE}/><text x="101" y="142" fill={NAVY} fontSize="47" fontWeight="800">{heading.slice(0,57)}</text><text x="101" y="187" fill="#69717F" fontSize="29">{subtitle.slice(0,88)}</text>{children}
 <rect x="1542" y="817" width="31" height="72" rx="16" fill="none" stroke={NAVY} strokeWidth="2"/><text x="1557" y="836" fontSize="12" textAnchor="middle" fill={NAVY}>H</text><text x="1557" y="851" fontSize="12" textAnchor="middle" fill={NAVY}>A</text><text x="1557" y="866" fontSize="12" textAnchor="middle" fill={NAVY}>V</text><text x="1557" y="881" fontSize="12" textAnchor="middle" fill={NAVY}>J</text></>;
}
function FunnelSlide({model}:{model:Model}) {
 const [first,last]=[model.funnel.periods[0],model.funnel.periods.at(-1)||""];
 const rows=model.funnel.executive.kpi_rows.slice(0,14);
 const dots=model.funnel.executive.destaques.slice(0,4);
 const cellH=34;
 return <SlideShell heading={"POC LOCATOR | "+model.meta.cliente.toUpperCase()} subtitle={model.meta.subtitulo_funil}>
 <rect x="58" y="228" width="667" height="623" rx="20" fill="#FFF" filter="url(#shadow)"/>
 <rect x="75" y="244" width="631" height="63" rx="10" fill="#F3F6FC"/>
 <text x="99" y="284" fontSize="22" fontWeight="800" fill={NAVY}>KPI</text><text x="413" y="265" textAnchor="middle" fontSize="17" fill={NAVY}>{first.slice(0,22)}</text><text x="413" y="290" textAnchor="middle" fontSize="16" fontWeight="800" fill={BLUE}>{kpi(model,"Campanha",first).slice(0,18)}</text>
 <text x="542" y="265" textAnchor="middle" fontSize="17" fill={ORANGE}>{last.slice(0,22)}</text><text x="542" y="290" textAnchor="middle" fontSize="16" fontWeight="800" fill={ORANGE}>{kpi(model,"Campanha",last).slice(0,18)}</text><text x="659" y="270" textAnchor="middle" fontSize="15" fill={NAVY}>Δ</text><text x="659" y="290" textAnchor="middle" fontSize="13" fill={NAVY}>variação</text>
 {rows.map((label,i)=>{
 const y=316+i*cellH,old=val(kpi(model,label,first)),cur=val(kpi(model,label,last));
 const delta=model.meta.comparabilidade_confirmada && old!==null&&cur!==null&&old!==0?br((cur/old-1)*100,1)+"%":"–";
 return <g key={label+"-"+i}><rect x="76" y={y} width="631" height={cellH-1} rx="6" fill={i%2?"#FFF":"#F7FAFE"}/><text x="99" y={y+22} fontSize="16" fill={NAVY} fontWeight="600">{label.length>27?label.slice(0,26)+"…":label}</text><text x="418" y={y+22} textAnchor="middle" fontSize="17" fill={NAVY}>{kpi(model,label,first).slice(0,16)}</text><text x="541" y={y+22} textAnchor="middle" fontSize="17" fill={ORANGE} fontWeight="700">{kpi(model,label,last).slice(0,16)}</text><text x="650" y={y+22} textAnchor="middle" fontSize="14" fill={delta.startsWith("-")?"#B9402B":"#157A55"}>{delta.slice(0,14)}</text></g>;
 })}
 <rect x="744" y="228" width="795" height="152" rx="18" fill="url(#n)" filter="url(#shadow)"/>
 <text x="775" y="268" fontSize="23" fontWeight="600" fill="#FFF">{model.funnel.executive.banner_inicio.slice(0,50)}</text>
 <text x="775" y="314" fontSize="38" fontWeight="800" fill={ORANGE}>{model.funnel.executive.banner_destaque.slice(0,36)}</text>
 <text x="775" y="349" fontSize="21" fill="#F1F4FE">{model.funnel.executive.banner_fim.slice(0,65)}</text>
 <text x="748" y="425" fontSize="27" fontWeight="800" fill={NAVY}>Destaques por Logado</text>
 {dots.map((id,i)=>{
 const x=747+i*198,y=450;
 return <g key={i}><rect x={x} y={y} width="187" height="185" rx="19" fill={i===1?ORANGE:"#FFF"} filter="url(#shadow)"/><text x={x+15} y={y+43} fontSize="16" fontWeight="700" fill={i===1?"#FFF":NAVY}>{id.slice(0,22)}</text><text x={x+93} y={y+103} textAnchor="middle" fontSize="26" fontWeight="800" fill={i===1?"#FFF":NAVY}>{kpi(model,id,last).slice(0,15)}</text><text x={x+93} y={y+147} textAnchor="middle" fontSize="14" fill={i===1?"#FFF":BLUE}>Período atual</text></g>;
 })}
 <rect x="745" y="663" width="385" height="187" rx="16" fill="#FFF" filter="url(#shadow)"/><text x="765" y="703" fontSize="25" fontWeight="800" fill={NAVY}>Observações</text>
 {String(model.funnel.executive.observacoes||"").split("\n").slice(0,4).map((line,i)=><text key={i} x="765" y={740+i*26} fontSize="17" fill="#545E73">{line.slice(0,41)}</text>)}
 <rect x="1144" y="663" width="395" height="187" rx="16" fill="#EEF3FF" filter="url(#shadow)"/><text x="1166" y="703" fontSize="25" fontWeight="800" fill={NAVY}>Síntese Executiva</text>
 {wrapSvg(model.funnel.executive.sintese_executiva,44,5).map((line,i)=><text key={i} x="1166" y={745+i*21} fontSize="17" fill={NAVY}>{line}</text>)}
 </SlideShell>;
}
function FinanceSlide({model}:{model:Model}) {
 const t=costs(model),rows=model.financial.rows;
 const diff=t.delta===null?"–":br(t.delta,1)+"%";
 const all=[...model.financial.cards.top,...model.financial.cards.bottom].slice(0,6);
 return <SlideShell heading={"SIMULAÇÃO FINANCEIRA | "+model.meta.cliente.toUpperCase()} subtitle={model.meta.subtitulo_financeiro}>
 <rect x="70" y="217" width="940" height="49" rx="13" fill="#FFF" filter="url(#shadow)"/><text x="89" y="249" fontSize="19" fill={NAVY}>{model.financial.executive.equalizacao.slice(0,92)}</text>
 <rect x="1040" y="217" width="470" height="49" rx="13" fill="#FFF" filter="url(#shadow)"/><text x="1063" y="248" fontSize="17" fill={NAVY}>{model.financial.executive.regra_logado.slice(0,49)}</text>
 <rect x="70" y="288" width="845" height="446" rx="19" fill="#FFF" filter="url(#shadow)"/>
 <rect x="86" y="305" width="813" height="58" rx="12" fill="url(#n)"/>
 <text x="104" y="344" fontSize="22" fill="#FFF" fontWeight="800">Item</text><text x="470" y="330" textAnchor="middle" fontSize="16" fill="#FFF">Estimado mês</text><text x="470" y="352" textAnchor="middle" fontSize="20" fill="#FFF" fontWeight="700">{model.financial.cenario_atual.slice(0,17)}</text>
 <text x="659" y="330" textAnchor="middle" fontSize="16" fill="#FFF">Projetado mês</text><text x="659" y="352" textAnchor="middle" fontSize="20" fill={ORANGE} fontWeight="800">{model.financial.cenario_projetado.slice(0,17)}</text><text x="809" y="342" textAnchor="middle" fontSize="19" fill="#FFF">Δ</text>
 {rows.slice(0,8).map((r,i)=>{
 const y=371+i*44;
 const costRow=r.indicador.toLowerCase()==="custo";
 const old=costRow?money(t.estimated):r.estimado;
 const now=costRow?money(t.projected):r.projetado;
 const a=val(r.estimado),b=val(r.projetado);
 const delta=costRow?money(t.saving):a!==null&&b!==null&&r.tipo==="Número"?br(b-a):"–";
 return <g key={r.indicador+i}><rect x="87" y={y} width="809" height="43" fill={costRow?"#E7EDFA":i%2?"#FFF":"#F7FAFE"}/><text x="109" y={y+28} fontSize="18" fontWeight={costRow?"800":"600"} fill={NAVY}>{r.indicador.slice(0,26)}</text><text x="475" y={y+28} fontSize="18" textAnchor="middle" fontWeight={costRow?"800":"400"} fill={NAVY}>{old.slice(0,23)}</text><text x="659" y={y+28} fontSize="18" textAnchor="middle" fontWeight="700" fill={ORANGE}>{now.slice(0,23)}</text><text x="808" y={y+28} fontSize="16" textAnchor="middle" fill={NAVY}>{delta.slice(0,16)}</text></g>;
 })}
 <rect x="935" y="288" width="603" height="99" rx="18" fill="url(#n)"/><text x="963" y="324" fontSize="18" fill="#FFF">{model.financial.executive.titulo_resultado.slice(0,60)}</text><text x="963" y="359" fontSize="24" fontWeight="800" fill="#FFF">Comparativo de custos</text>
 {all.map((id,i)=>{
 const x=i%2===0?935:1243,y=404+Math.floor(i/2)*111;
 const [label,v]=card(model,id);
 return <g key={i}><rect x={x} y={y} width="294" height="97" rx="15" fill={i===0?ORANGE:"#FFF"} filter="url(#shadow)"/><text x={x+17} y={y+32} fontSize="19" fontWeight="600" fill={i===0?"#FFF":NAVY}>{label.slice(0,27)}</text><text x={x+17} y={y+71} fontSize="32" fontWeight="800" fill={i===0?"#FFF":ORANGE}>{v.slice(0,21)}</text></g>;
 })}
 <rect x="69" y="751" width="460" height="113" rx="16" fill="#FFF" filter="url(#shadow)"/><text x="90" y="785" fontSize="22" fill={NAVY} fontWeight="700">Premissas</text><text x="90" y="813" fontSize="17" fill={NAVY}>Custo HC: {model.financial.custo_hc}</text><text x="90" y="838" fontSize="17" fill={NAVY}>Infra / ADM / PA: {model.financial.custo_infra}</text>
 <rect x="545" y="751" width="993" height="113" rx="16" fill="#EDF4FF" filter="url(#shadow)"/><text x="568" y="785" fontSize="22" fill={NAVY} fontWeight="800">Insight Executivo</text>
 {wrapSvg(model.financial.executive.insight,105,3).map((line,i)=><text key={i} x="568" y={816+i*20} fontSize="16" fill={NAVY}>{line}</text>)}
 </SlideShell>;
}
function TextField({label,value,onChange,multiline=false}:{label:string;value:string;onChange:(v:string)=>void;multiline?:boolean}){
 return <label className="ps-field"><span>{label}</span>{multiline?<textarea value={value} rows={3} onChange={e=>onChange(e.target.value)}/>:<input value={value} onChange={e=>onChange(e.target.value)}/>}</label>;
}
function BlobDownload(name:string,blob:Blob) { const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500); }
async function svgPng(svg:SVGSVGElement) {
 const cloned=svg.cloneNode(true) as SVGSVGElement;
 cloned.setAttribute("width","1600");cloned.setAttribute("height","900");cloned.setAttribute("xmlns","http://www.w3.org/2000/svg");
 const text=new XMLSerializer().serializeToString(cloned);
 const image=new window.Image(),src=URL.createObjectURL(new Blob([text],{type:"image/svg+xml;charset=utf-8"}));
 try {
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Não foi possível converter o SVG."));image.src=src;});
 const canvas=document.createElement("canvas");canvas.width=2048;canvas.height=1152;
 const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas indisponível.");
 ctx.drawImage(image,0,0,2048,1152);
 return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Erro ao gerar PNG.")),"image/png"));
 } finally {URL.revokeObjectURL(src);}
}
export function PresentationStudio() {
 const [model,setModel]=useState<Model>(demo),[active,setActive]=useState<"funil"|"financeiro"|"analise">("funil");
 const [paste,setPaste]=useState(""),[notice,setNotice]=useState(""),[zoom,setZoom]=useState(false);
 const [goal,setGoal]=useState("Analise os principais indicadores da POC, resultados e oportunidades."),[gptText,setGptText]=useState(""),[gptBusy,setGptBusy]=useState(false),[xlsxRows,setXlsxRows]=useState<(string|number)[][]>([]);
 const funil=useRef<SVGSVGElement>(null),financial=useRef<SVGSVGElement>(null),analysis=useRef<SVGSVGElement>(null);
 const imp=useRef<HTMLInputElement>(null);
 const latest=model.funnel.periods.at(-1)||"",first=model.funnel.periods[0];
 useEffect(()=>{try{const raw=localStorage.getItem("osp_presentation_studio_71");if(raw){const obj=JSON.parse(raw);if(obj?.funnel?.periods&&obj?.financial?.rows)setModel(obj);}}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem("osp_presentation_studio_71",JSON.stringify(model));}catch{}},[model]);
 function update(updater:(p:Model)=>void){setModel(prev=>{const next=structuredClone(prev);updater(next);return next;});}
 function setEx(field:keyof Model["funnel"]["executive"],value:string){update(p=>{(p.funnel.executive as unknown as Record<string,unknown>)[field]=value;});}
 function setFin(field:keyof Model["financial"]["executive"],value:string){update(p=>{p.financial.executive[field]=value;});}
 function changeVal(label:string,period:string,value:string){update(p=>{const row=p.funnel.rows.find(r=>r.indicador===label);if(row)row[period]=value;else p.funnel.rows.push({grupo:"ADICIONAIS",indicador:label,[period]:value});});}
 function applyPaste(kind:"funil"|"financeiro"){
 const rows=paste.trim().split(/\r?\n/).map(line=>line.split("\t").map(s=>s.trim())).filter(cols=>cols.length>=2);
 if(!rows.length){setNotice("Cole as células do Excel usando Ctrl+V.");return;}
 update(p=>{for(const cols of rows){
 const name=cols[0];if(!name||/^(indicador|período|periodo|item)$/i.test(name))continue;
 if(kind==="funil"){if(AUTO.includes(name) && p.funnel.produtividade_modo!=="manual")continue;const periods=p.funnel.periods;let r=p.funnel.rows.find(x=>x.indicador.toLowerCase()===name.toLowerCase());if(!r){r={grupo:"ADICIONAIS",indicador:name};p.funnel.rows.push(r);}periods.forEach((period,i)=>{if(cols[i+1]!==undefined)r![period]=cols[i+1];});}
 else{let r=p.financial.rows.find(x=>x.indicador.toLowerCase()===name.toLowerCase());if(!r){r={indicador:name,tipo:"Moeda",estimado:"",projetado:""};p.financial.rows.push(r);}r.estimado=cols[1]??r.estimado;r.projetado=cols[2]??r.projetado;}
 }});setPaste("");setNotice("Dados do Excel aplicados à tabela.");
 }
 function saveJson(){BlobDownload("poc_locator_71.json",new Blob([JSON.stringify(model,null,2)],{type:"application/json"}));}
 async function importJson(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;try{const o=JSON.parse(await f.text());if(!o?.meta||!Array.isArray(o?.funnel?.periods)||!Array.isArray(o?.financial?.rows))throw Error("JSON incompatível");setModel({...structuredClone(demo),...o,meta:{...demo.meta,...o.meta},funnel:{...demo.funnel,...o.funnel,executive:{...demo.funnel.executive,...o.funnel.executive}},financial:{...demo.financial,...o.financial,executive:{...demo.financial.executive,...o.financial.executive}}});setNotice("Projeto importado.");}catch(err){setNotice(String(err));}e.target.value="";}
 async function png(which:"funil"|"financeiro"|"analise"){const svg=which==="funil"?funil.current:which==="financeiro"?financial.current:analysis.current;if(!svg)throw Error("Abra a aba desejada para exportar.");return svgPng(svg);}
 async function exportPNG(which:"funil"|"financeiro"|"analise"){try{BlobDownload("olos_"+which+"_71.png",await png(which));setNotice("PNG exportado com sucesso.");}catch(err){setNotice(String(err));}}
 async function exportZip(){try{const JSZip=(await import("jszip")).default;const zip=new JSZip(); // A prévia dos dois slides fica montada abaixo em SVGs invisíveis.
 zip.file("Funil_Comparativo.png",await png("funil"));zip.file("Simulacao_Financeira.png",await png("financeiro"));if(gptText)zip.file("Analise_GPT.png",await png("analise"));zip.file("Projeto_7_1.json",JSON.stringify(model,null,2));BlobDownload("OLOS_POC_Locator_7_1.zip",await zip.generateAsync({type:"blob"}));}
 catch(err){setNotice("Falha ao exportar ZIP: "+String(err));}}
 async function parseExcel(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;try{if(file.size>12*1024*1024)throw Error("Limite de 12 MB.");const parse=(await import("read-excel-file/browser")).default;const rows=await parse(file);setXlsxRows(rows.slice(0,2000).map(r=>r.map(x=>x===null?"":String(x))));setNotice("Excel lido: "+rows.length+" linhas. Os dados permanecem no navegador.");}catch(err){setNotice("Erro no Excel: "+String(err));}}
 async function runGpt(){setGptBusy(true);try{
 const headers=xlsxRows[0]||[];const aggregates=headers.slice(0,14).map((h,i)=>{const numbers=xlsxRows.slice(1).map(r=>val(r[i])).filter((n):n is number=>n!==null);return{coluna:h,registros:numbers.length,soma:numbers.reduce((a,b)=>a+b,0),media:numbers.length?numbers.reduce((a,b)=>a+b,0)/numbers.length:0};});
 const response=await fetch("/api/presentations/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({goal,headers,rows:xlsxRows.length,aggregates,amostra:xlsxRows.slice(1,6)})});const result=await response.json();if(!response.ok)throw Error(result.error||"Falha de GPT.");setGptText(String(result.analysis||""));setNotice("Análise gerada. Revise o texto antes de exportar.");}
 catch(err){setNotice(String(err));}finally{setGptBusy(false);}}
 const selectKPIs=model.funnel.executive.kpi_rows;
 return <div className="ps-root">
 <header className="ps-hero"><div><span className="ps-overline">GESTÃO / APRESENTAÇÃO</span><h1><Presentation size={29}/> POC Locator <b>Studio 7.1</b></h1><p>Crie apresentações de performance e simulação financeira diretamente no OSP Logbook.</p></div><div className="ps-actions"><button onClick={saveJson}><Save size={17}/> Salvar JSON</button><button onClick={exportZip} className="ps-primary"><Download size={17}/> Exportar ZIP</button></div></header>
 <div className="ps-status"><Check size={15}/>{notice||"Os dados ficam salvos neste navegador. A edição é isolada das outras telas do Logbook."}</div>
 <nav className="ps-tabs" aria-label="Editores do Studio">{([["funil","Funil Comparativo",BarChart3],["financeiro","Simulação Financeira",Presentation],["analise","Análise GPT + Excel",Sparkles]] as const).map(([name,title,Icon])=><button key={name} className={active===name?"active":""} onClick={()=>{setActive(name);setZoom(false);}}><Icon size={18}/>{title}</button>)}</nav>
 <section className="ps-common"><TextField label="Cliente" value={model.meta.cliente} onChange={v=>update(p=>{p.meta.cliente=v;})}/><label className="ps-field"><span>Confirmar comparabilidade entre períodos</span><input type="checkbox" checked={model.meta.comparabilidade_confirmada} onChange={e=>update(p=>{p.meta.comparabilidade_confirmada=e.target.checked;})}/></label><button onClick={()=>imp.current?.click()}><FileUp size={16}/> Importar projeto JSON</button><input hidden ref={imp} type="file" accept=".json" onChange={importJson}/></section>
 <div className={"ps-workspace "+(zoom?"ps-zoom":"")}>
 <div className="ps-editor">
 {active==="funil"&&<>
 <h2>Funil comparativo</h2><TextField label="Subtítulo" value={model.meta.subtitulo_funil} onChange={v=>update(p=>{p.meta.subtitulo_funil=v;})}/>
 <div className="ps-periods">{model.funnel.periods.map((period,i)=><TextField key={i} label={"Período "+(i+1)} value={period} onChange={v=>{if(!v.trim()||model.funnel.periods.includes(v))return;update(p=>{const previous=p.funnel.periods[i];p.funnel.periods[i]=v;p.funnel.rows.forEach(row=>{row[v]=row[previous]||"";delete row[previous];});});}}/>)}</div>
 <h3>Dados do funil</h3><div className="ps-table-wrap"><table><thead><tr><th>Indicador</th>{model.funnel.periods.map(p=><th key={p}>{p}</th>)}</tr></thead><tbody>{INPUTS.concat(model.funnel.produtividade_modo==="manual"?["CPC por Logado","Sucesso / Logado"]:[]).map(label=><tr key={label}><td>{label}</td>{model.funnel.periods.map(p=><td key={p}><input aria-label={label+" "+p} value={raw(model,label,p)==="–"?"":raw(model,label,p)} onChange={e=>changeVal(label,p,e.target.value)}/></td>)}</tr>)}</tbody></table></div>
 <label className="ps-field"><span>Produtividade</span><select value={model.funnel.produtividade_modo||"automatico"} onChange={e=>update(p=>{p.funnel.produtividade_modo=e.target.value;})}><option value="automatico">Automático</option><option value="manual">Manual</option></select></label>
 <h3>Colar tabela do Excel</h3><textarea rows={4} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={"Indicador\t"+first+"\t"+latest+"\nMailing\t14340\t8499"}/><button onClick={()=>applyPaste("funil")}><FileSpreadsheet size={16}/> Aplicar dados do Excel</button>
 <h3>Quais KPIs aparecem na tabela esquerda? <span className="ps-count">{selectKPIs.length}/14</span></h3><div className="ps-kpis">{KPIS.map(k=><label key={k}><input type="checkbox" checked={selectKPIs.includes(k)} disabled={!selectKPIs.includes(k)&&selectKPIs.length>=14} onChange={e=>update(p=>{p.funnel.executive.kpi_rows=e.target.checked?[...p.funnel.executive.kpi_rows,k].slice(0,14):p.funnel.executive.kpi_rows.filter(x=>x!==k);})}/>{k}</label>)}</div>
 <h3>Cards de destaque (4 posições)</h3>{model.funnel.executive.destaques.slice(0,4).map((v,i)=><label className="ps-field" key={i}><span>Card {i+1}</span><select value={v} onChange={e=>update(p=>{p.funnel.executive.destaques[i]=e.target.value;})}>{KPIS.map(k=><option key={k}>{k}</option>)}</select></label>)}
 <h3>Textos e insights</h3>{(["banner_inicio","banner_destaque","banner_fim","observacoes","sintese_executiva"] as const).map(f=><TextField key={f} label={f.replaceAll("_"," ")} multiline={["observacoes","sintese_executiva"].includes(f)} value={model.funnel.executive[f]} onChange={v=>setEx(f,v)}/>)}
 </>}
 {active==="financeiro"&&<>
 <h2>Simulação financeira</h2><TextField label="Subtítulo" value={model.meta.subtitulo_financeiro} onChange={v=>update(p=>{p.meta.subtitulo_financeiro=v;})}/>
 <div className="ps-periods"><TextField label="Estimado" value={model.financial.cenario_atual} onChange={v=>update(p=>{p.financial.cenario_atual=v;})}/><TextField label="Projetado" value={model.financial.cenario_projetado} onChange={v=>update(p=>{p.financial.cenario_projetado=v;})}/></div>
 <label className="ps-field"><span>Calcular custo total automaticamente</span><input type="checkbox" checked={model.financial.auto_total} onChange={e=>update(p=>{p.financial.auto_total=e.target.checked;})}/></label>
 <div className="ps-table-wrap"><table><thead><tr><th>Item</th><th>Estimado</th><th>Projetado</th></tr></thead><tbody>{model.financial.rows.map((r,i)=><tr key={i}><td>{r.indicador}</td><td><input aria-label={r.indicador+" estimado"} value={r.estimado} onChange={e=>update(p=>{p.financial.rows[i].estimado=e.target.value;})}/></td><td><input aria-label={r.indicador+" projetado"} value={r.projetado} onChange={e=>update(p=>{p.financial.rows[i].projetado=e.target.value;})}/></td></tr>)}</tbody></table></div>
 <h3>Colar do Excel</h3><textarea rows={4} value={paste} onChange={e=>setPaste(e.target.value)} placeholder={"Item\tEstimado\tProjetado\nPA\t9\t3"}/><button onClick={()=>applyPaste("financeiro")}><FileSpreadsheet size={16}/> Aplicar dados do Excel</button>
 <div className="ps-total"><div>Custo estimado<strong>{money(costs(model).estimated)}</strong></div><div>Custo projetado<strong>{money(costs(model).projected)}</strong></div><div>Economia<strong>{money(costs(model).saving)}</strong></div></div>
 <h3>Personalizar os seis cards</h3>{([...model.financial.cards.top,...model.financial.cards.bottom]).map((v,i)=><label key={i} className="ps-field"><span>Card {i+1} {i<2?"(superior)":"(inferior)"}</span><select value={v} onChange={e=>update(p=>{if(i<2)p.financial.cards.top[i]=e.target.value;else p.financial.cards.bottom[i-2]=e.target.value;})}>{cardOptions.map(c=><option key={c} value={c}>{cardNames[c]}</option>)}</select></label>)}
 <h3>Premissas e textos</h3><TextField label="Custo HC" value={model.financial.custo_hc} onChange={v=>update(p=>{p.financial.custo_hc=v;})}/><TextField label="Infra / ADM / PA" value={model.financial.custo_infra} onChange={v=>update(p=>{p.financial.custo_infra=v;})}/>
 {(["equalizacao","regra_logado","titulo_resultado","sintese_executiva","insight","receita_adicional"] as const).map(f=><TextField key={f} label={f.replaceAll("_"," ")} multiline={["sintese_executiva","insight","equalizacao"].includes(f)} value={model.financial.executive[f]} onChange={v=>setFin(f,v)}/>)}
 </>}
 {active==="analise"&&<>
 <h2>Análise GPT + Excel</h2><p>Selecione um arquivo Excel, descreva o que deseja analisar e revise a resposta antes de exportar a terceira arte.</p>
 <label className="ps-field"><span>Arquivo Excel (.xlsx)</span><input type="file" accept=".xlsx,.xlsm" onChange={parseExcel}/></label>
 <p className="ps-note">{xlsxRows.length?xlsxRows.length-1+" linhas carregadas. Colunas: "+xlsxRows[0].join(" · "):"Os dados são processados no seu navegador. O GPT recebe somente agregados e pequena amostra ao solicitar a análise."}</p>
 <TextField label="O que você espera desta análise?" value={goal} multiline onChange={setGoal}/>
 <button className="ps-primary" disabled={!xlsxRows.length||gptBusy} onClick={runGpt}><Sparkles size={16}/>{gptBusy?"Analisando...":"Gerar análise GPT"}</button>
 <TextField label="Revisar análise e conclusões" value={gptText} multiline onChange={setGptText}/>
 <p className="ps-note">A chave OPENAI_API_KEY é configurada no ambiente do servidor. Nunca é exibida aqui.</p>
 </>}
 </div>
 <div className="ps-preview"><div className="ps-preview-head"><div><span className="ps-overline">PRÉVIA AO VIVO</span><h2>{active==="funil"?"Funil Comparativo":active==="financeiro"?"Simulação Financeira":"Análise Executiva"}</h2></div><div><button onClick={()=>setZoom(x=>!x)}><Maximize2 size={16}/>{zoom?"Recolher":"Ampliar"}</button><button className="ps-primary" onClick={()=>exportPNG(active==="funil"?"funil":active==="financeiro"?"financeiro":"analise")}><Download size={16}/> PNG</button></div></div>
 <div className="ps-preview-canvas">
 {active==="funil"?<svg ref={funil} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><FunnelSlide model={model}/></svg>:
 active==="financeiro"?<svg ref={financial} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><FinanceSlide model={model}/></svg>:
 <svg ref={analysis} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><SlideShell heading={"ANÁLISE EXECUTIVA | "+model.meta.cliente.toUpperCase()} subtitle="Indicadores e oportunidades"><rect x="70" y="240" width="1460" height="550" rx="25" fill="#FFF" filter="url(#shadow)"/><text x="100" y="293" fontSize="35" fill={NAVY} fontWeight="700">Síntese Executiva</text>{wrapSvg(gptText||"A análise aparecerá aqui após a leitura do Excel e a revisão dos resultados.",100,14).map((line,i)=><text key={i} x="99" y={357+i*28} fontSize="21" fill={NAVY}>{line}</text>)}</SlideShell></svg>}
 </div><p className="ps-preview-footer"><ImageIcon size={16}/> Exportação PNG 2048 × 1152 (16:9). Os indicadores calculados não são editáveis.</p>
 </div>
 </div>
 <div className="ps-hidden-slides" aria-hidden="true">{active!=="funil"&&<svg ref={funil} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><FunnelSlide model={model}/></svg>}{active!=="financeiro"&&<svg ref={financial} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><FinanceSlide model={model}/></svg>}{active!=="analise"&&<svg ref={analysis} viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><SlideShell heading={"ANÁLISE EXECUTIVA | "+model.meta.cliente.toUpperCase()} subtitle="Resumo GPT revisado"><rect x="70" y="250" width="1460" height="550" rx="24" fill="#FFF"/><text x="100" y="312" fontSize="30" fill={NAVY}>Síntese Executiva</text>{wrapSvg(gptText,100,14).map((line,i)=><text key={i} x="100" y={370+i*28} fontSize="21" fill={NAVY}>{line}</text>)}</SlideShell></svg>}</div>
 </div>;
}
