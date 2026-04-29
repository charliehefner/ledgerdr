import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Number-to-Spanish helpers (unchanged) ───
const UNITS = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const TEENS = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
const TENS = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function convertGroup(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cien";
  let result = "";
  if (n >= 100) { result += HUNDREDS[Math.floor(n / 100)] + " "; n %= 100; }
  if (n >= 20) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    result += u === 0 ? TENS[t] : (t === 2 ? "veinti" + UNITS[u] : TENS[t] + " y " + UNITS[u]);
  } else if (n >= 10) {
    result += TEENS[n - 10];
  } else {
    result += UNITS[n];
  }
  return result.trim();
}

function numberToSpanish(amount: number): string {
  const int = Math.floor(amount);
  if (int === 0) return "cero";
  if (int === 1000) return "mil";
  const parts: string[] = [];
  const millions = Math.floor(int / 1000000);
  const thousands = Math.floor((int % 1000000) / 1000);
  const remainder = int % 1000;
  if (millions > 0) parts.push(millions === 1 ? "un millón" : convertGroup(millions) + " millones");
  if (thousands > 0) parts.push(thousands === 1 ? "mil" : convertGroup(thousands) + " mil");
  if (remainder > 0) parts.push(convertGroup(remainder));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function formatDateSpanish(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `el día ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} del año ${d.getFullYear()}`;
}
function formatDateDoc(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} del ${d.getFullYear()}`;
}
function formatDateDocLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `a los ${d.getDate()} días del mes de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function escapePdf(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/á/g, "\\341")
    .replace(/é/g, "\\351")
    .replace(/í/g, "\\355")
    .replace(/ó/g, "\\363")
    .replace(/ú/g, "\\372")
    .replace(/ñ/g, "\\361")
    .replace(/Á/g, "\\301")
    .replace(/É/g, "\\311")
    .replace(/Í/g, "\\315")
    .replace(/Ó/g, "\\323")
    .replace(/Ú/g, "\\332")
    .replace(/Ñ/g, "\\321")
    .replace(/ü/g, "\\374")
    .replace(/–/g, "-")
    .replace(/\$/g, "\\$");
}

// ─── Letterhead images (embedded as base64 at module init) ───
import { LETTERHEAD_TOP_B64, LETTERHEAD_BOTTOM_B64 } from "./letterhead-assets.ts";
const LETTERHEAD_TOP_BYTES = Uint8Array.from(atob(LETTERHEAD_TOP_B64), (c) => c.charCodeAt(0));
const LETTERHEAD_BOTTOM_BYTES = Uint8Array.from(atob(LETTERHEAD_BOTTOM_B64), (c) => c.charCodeAt(0));
const LETTERHEAD_TOP_W = 1920;
const LETTERHEAD_TOP_H = 275;
const LETTERHEAD_BOTTOM_W = 1920;
const LETTERHEAD_BOTTOM_H = 184;

// ─── Layout primitives ───
// We render onto US Letter (612 x 792). Body region is between the top and bottom letterhead images.
const PAGE_W = 612;
const PAGE_H = 792;
const LM = 72;             // left margin
const RM = 72;             // right margin
const MW = PAGE_W - LM - RM; // 468pt body width
const TOP_IMG_H = (PAGE_W * LETTERHEAD_TOP_H) / LETTERHEAD_TOP_W;       // ~88pt
const BOTTOM_IMG_H = (PAGE_W * LETTERHEAD_BOTTOM_H) / LETTERHEAD_BOTTOM_W; // ~59pt
const TOP_BODY_Y = PAGE_H - TOP_IMG_H - 24;   // first usable Y (text baseline)
const BOTTOM_LIMIT = BOTTOM_IMG_H + 18;        // do not draw text below this Y

// Spacing constants used by every letter generator
const GAP_PARA = 12;       // between paragraphs
const GAP_SECTION = 22;    // between sections (title → body, body → closing)
const GAP_SIG_TOP = 50;    // gap from last paragraph to first signature rule
const SIG_RULE_W = 200;    // width of every signature line

// Width helpers based on the same heuristic the wrapper uses
const CHAR_W_REG = 0.52;   // Helvetica regular, em fraction
const CHAR_W_BOLD = 0.6;   // Helvetica bold, em fraction
function estTextWidth(text: string, size: number, bold = false): number {
  return text.length * size * (bold ? CHAR_W_BOLD : CHAR_W_REG);
}

