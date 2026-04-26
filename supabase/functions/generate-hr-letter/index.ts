import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Number to Spanish words
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

// Multi-page PDF builder
interface PdfLine {
  text: string;
  x: number;
  y: number;
  size: number;
  bold?: boolean;
  maxWidth?: number;
  underline?: boolean;
}

// ─── Letterhead images (loaded once at module init) ───
// Drawn full-width on every page. Top: 1920x275, Bottom: 1920x184.
const LETTERHEAD_TOP_BYTES = await Deno.readFile(new URL("./assets/top.jpg", import.meta.url));
const LETTERHEAD_BOTTOM_BYTES = await Deno.readFile(new URL("./assets/bottom.jpg", import.meta.url));
const LETTERHEAD_TOP_W = 1920;
const LETTERHEAD_TOP_H = 275;
const LETTERHEAD_BOTTOM_W = 1920;
const LETTERHEAD_BOTTOM_H = 184;

function buildPdf(lines: PdfLine[]): Uint8Array {
  const encoder = new TextEncoder();
  const pageW = 612;
  const pageH = 792;
  // Letterhead drawn full-width. Compute display heights.
  const topImgH = (pageW * LETTERHEAD_TOP_H) / LETTERHEAD_TOP_W;     // ~88pt
  const bottomImgH = (pageW * LETTERHEAD_BOTTOM_H) / LETTERHEAD_BOTTOM_W; // ~59pt
  const marginBottom = bottomImgH + 20; // keep text clear of bottom letterhead

  // First pass: expand word-wrapped lines to determine actual Y positions and page breaks
  interface RenderedLine {
    text: string;
    x: number;
    y: number;
    size: number;
    bold?: boolean;
    underline?: boolean;
    page: number;
  }

  const rendered: RenderedLine[] = [];
  let currentPage = 0;
  let yOffset = 0; // cumulative offset from word-wrap expansions

  for (const line of lines) {
    const adjustedY = line.y + yOffset;

    if (line.maxWidth) {
      const words = line.text.split(" ");
      let currentLine = "";
      let currentY = adjustedY;
      const lineHeight = line.size * 1.4;

      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const estimatedWidth = testLine.length * line.size * (line.bold ? 0.6 : 0.52);
        if (estimatedWidth > line.maxWidth && currentLine) {
          if (currentY < marginBottom) {
            currentPage++;
            currentY = pageH - 72;
          }
          rendered.push({ text: currentLine, x: line.x, y: currentY, size: line.size, bold: line.bold, underline: line.underline, page: currentPage });
          currentLine = word;
          currentY -= lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        if (currentY < marginBottom) {
          currentPage++;
          currentY = pageH - 72;
        }
        rendered.push({ text: currentLine, x: line.x, y: currentY, size: line.size, bold: line.bold, underline: line.underline, page: currentPage });
        // Calculate how much extra Y space was consumed
        const originalEndY = line.y - (line.maxWidth ? 0 : 0);
        yOffset = currentY - line.y;
      }
    } else {
      let finalY = adjustedY;
      if (finalY < marginBottom) {
        currentPage++;
        finalY = pageH - 72;
        yOffset = finalY - line.y;
      }
      rendered.push({ text: line.text, x: line.x, y: finalY, size: line.size, bold: line.bold, underline: line.underline, page: currentPage });
    }
  }

  const totalPages = currentPage + 1;

  // Build content streams per page
  const pageContents: string[] = [];
  for (let p = 0; p < totalPages; p++) {
    let content = "";
    const pageLines = rendered.filter((l) => l.page === p);
    for (const l of pageLines) {
      const fontRef = l.bold ? "/F2" : "/F1";
      content += `BT ${fontRef} ${l.size} Tf ${l.x} ${l.y} Td (${escapePdf(l.text)}) Tj ET\n`;
      if (l.underline) {
        const textWidth = l.text.length * l.size * (l.bold ? 0.6 : 0.52);
        content += `0.5 w ${l.x} ${l.y - 2} m ${l.x + textWidth} ${l.y - 2} l S\n`;
      }
    }
    pageContents.push(content);
  }

  // Build PDF objects
  const objects: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function write(s: string) {
    const b = encoder.encode(s);
    objects.push(b);
    pos += b.length;
  }

  function obj(id: number, content: string) {
    offsets[id] = pos;
    write(`${id} 0 obj\n${content}\nendobj\n`);
  }

  write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // Object layout: 1=catalog, 2=pages, 3=font-regular, 4=font-bold, then page+content pairs
  const firstPageObjId = 5;
  const numObjs = firstPageObjId + totalPages * 2;

  obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  const pageRefs = [];
  for (let p = 0; p < totalPages; p++) {
    pageRefs.push(`${firstPageObjId + p * 2} 0 R`);
  }
  obj(2, `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${totalPages} >>`);
  obj(3, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  for (let p = 0; p < totalPages; p++) {
    const pageObjId = firstPageObjId + p * 2;
    const contentObjId = pageObjId + 1;
    const contentBytes = encoder.encode(pageContents[p]);

    obj(pageObjId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents ${contentObjId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`);

    offsets[contentObjId] = pos;
    write(`${contentObjId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
    objects.push(contentBytes);
    pos += contentBytes.length;
    write(`\nendstream\nendobj\n`);
  }

  // Cross-reference
  const xrefPos = pos;
  write(`xref\n0 ${numObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < numObjs; i++) {
    write(`${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${numObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const total = objects.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of objects) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
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
  // Legacy fields
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

// ─── PDF Generators ───

function generateHiringPdf(data: HiringData): Uint8Array {
  const salaryWords = numberToSpanish(data.salary);
  const biweekly = data.salary / 2;
  const biweeklyWords = numberToSpanish(biweekly);

  const lines: PdfLine[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  lines.push({ text: "CONTRATO DE TRABAJO", x: 220, y, size: 14, bold: true });
  y -= 40;

  const entreText = `ENTRE: ${data.company_name}, compañía comercial organizada de acuerdo a las leyes de la República Dominicana, con RNC No. ${data.company_rnc}, con RNL No. ${data.company_rnl}, con su domicilio social establecido en ${data.company_address}, debidamente representada en este acto por el señor ${data.representative_name}, ${data.representative_nationality}, mayor de edad, portador del ${data.representative_document} en su calidad de ${data.representative_title}; quien en lo que sigue del presente acto se denominará LA EMPRESA, y de la otra parte el señor ${data.employee_name}, dominicano, mayor de edad, portador de cédula # ${data.cedula} con su domicilio establecido en ${data.address || "República Dominicana"}, quien en lo que sigue del presente acto se denominará EL TRABAJADOR.`;
  lines.push({ text: entreText, x: lm, y, size: 11, maxWidth: mw });
  const entreLines = Math.ceil(entreText.length * 11 * 0.52 / mw);
  y -= entreLines * 15.4 + 20;

  lines.push({ text: "SE HA CONVENIDO Y PACTADO LO SIGUIENTE:", x: 160, y, size: 11, bold: true });
  y -= 30;

  const primeroText = `PRIMERO: EL TRABAJADOR, laborará en calidad de ${data.position.toUpperCase()} en la empresa, a partir de la fecha de ${formatDateSpanish(data.start_date)}, con un salario de DOP ${formatCurrency(data.salary)} (${salaryWords} pesos) mensuales, totalizando RD$ ${formatCurrency(biweekly)} (${biweeklyWords} pesos) quincenales. Pagados por quincena.`;
  lines.push({ text: primeroText, x: lm, y, size: 11, maxWidth: mw });
  const primeroLines = Math.ceil(primeroText.length * 11 * 0.52 / mw);
  y -= primeroLines * 15.4 + 15;

  const ordinals = ["SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SÉPTIMO", "OCTAVO", "NOVENO", "DÉCIMO", "UNDÉCIMO", "DUODÉCIMO"];
  const allClauses: HiringClause[] = data.clauses && data.clauses.length > 0
    ? data.clauses
    : data.benefits ? [{ title: "Beneficios", body: data.benefits }] : [];

  for (let i = 0; i < allClauses.length; i++) {
    const label = ordinals[i] || `CLÁUSULA ${i + 2}`;
    const clauseText = `${label}: ${allClauses[i].body}`;
    lines.push({ text: clauseText, x: lm, y, size: 11, maxWidth: mw });
    const clauseLines = Math.ceil(clauseText.length * 11 * 0.52 / mw);
    y -= clauseLines * 15.4 + 15;
  }

  if (data.trial_period_months > 0) {
    const trialLabel = ordinals[allClauses.length] || `CLÁUSULA ${allClauses.length + 2}`;
    const trialText = `${trialLabel}: EL TRABAJADOR hará un periodo de prueba de ${data.trial_period_months} meses.`;
    lines.push({ text: trialText, x: lm, y, size: 11, maxWidth: mw });
    y -= 30;
  }

  y -= 10;
  const closingText = `Hecho y firmado en tres (3) originales, uno para cada uno de las partes para los fines legales correspondientes. En ${data.company_address.split(",")[0]}, República Dominicana, ${formatDateLong(data.start_date)}.`;
  lines.push({ text: closingText, x: lm, y, size: 11, maxWidth: mw });
  const closingLines = Math.ceil(closingText.length * 11 * 0.52 / mw);
  y -= closingLines * 15.4 + 40;

  const sigY = Math.max(y, 240);
  lines.push({ text: data.company_name, x: 80, y: sigY - 15, size: 10 });
  lines.push({ text: `RNC: ${data.company_rnc}`, x: 90, y: sigY - 28, size: 10 });
  lines.push({ text: data.employee_name, x: 370, y: sigY - 15, size: 10 });
  lines.push({ text: `Cédula: ${data.cedula}`, x: 370, y: sigY - 28, size: 10 });

  return buildPdf(lines);
}

function generateTerminationPdf(data: TerminationData): Uint8Array {
  const lines: PdfLine[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  // Company header
  lines.push({ text: data.company_name.toUpperCase(), x: lm, y, size: 12, bold: true });
  y -= 16;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });
  y -= 30;

  // Date line
  lines.push({ text: `SPM, ${formatDateDocLong(data.termination_date)}.`, x: lm, y, size: 11 });
  y -= 30;

  lines.push({ text: "Distinguido señor,", x: lm, y, size: 11 });
  y -= 30;

  // Title based on type
  const isPreaviso = data.desahucio_type === "preaviso";
  const title = isPreaviso
    ? "AVISO DE DESPIDO POR DESAHUCIO (PRE-AVISO)"
    : "AVISO DE DESPIDO";
  const titleX = isPreaviso ? 140 : 210;
  lines.push({ text: title, x: titleX, y, size: 12, bold: true });
  y -= 30;

  // Body text
  let bodyText: string;
  if (isPreaviso) {
    bodyText = `Por medio de la presente, la empresa ${data.company_name.toUpperCase()}, procede a notificar, a los fines de dar cumplimiento a las disposiciones contenidas en el artículo 76 del código del trabajo que, la empresa decidió dar término al contrato de trabajo suscrito con el señor ${data.employee_name}, cédula # ${data.cedula}, mediante el ejercicio del DESPIDO por desahucio por no más necesitar de sus labores. El señor deberá cumplir su preaviso trabajado por ${data.preaviso_days || 28} días, hasta el día ${data.last_working_day ? formatDateDoc(data.last_working_day) : "___"} con derecho a dos medias jornadas por semana para buscar otro empleo.`;
  } else {
    bodyText = `Por medio de la presente, la empresa ${data.company_name.toUpperCase()}, procede a notificar, a los fines de dar cumplimiento a las disposiciones contenidas en el artículo 75 del código del trabajo, que, en fecha, por motivo de conveniencia, la empresa decidió dar término al contrato de trabajo suscrito con el señor ${data.employee_name}, cédula # ${data.cedula} mediante el ejercicio del DESPIDO por desahucio por no más necesitar de sus labores. El mismo trabajador estará laborando hasta el día ${data.last_working_day ? formatDateDoc(data.last_working_day) : "___"}.`;
  }
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  // Prestaciones declaration
  const prestText = "La empresa declara aún que pagará todas sus prestaciones laborales conforme el Cálculo de Prestaciones Laborales y Derechos Adquiridos del Ministerio del Trabajo.";
  lines.push({ text: prestText, x: lm, y, size: 11, maxWidth: mw });
  const prestLines = Math.ceil(prestText.length * 11 * 0.52 / mw);
  y -= prestLines * 15.4 + 50;

  // Signature blocks
  const sigY = Math.max(y, 180);

  // Employee signature (left)
  lines.push({ text: "___________________________", x: lm, y: sigY, size: 10 });
  lines.push({ text: data.employee_name, x: lm, y: sigY - 15, size: 10 });
  lines.push({ text: `Ced # ${data.cedula}`, x: lm, y: sigY - 28, size: 10 });

  // Manager signature (right or below)
  lines.push({ text: "___________________________", x: lm, y: sigY - 60, size: 10 });
  lines.push({ text: data.manager_name || "___________________", x: lm, y: sigY - 75, size: 10 });
  lines.push({ text: `${data.manager_title || "Gerente operacional"} ${data.company_name.toUpperCase()}`, x: lm, y: sigY - 88, size: 10 });

  return buildPdf(lines);
}

function generateBankLetterPdf(data: BankLetterData): Uint8Array {
  const lines: PdfLine[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  // Company header
  lines.push({ text: data.company_name.toUpperCase(), x: lm, y, size: 12, bold: true });
  y -= 16;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });
  y -= 30;

  // Date and addressee
  lines.push({ text: `SPM, R.D. ${formatDateDoc(data.letter_date)}`, x: lm, y, size: 11 });
  y -= 25;
  lines.push({ text: `A ${data.bank_name.toUpperCase()}:`, x: lm, y, size: 11, bold: true });
  y -= 25;

  // Body - matching uploaded format
  const salaryWords = numberToSpanish(data.salary);
  const biweekly = data.salary / 2;
  const bodyText = `Por medio de la presente les informamos que el señor ${data.employee_name}, portador de la Cedula de identidad y electoral No. ${data.cedula}, es empleado de nuestra empresa desde el día ${formatDateDoc(data.start_date)}, desempeñando el puesto de ${data.position}, devengando un salario mensual de ${salaryWords} pesos dominicanos (RD$ ${formatCurrency(data.salary)}) pagados mensualmente dividido por quincena.`;
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  // Account opening request
  const requestText = `Solicitamos la apertura de una cuenta bancaria del ${data.bank_name} para recibir su sueldo.`;
  lines.push({ text: requestText, x: lm, y, size: 11, maxWidth: mw });
  y -= 30;

  lines.push({ text: "Sin otro particular,", x: lm, y, size: 11 });
  y -= 20;
  lines.push({ text: "Atentamente,", x: lm, y, size: 11 });
  y -= 50;

  // Signature
  lines.push({ text: "_______________________________", x: lm, y, size: 10 });
  y -= 15;
  lines.push({ text: data.signer_name || "___________________", x: lm, y, size: 10 });
  y -= 15;
  lines.push({ text: data.signer_title || "Gerente General", x: lm, y, size: 10 });

  // Footer
  if (data.company_address) {
    y -= 40;
    lines.push({ text: data.company_address, x: lm, y, size: 8 });
  }

  return buildPdf(lines);
}

function generateVacationPdf(data: VacationData): Uint8Array {
  const lines: PdfLine[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  // Company header
  lines.push({ text: data.company_name.toUpperCase(), x: lm, y, size: 12, bold: true });
  y -= 16;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });
  y -= 30;

  // Date (right-aligned style, but we place at right)
  const dateFormatted = formatDateDoc(data.letter_date);
  lines.push({ text: dateFormatted, x: 380, y, size: 11 });
  y -= 30;

  // Salutation
  lines.push({ text: "Señor,", x: lm, y, size: 11 });
  y -= 20;

  // Employee name and cedula (bold)
  lines.push({ text: data.employee_name, x: lm, y, size: 11, bold: true });
  y -= 16;
  lines.push({ text: `Cédula ${data.cedula}`, x: lm, y, size: 11 });
  y -= 25;

  // Subject line
  lines.push({ text: "Asunto: Autorización de vacaciones", x: lm, y, size: 11, bold: true });
  y -= 25;

  lines.push({ text: "Apreciado colaborador:", x: lm, y, size: 11 });
  y -= 25;

  // Body text matching uploaded format
  const days = data.vacation_days || 14;
  const daysWords = numberToSpanish(days);
  const period = data.vacation_period || "";
  const periodText = period ? ` correspondiente al período ${period}` : "";
  const returnText = data.vacation_return_date ? `, incorporándose a sus funciones el día ${formatDateDoc(data.vacation_return_date)}` : "";

  const bodyText = `Mediante la presente, queremos informarle y para que quede documentado, que la empresa ${data.company_name.toUpperCase()}, autoriza sus vacaciones en tiempo${periodText}, iniciando el día ${formatDateDoc(data.vacation_start)} hasta el día ${formatDateDoc(data.vacation_end)}, por ${daysWords} (${days}) días laborables${returnText}.`;
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  lines.push({ text: "Agradeciendo su atención y esperando que aproveche su descanso, quedamos a la orden.", x: lm, y, size: 11, maxWidth: mw });
  y -= 30;

  lines.push({ text: "Le saluda atentamente,", x: lm, y, size: 11 });
  y -= 60;

  // Two signature blocks side by side
  // Manager (left)
  lines.push({ text: "_______________________________", x: lm, y, size: 10 });
  lines.push({ text: "_______________________________", x: 340, y, size: 10 });
  y -= 15;
  lines.push({ text: data.manager_name || "___________________", x: lm, y, size: 10 });
  lines.push({ text: data.employee_name, x: 340, y, size: 10 });
  y -= 15;
  lines.push({ text: data.manager_title || "Gerente operacional", x: lm, y, size: 10 });
  lines.push({ text: data.position, x: 340, y, size: 10 });

  return buildPdf(lines);
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

    // Upload to storage
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

    console.log("Upload successful, inserting document record");

    // Insert record
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

    console.log("Document record created:", docRecord.id);

    return new Response(
      JSON.stringify({ success: true, document_id: docRecord.id, storage_path: fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unhandled error in generate-hr-letter:", e.message, e.stack);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
