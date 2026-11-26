import { totalTariffLines, monthNames, productName, type TariffLine, type TariffAmount, type TariffMetric } from "./financial-tariffs";

export function groupTariffClients(lines: TariffLine[]) {
  const groups = new Map<string, {key: string; name: string; lines: TariffLine[]}>();
  for (const line of lines) {
    const name = line.client.trim() || "Origem sem identificação";
    const key = name.toLocaleLowerCase("pt-BR");
    let group = groups.get(key);
    if (!group) { group = {key, name, lines: []}; groups.set(key, group); }
    group.lines.push(line);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(group => ({...group, periods: totalTariffLines(group.lines)}));
}

type Options = {
  clients: ReturnType<typeof groupTariffClients>; totals: Map<string, TariffAmount>;
  year: number; first: number; metric: TariffMetric; expanded: string | null; openClients: Set<string>;
};
const esc = (s: string) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n: number) => String(n).padStart(2, "0");
const xml = (s: string) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + s;
const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
function letter(n: number) {
  let s = "";
  while (n) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); }
  return s;
}
function numeric(a: TariffAmount | undefined, metric: TariffMetric) {
  if (!a) return null;
  if (metric === "calls") return Number(a.calls);
  if (metric === "unit") return a.calls > 0n ? Number(a.cost) / 100_000_000 / Number(a.calls) : null;
  return Number(a.cost) / 100_000_000;
}
function cell(col: number, row: number, value: string | number | null, style: number) {
  const attrs = ' r="' + letter(col) + row + '" s="' + style + '"';
  if (value === null) return '<c' + attrs + '/>';
  if (typeof value === "number") return '<c' + attrs + '><v>' + value + '</v></c>';
  return '<c' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + esc(value) + '</t></is></c>';
}

export async function createTariffWorkbook(options: Options) {
  const {default: JSZip} = await import("jszip");
  const zip = new JSZip();
  const {clients, totals, year, first, metric, expanded, openClients} = options;
  const periods: {key: string; title: string; day: boolean; hidden: boolean; collapsed: boolean}[] = [
    {key: "total", title: "Total do período", day: false, hidden: false, collapsed: false},
  ];
  for (let m = first; m <= 12; m++) {
    const key = year + "-" + pad(m);
    periods.push({key, title: monthNames[m - 1], day: false, hidden: false, collapsed: expanded !== key});
    for (let d = 1; d <= new Date(Date.UTC(year, m, 0)).getUTCDate(); d++) {
      periods.push({key: key + "-" + pad(d), title: pad(d) + "/" + pad(m), day: true, hidden: expanded !== key, collapsed: false});
    }
  }
  const header = metric === "cost" ? "Valor tarifado (R$)" : metric === "calls" ? "Chamadas tarifadas" : "Custo por chamada (R$)";
  const styleOffset = metric === "cost" ? 0 : metric === "calls" ? 1 : 2;
  const rows: string[] = [];
  rows.push('<row r="1">' + cell(1,1,"Cliente / Campanha | " + header,1) + periods.map((p,i)=>cell(i+2,1,p.title,1)).join("") + '</row>');
  function add(label: string, amounts: Map<string, TariffAmount>, summary: boolean, level = 0, hidden = false, collapsed = false) {
    const n = rows.length + 1;
    rows.push('<row r="' + n + '"' + (level ? ' outlineLevel="1"' : "") + (hidden ? ' hidden="1"' : "") + (collapsed ? ' collapsed="1"' : "") + '>' +
      cell(1,n,label,summary ? 2 : 0) + periods.map((p,i)=>cell(i+2,n,numeric(amounts.get(p.key),metric),(summary ? 6 : 3)+styleOffset)).join("") + '</row>');
  }
  add("Total da seleção",totals,true);
  for (const client of clients) {
    const open = openClients.has(client.key);
    add(client.name,client.periods,true,0,false,!open);
    for (const line of client.lines) add("    " + (line.campaign ? line.campaign.id + " | " + line.campaign.name + " | " + line.campaign.server : "Campanha sem identificação") + " | " + productName(line.agent),line.periods,false,1,!open);
  }
  const cols = '<col min="1" max="1" width="48" customWidth="1"/>' + periods.map((p,i) => '<col min="' + (i+2) + '" max="' + (i+2) + '" width="' + (p.day ? 15 : 19) + '" customWidth="1"' + (p.day ? ' outlineLevel="1"' : "") + (p.hidden ? ' hidden="1"' : "") + (p.collapsed ? ' collapsed="1"' : "") + '/>').join("");
  zip.file("[Content_Types].xml",xml('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'));
  zip.file("_rels/.rels",xml('<Relationships xmlns="'+pkg+'"><Relationship Id="rId1" Type="'+rel+'/officeDocument" Target="xl/workbook.xml"/></Relationships>'));
  zip.file("xl/workbook.xml",xml('<workbook xmlns="'+ns+'" xmlns:r="'+rel+'"><bookViews><workbookView/></bookViews><sheets><sheet name="Tarifação mensal" sheetId="1" r:id="rId1"/></sheets></workbook>'));
  zip.file("xl/_rels/workbook.xml.rels",xml('<Relationships xmlns="'+pkg+'"><Relationship Id="rId1" Type="'+rel+'/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="'+rel+'/styles" Target="styles.xml"/></Relationships>'));
  const xf = (font: number, fill: number, format: number) => '<xf numFmtId="'+format+'" fontId="'+font+'" fillId="'+fill+'" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>';
  zip.file("xl/styles.xml",xml('<styleSheet xmlns="'+ns+'"><numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="&quot;R$&quot; #,##0.0000"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF000049"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6EEF8"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'+xf(0,0,0)+xf(1,2,0)+xf(2,3,0)+[164,3,165].map(f=>xf(0,0,f)).join("")+[164,3,165].map(f=>xf(2,3,f)).join("")+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'));
  zip.file("xl/worksheets/sheet1.xml",xml('<worksheet xmlns="'+ns+'"><sheetPr><outlinePr summaryBelow="0" summaryRight="0" showOutlineSymbols="1"/></sheetPr><dimension ref="A1:'+letter(periods.length+1)+rows.length+'"/><sheetViews><sheetView workbookViewId="0" showOutlineSymbols="1"><pane xSplit="1" ySplit="2" topLeftCell="B3" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15" outlineLevelRow="1" outlineLevelCol="1"/><cols>'+cols+'</cols><sheetData>'+rows.join("")+'</sheetData></worksheet>'));
  return zip.generateAsync({type:"blob",compression:"DEFLATE",mimeType:"application/vnd.ms-excel.sheet.macroEnabled.12"});
}

export async function downloadTariffWorkbook(options: Options) {
  const blob = await createTariffWorkbook(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tarifacao-" + options.year + "-" + options.metric + ".xlsm";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