interface PdfText {
  kind: "text";
  text: string;
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  underline?: boolean;
  // Internal: word-spacing adjustment (pt) for justified lines
  tw?: number;
  // Items sharing a groupId page-break together (used for signature blocks)
  groupId?: string;
}

interface PdfRule {
  kind: "rule";
  x: number;
  y: number;
  width: number;
  thickness?: number;
  groupId?: string;
}

type PdfItem = PdfText | PdfRule;

// ─── Paragraph renderer ───
// Wraps `text` to MW, justifies every line except the last, returns the new Y cursor.
function pushParagraph(
  items: PdfItem[],
  text: string,
  startY: number,
  opts: { size?: number; bold?: boolean; align?: "left" | "justify" | "center"; x?: number; maxWidth?: number } = {},
): number {
  const size = opts.size ?? 11;
  const bold = opts.bold ?? false;
  const align = opts.align ?? "justify";
  const x = opts.x ?? LM;
  const maxWidth = opts.maxWidth ?? MW;
  const lineHeight = size * 1.4;

  const words = text.split(/\s+/).filter(Boolean);
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? current + " " + word : word;
    if (estTextWidth(test, size, bold) > maxWidth && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) wrapped.push(current);

  let y = startY;
  for (let i = 0; i < wrapped.length; i++) {
    const line = wrapped[i];
    const isLast = i === wrapped.length - 1;
    let lineX = x;
    let tw = 0;

    if (align === "center") {
      lineX = x + (maxWidth - estTextWidth(line, size, bold)) / 2;
    } else if (align === "justify" && !isLast) {
      const wordCount = line.split(" ").length;
      if (wordCount > 1) {
        const slack = maxWidth - estTextWidth(line, size, bold);
        if (slack > 0) {
          tw = Math.min(slack / (wordCount - 1), 6); // clamp at 6pt to avoid rivers
        }
      }
    }

    items.push({ kind: "text", text: line, x: lineX, y, size, bold, tw });
    y -= lineHeight;
  }

  // Convert "next baseline" back into "current cursor"; caller will subtract its own gap.
  return y + lineHeight - lineHeight; // = y; kept explicit for readability
}

// Single line of text (no wrapping). Returns new Y cursor (startY - lineHeight).
function pushLine(
  items: PdfItem[],
  text: string,
  startY: number,
  opts: { size?: number; bold?: boolean; align?: "left" | "right" | "center"; x?: number; underline?: boolean } = {},
): number {
  const size = opts.size ?? 11;
  const bold = opts.bold ?? false;
  const align = opts.align ?? "left";
  let x = opts.x ?? LM;

  if (align === "center") {
    x = LM + (MW - estTextWidth(text, size, bold)) / 2;
  } else if (align === "right") {
    x = PAGE_W - RM - estTextWidth(text, size, bold);
  }

  items.push({ kind: "text", text, x, y: startY, size, bold, underline: opts.underline });
  return startY - size * 1.4;
}

// Signature block: horizontal rule + bold name centered + optional subtitle line(s).
// Returns the bottom Y of the block.
function pushSignature(
  items: PdfItem[],
  centerX: number,
  topY: number,
  name: string,
  subtitles: string[] = [],
  groupId = "sig",
): number {
  const ruleX = centerX - SIG_RULE_W / 2;
  items.push({ kind: "rule", x: ruleX, y: topY, width: SIG_RULE_W, thickness: 0.6, groupId });

  let y = topY - 14;
  const nameW = estTextWidth(name, 10, true);
  items.push({ kind: "text", text: name, x: centerX - nameW / 2, y, size: 10, bold: true, groupId });
  y -= 13;

  for (const sub of subtitles) {
    const w = estTextWidth(sub, 9, false);
    items.push({ kind: "text", text: sub, x: centerX - w / 2, y, size: 9, groupId });
    y -= 12;
  }
  return y;
}

// ─── PDF builder ───
function buildPdf(items: PdfItem[]): Uint8Array {
  const encoder = new TextEncoder();

  // Pagination: any item whose y < BOTTOM_LIMIT moves to a new page.
  // Items sharing a `groupId` (e.g. signature blocks) page-break together: if any
  // member would overflow, the entire group is shifted onto a new page.
  interface Placed { item: PdfItem; page: number }
  const placed: Placed[] = [];
  let page = 0;
  let pageOffset = 0;
  let i = 0;
  while (i < items.length) {
    const it = items[i];
    if (it.groupId) {
      // Collect contiguous group
      const group: PdfItem[] = [];
      let j = i;
      while (j < items.length && items[j].groupId === it.groupId) {
        group.push(items[j]);
        j++;
      }
      const minY = Math.min(...group.map((g) => g.y + pageOffset));
      if (minY < BOTTOM_LIMIT) {
        page++;
        // Shift the whole group so its TOP sits at TOP_BODY_Y
        const groupTop = Math.max(...group.map((g) => g.y));
        pageOffset = TOP_BODY_Y - groupTop;
      }
      for (const g of group) {
        placed.push({ item: { ...g, y: g.y + pageOffset } as PdfItem, page });
      }
      i = j;
    } else {
      const adjY = it.y + pageOffset;
      if (adjY < BOTTOM_LIMIT) {
        page++;
        pageOffset = TOP_BODY_Y - it.y;
      }
      placed.push({ item: { ...it, y: it.y + pageOffset } as PdfItem, page });
      i++;
    }
  }

  const totalPages = page + 1;
  const topY = PAGE_H - TOP_IMG_H;
  const letterheadOps =
    `q ${PAGE_W} 0 0 ${TOP_IMG_H} 0 ${topY} cm /ImTop Do Q\n` +
    `q ${PAGE_W} 0 0 ${BOTTOM_IMG_H} 0 0 cm /ImBot Do Q\n`;

  const pageContents: string[] = [];
  for (let p = 0; p < totalPages; p++) {
    let content = letterheadOps;
    for (const { item, page: pp } of placed) {
      if (pp !== p) continue;
      if (item.kind === "text") {
        const fontRef = item.bold ? "/F2" : "/F1";
        const tw = item.tw && item.tw > 0 ? `${item.tw.toFixed(3)} Tw ` : "";
        const twReset = item.tw && item.tw > 0 ? ` 0 Tw` : "";
        content += `BT ${fontRef} ${item.size} Tf ${tw}${item.x} ${item.y} Td (${escapePdf(item.text)}) Tj${twReset} ET\n`;
        if (item.underline) {
          const w = estTextWidth(item.text, item.size, item.bold);
          content += `0.5 w ${item.x} ${item.y - 2} m ${item.x + w} ${item.y - 2} l S\n`;
        }
      } else if (item.kind === "rule") {
        const t = item.thickness ?? 0.6;
        content += `${t} w ${item.x} ${item.y} m ${item.x + item.width} ${item.y} l S\n`;
      }
    }
    pageContents.push(content);
  }

  // ── Assemble PDF objects ──
  const objects: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function write(s: string) { const b = encoder.encode(s); objects.push(b); pos += b.length; }
  function writeBytes(b: Uint8Array) { objects.push(b); pos += b.length; }
  function obj(id: number, content: string) { offsets[id] = pos; write(`${id} 0 obj\n${content}\nendobj\n`); }

  write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  const firstPageObjId = 7;
  const numObjs = firstPageObjId + totalPages * 2;

  obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  const pageRefs: string[] = [];
  for (let p = 0; p < totalPages; p++) pageRefs.push(`${firstPageObjId + p * 2} 0 R`);
  obj(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${totalPages} >>`);
  obj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  offsets[5] = pos;
  write(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${LETTERHEAD_TOP_W} /Height ${LETTERHEAD_TOP_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${LETTERHEAD_TOP_BYTES.length} >>\nstream\n`);
  writeBytes(LETTERHEAD_TOP_BYTES);
  write(`\nendstream\nendobj\n`);

  offsets[6] = pos;
  write(`6 0 obj\n<< /Type /XObject /Subtype /Image /Width ${LETTERHEAD_BOTTOM_W} /Height ${LETTERHEAD_BOTTOM_H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${LETTERHEAD_BOTTOM_BYTES.length} >>\nstream\n`);
  writeBytes(LETTERHEAD_BOTTOM_BYTES);
  write(`\nendstream\nendobj\n`);

  for (let p = 0; p < totalPages; p++) {
    const pageObjId = firstPageObjId + p * 2;
    const contentObjId = pageObjId + 1;
    const contentBytes = encoder.encode(pageContents[p]);
    obj(pageObjId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /ImTop 5 0 R /ImBot 6 0 R >> >> >>`);
    offsets[contentObjId] = pos;
    write(`${contentObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    objects.push(contentBytes);
    pos += contentBytes.length;
    write(`\nendstream\nendobj\n`);
  }

  const xrefPos = pos;
  write(`xref\n0 ${numObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < numObjs; i++) {
    write(`${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${numObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const total = objects.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const b of objects) { result.set(b, off); off += b.length; }
  return result;
}

// Once body+signature is laid out, optionally shift the signature group down
// so the page is vertically balanced between header and footer.
function balanceSignatures(items: PdfItem[], firstSigIndex: number, lastBodyY: number) {
  const sigItems = items.slice(firstSigIndex);
  if (sigItems.length === 0) return;
  const sigTopY = Math.max(...sigItems.map((it) => it.y));
  const sigBottomY = Math.min(...sigItems.map((it) => it.y));
  const available = sigTopY - BOTTOM_LIMIT;       // free space below sig top
  const aboveSig = lastBodyY - sigTopY;            // intentional gap to body
  // Center the sig group within the leftover region (between body bottom and BOTTOM_LIMIT)
  const region = lastBodyY - BOTTOM_LIMIT;
  const sigHeight = sigTopY - sigBottomY;
  const targetTop = BOTTOM_LIMIT + (region - sigHeight) / 2;
  // Only shift down (never up into body); cap so we don't reduce body→sig gap below 40pt
  const maxShift = aboveSig - 40;
  const desiredShift = sigTopY - targetTop;        // positive => shift down
  const shift = Math.max(0, Math.min(desiredShift, Math.max(0, maxShift)));
  if (shift <= 0) return;
  for (let i = firstSigIndex; i < items.length; i++) {
    items[i] = { ...items[i], y: items[i].y - shift } as PdfItem;
  }
}

// ─── Letter Interfaces ───
interface HiringClause { title: string; body: string; }

interface HiringData {
  employee_name: string;
  cedula: string;
  position: string;
  salary: number;
  start_date: string;
  clauses: HiringClause[];
  benefits?: string;
  address: string;
  company_name: string;
  company_rnc: string;
  company_rnl: string;
  company_address: string;
  representative_name: string;
  representative_nationality: string;
  representative_document: string;
  representative_title: string;
  trial_period_months: number;
}

interface TerminationData {
  employee_name: string;
  cedula: string;
  position: string;
  termination_date: string;
  desahucio_type: "immediate" | "preaviso";
  last_working_day: string;
  preaviso_days: number;
  company_name: string;
  company_rnc: string;
  manager_name: string;
  manager_title: string;
  motive?: string;
  motive_detail?: string;
}

interface BankLetterData {
  employee_name: string;
  cedula: string;
  position: string;
  salary: number;
  start_date: string;
  company_name: string;
  company_rnc: string;
  company_address?: string;
  bank_name: string;
  letter_date: string;
  signer_name?: string;
  signer_title?: string;
}

interface VacationData {
  employee_name: string;
  cedula: string;
  position: string;
  vacation_start: string;
  vacation_end: string;
  vacation_return_date?: string;
  vacation_days?: number;
  vacation_period?: string;
  company_name: string;
  company_rnc: string;
  letter_date: string;
  manager_name?: string;
  manager_title?: string;
}

// ─── Letter generators ───
const COL_LEFT_CENTER = LM + SIG_RULE_W / 2 + 10;        // ~182
const COL_RIGHT_CENTER = PAGE_W - RM - SIG_RULE_W / 2 - 10; // ~430
const COL_SINGLE_CENTER = PAGE_W / 2;                     // 306

function generateHiringPdf(data: HiringData): Uint8Array {
  const items: PdfItem[] = [];
  let y = TOP_BODY_Y;

  y = pushLine(items, "CONTRATO DE TRABAJO", y, { size: 14, bold: true, align: "center" });
  y -= GAP_SECTION;

  const salaryWords = numberToSpanish(data.salary);
  const biweekly = data.salary / 2;
  const biweeklyWords = numberToSpanish(biweekly);

  const entreText = `ENTRE: ${data.company_name}, compañía comercial organizada de acuerdo a las leyes de la República Dominicana, con RNC No. ${data.company_rnc}, con RNL No. ${data.company_rnl}, con su domicilio social establecido en ${data.company_address}, debidamente representada en este acto por el señor ${data.representative_name}, ${data.representative_nationality}, mayor de edad, portador del ${data.representative_document} en su calidad de ${data.representative_title}; quien en lo que sigue del presente acto se denominará LA EMPRESA, y de la otra parte el señor ${data.employee_name}, dominicano, mayor de edad, portador de cédula # ${data.cedula} con su domicilio establecido en ${data.address || "República Dominicana"}, quien en lo que sigue del presente acto se denominará EL TRABAJADOR.`;
  y = pushParagraph(items, entreText, y);
  y -= GAP_SECTION;

  y = pushLine(items, "SE HA CONVENIDO Y PACTADO LO SIGUIENTE:", y, { size: 11, bold: true, align: "center" });
  y -= GAP_PARA;

  const primeroText = `PRIMERO: EL TRABAJADOR laborará en calidad de ${data.position.toUpperCase()} en la empresa, a partir de la fecha de ${formatDateSpanish(data.start_date)}, con un salario de DOP ${formatCurrency(data.salary)} (${salaryWords} pesos) mensuales, totalizando RD$ ${formatCurrency(biweekly)} (${biweeklyWords} pesos) quincenales. Pagados por quincena.`;
  y = pushParagraph(items, primeroText, y);
  y -= GAP_PARA;

  const ordinals = ["SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO", "UNDÉCIMO", "DUODÉCIMO"];
  const allClauses: HiringClause[] = data.clauses && data.clauses.length > 0
    ? data.clauses
    : data.benefits ? [{ title: "Beneficios", body: data.benefits }] : [];

  for (let i = 0; i < allClauses.length; i++) {
    const label = ordinals[i] || `CLÁUSULA ${i + 2}`;
    const clauseText = `${label}: ${allClauses[i].body}`;
    y = pushParagraph(items, clauseText, y);
    y -= GAP_PARA;
  }

  if (data.trial_period_months > 0) {
    const trialLabel = ordinals[allClauses.length] || `CLÁUSULA ${allClauses.length + 2}`;
    const trialText = `${trialLabel}: EL TRABAJADOR hará un periodo de prueba de ${data.trial_period_months} meses.`;
    y = pushParagraph(items, trialText, y);
    y -= GAP_PARA;
  }

  const closingText = `Hecho y firmado en tres (3) originales, uno para cada una de las partes para los fines legales correspondientes. En ${data.company_address.split(",")[0]}, República Dominicana, ${formatDateLong(data.start_date)}.`;
  y = pushParagraph(items, closingText, y);

  const lastBodyY = y;
  const sigY = y - GAP_SIG_TOP;
  const sigStart = items.length;
  pushSignature(items, COL_LEFT_CENTER, sigY, data.company_name, [`RNC: ${data.company_rnc}`, "LA EMPRESA"]);
  pushSignature(items, COL_RIGHT_CENTER, sigY, data.employee_name, [`Cédula: ${data.cedula}`, "EL TRABAJADOR"]);
  balanceSignatures(items, sigStart, lastBodyY);

  return buildPdf(items);
}

function generateTerminationPdf(data: TerminationData): Uint8Array {
  const items: PdfItem[] = [];
  let y = TOP_BODY_Y;

  y = pushLine(items, `SPM, ${formatDateDocLong(data.termination_date)}.`, y, { align: "right" });
  y -= GAP_SECTION;

  y = pushLine(items, "Distinguido señor,", y);
  y -= GAP_SECTION;

  const isPreaviso = data.desahucio_type === "preaviso";
  const title = isPreaviso ? "AVISO DE DESPIDO POR DESAHUCIO (PRE-AVISO)" : "AVISO DE DESPIDO";
  y = pushLine(items, title, y, { size: 12, bold: true, align: "center" });
  y -= GAP_SECTION;

  const bodyText = isPreaviso
    ? `Por medio de la presente, la empresa ${data.company_name.toUpperCase()}, procede a notificar, a los fines de dar cumplimiento a las disposiciones contenidas en el artículo 76 del código del trabajo que, la empresa decidió dar término al contrato de trabajo suscrito con el señor ${data.employee_name}, cédula # ${data.cedula}, mediante el ejercicio del DESPIDO por desahucio por no más necesitar de sus labores. El señor deberá cumplir su preaviso trabajado por ${data.preaviso_days || 28} días, hasta el día ${data.last_working_day ? formatDateDoc(data.last_working_day) : "___"}, con derecho a dos medias jornadas por semana para buscar otro empleo.`
    : `Por medio de la presente, la empresa ${data.company_name.toUpperCase()}, procede a notificar, a los fines de dar cumplimiento a las disposiciones contenidas en el artículo 75 del código del trabajo, que, en fecha, por motivo de conveniencia, la empresa decidió dar término al contrato de trabajo suscrito con el señor ${data.employee_name}, cédula # ${data.cedula} mediante el ejercicio del DESPIDO por desahucio por no más necesitar de sus labores. El mismo trabajador estará laborando hasta el día ${data.last_working_day ? formatDateDoc(data.last_working_day) : "___"}.`;
  y = pushParagraph(items, bodyText, y);
  y -= GAP_PARA;

  const prestText = "La empresa declara aún que pagará todas sus prestaciones laborales conforme el Cálculo de Prestaciones Laborales y Derechos Adquiridos del Ministerio del Trabajo.";
  y = pushParagraph(items, prestText, y);

  const lastBodyY = y;
  const sigY = y - GAP_SIG_TOP;
  const sigStart = items.length;
  pushSignature(items, COL_LEFT_CENTER, sigY, data.employee_name, [`Cédula # ${data.cedula}`, "EL TRABAJADOR"]);
  pushSignature(items, COL_RIGHT_CENTER, sigY, data.manager_name || "________________", [
    data.manager_title || "Gerente Operacional",
    data.company_name.toUpperCase(),
  ]);
  balanceSignatures(items, sigStart, lastBodyY);

  return buildPdf(items);
}

function generateBankLetterPdf(data: BankLetterData): Uint8Array {
  const items: PdfItem[] = [];
  let y = TOP_BODY_Y;

  y = pushLine(items, `SPM, R.D. ${formatDateDoc(data.letter_date)}`, y, { align: "right" });
  y -= GAP_SECTION;

  y = pushLine(items, `A ${data.bank_name.toUpperCase()}:`, y, { bold: true });
  y -= GAP_SECTION;

  const salaryWords = numberToSpanish(data.salary);
  const bodyText = `Por medio de la presente les informamos que el señor ${data.employee_name}, portador de la Cédula de Identidad y Electoral No. ${data.cedula}, es empleado de nuestra empresa desde el día ${formatDateDoc(data.start_date)}, desempeñando el puesto de ${data.position}, devengando un salario mensual de ${salaryWords} pesos dominicanos (RD$ ${formatCurrency(data.salary)}), pagados mensualmente dividido por quincena.`;
  y = pushParagraph(items, bodyText, y);
  y -= GAP_PARA;

  const requestText = `Solicitamos la apertura de una cuenta bancaria del ${data.bank_name} para recibir su sueldo.`;
  y = pushParagraph(items, requestText, y);
  y -= GAP_SECTION;

  y = pushLine(items, "Sin otro particular,", y);
  y -= GAP_PARA;
  y = pushLine(items, "Atentamente,", y);

  const lastBodyY = y;
  const sigY = y - GAP_SIG_TOP;
  const sigStart = items.length;
  pushSignature(items, COL_SINGLE_CENTER, sigY, data.signer_name || "________________", [
    data.signer_title || "Gerente General",
    data.company_name,
  ]);
  balanceSignatures(items, sigStart, lastBodyY);

  return buildPdf(items);
}

function generateVacationPdf(data: VacationData): Uint8Array {
  const items: PdfItem[] = [];
  let y = TOP_BODY_Y;

  y = pushLine(items, `SPM, ${formatDateDoc(data.letter_date)}`, y, { align: "right" });
  y -= GAP_SECTION;

  y = pushLine(items, "Señor,", y);
  y -= GAP_PARA;
  y = pushLine(items, data.employee_name, y, { bold: true });
  y -= 4;
  y = pushLine(items, `Cédula ${data.cedula}`, y);
  y -= GAP_SECTION;

  y = pushLine(items, "Asunto: Autorización de vacaciones", y, { bold: true });
  y -= GAP_PARA;

  y = pushLine(items, "Apreciado colaborador:", y);
  y -= GAP_PARA;

  const days = data.vacation_days || 14;
  const daysWords = numberToSpanish(days);
  const period = data.vacation_period || "";
  const periodText = period ? ` correspondiente al período ${period}` : "";
  const returnText = data.vacation_return_date
    ? `, incorporándose a sus funciones el día ${formatDateDoc(data.vacation_return_date)}`
    : "";

  const bodyText = `Mediante la presente, queremos informarle y para que quede documentado, que la empresa ${data.company_name.toUpperCase()}, autoriza sus vacaciones en tiempo${periodText}, iniciando el día ${formatDateDoc(data.vacation_start)} hasta el día ${formatDateDoc(data.vacation_end)}, por ${daysWords} (${days}) días laborables${returnText}.`;
  y = pushParagraph(items, bodyText, y);
  y -= GAP_PARA;

  y = pushParagraph(items, "Agradeciendo su atención y esperando que aproveche su descanso, quedamos a la orden.", y);
  y -= GAP_PARA;

  y = pushLine(items, "Le saluda atentamente,", y);

  const lastBodyY = y;
  const sigY = y - GAP_SIG_TOP;
  const sigStart = items.length;
  pushSignature(items, COL_LEFT_CENTER, sigY, data.manager_name || "________________", [
    data.manager_title || "Gerente Operacional",
    "Por la empresa",
  ]);
  pushSignature(items, COL_RIGHT_CENTER, sigY, data.employee_name, [data.position, "El colaborador"]);
  balanceSignatures(items, sigStart, lastBodyY);

  return buildPdf(items);
}

// ─── Main Handler ───
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { letter_type, employee_id, entity_id, ...letterData } = body;
    console.log("Generating letter:", letter_type, "for employee:", employee_id, "entity:", entity_id);

    let pdfBytes: Uint8Array;
    let fileName: string;
    let docName: string;

    switch (letter_type) {
      case "contrato":
        pdfBytes = generateHiringPdf(letterData as HiringData);
        fileName = `${employee_id}/contrato_${Date.now()}.pdf`;
        docName = `Contrato de Trabajo - ${letterData.employee_name}`;
        break;
      case "terminacion":
        pdfBytes = generateTerminationPdf(letterData as TerminationData);
        fileName = `${employee_id}/desahucio_${Date.now()}.pdf`;
        docName = `Despido por Desahucio - ${letterData.employee_name}`;
        break;
      case "carta_banco":
        pdfBytes = generateBankLetterPdf(letterData as BankLetterData);
        fileName = `${employee_id}/carta_banco_${Date.now()}.pdf`;
        docName = `Carta al Banco - ${letterData.employee_name}`;
        break;
      case "vacaciones":
        pdfBytes = generateVacationPdf(letterData as VacationData);
        fileName = `${employee_id}/vacaciones_${Date.now()}.pdf`;
        docName = `Autorización Vacaciones - ${letterData.employee_name}`;
        break;
      default:
        return new Response(JSON.stringify({ error: "Invalid letter_type" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    console.log("PDF generated, uploading to storage:", fileName);

    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY not set");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: uploadError } = await serviceClient.storage
      .from("employee-documents")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: docRecord, error: dbError } = await serviceClient
      .from("employee_documents")
      .insert({
        employee_id,
        document_name: docName,
        document_type: "application/pdf",
        storage_path: fileName,
        letter_type,
        letter_metadata: letterData,
        entity_id: entity_id,
      })
      .select("id")
      .single();

    if (dbError) {
      console.error("DB insert error:", dbError.message, dbError.details, dbError.hint);
      return new Response(JSON.stringify({ error: "DB insert failed: " + dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, document_id: docRecord.id, storage_path: fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("Unhandled error in generate-hr-letter:", e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
