import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Number to Spanish words (simplified for salary amounts)
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

// Minimal PDF builder using raw PDF syntax
function buildPdf(lines: { text: string; x: number; y: number; size: number; bold?: boolean; maxWidth?: number }[], logoJpegBytes: Uint8Array | null): Uint8Array {
  const encoder = new TextEncoder();
  const objects: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  function write(s: string) {
    const b = encoder.encode(s);
    objects.push(b);
    pos += b.length;
    return b;
  }

  function obj(id: number, content: string) {
    offsets[id] = pos;
    write(`${id} 0 obj\n${content}\nendobj\n`);
  }

  // PDF header
  write("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

  // We need: catalog(1), pages(2), page(3), font-regular(4), font-bold(5), content-stream(6), [optional image obj]
  let nextObj = 7;
  const imageObjId = logoJpegBytes ? nextObj++ : 0;
  const imageXObjId = logoJpegBytes ? nextObj++ : 0;

  // Page dimensions: US Letter
  const pageW = 612;
  const pageH = 792;

  // Build content stream
  let content = "";
  
  for (const line of lines) {
    const fontRef = line.bold ? "/F2" : "/F1";
    if (line.maxWidth) {
      // Word wrap
      const words = line.text.split(" ");
      let currentLine = "";
      let currentY = line.y;
      const lineHeight = line.size * 1.4;
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        const estimatedWidth = testLine.length * line.size * (line.bold ? 0.6 : 0.52);
        if (estimatedWidth > line.maxWidth && currentLine) {
          content += `BT ${fontRef} ${line.size} Tf ${line.x} ${currentY} Td (${escapePdf(currentLine)}) Tj ET\n`;
          currentLine = word;
          currentY -= lineHeight;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        content += `BT ${fontRef} ${line.size} Tf ${line.x} ${currentY} Td (${escapePdf(currentLine)}) Tj ET\n`;
      }
    } else {
      content += `BT ${fontRef} ${line.size} Tf ${line.x} ${line.y} Td (${escapePdf(line.text)}) Tj ET\n`;
    }
  }

  // Draw logo at bottom-left of page 1 if available
  if (logoJpegBytes) {
    content += `q 100 0 0 50 50 40 cm /Img1 Do Q\n`;
  }

  // Draw signature lines
  content += `0.5 w\n`;
  content += `72 230 m 250 230 l S\n`; // Left signature line
  content += `350 230 m 530 230 l S\n`; // Right signature line

  const contentBytes = encoder.encode(content);

  // Objects
  obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  const resourcesDict = logoJpegBytes
    ? `/Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Img1 ${imageXObjId} 0 R >>`
    : `/Font << /F1 4 0 R /F2 5 0 R >>`;

  obj(2, `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`);
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Contents 6 0 R /Resources << ${resourcesDict} >> >>`);
  obj(4, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  obj(5, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  // Content stream
  offsets[6] = pos;
  write(`6 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  objects.push(contentBytes);
  pos += contentBytes.length;
  write(`\nendstream\nendobj\n`);

  // Image objects if logo present
  if (logoJpegBytes && imageObjId && imageXObjId) {
    offsets[imageObjId] = pos;
    write(`${imageObjId} 0 obj\n<< /Length ${logoJpegBytes.length} >>\nstream\n`);
    objects.push(logoJpegBytes);
    pos += logoJpegBytes.length;
    write(`\nendstream\nendobj\n`);

    obj(imageXObjId, `<< /Type /XObject /Subtype /Image /Width 359 /Height 109 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoJpegBytes.length} >>`);
    // Re-reference the stream - actually we need the image data IN the XObject
  }

  // Cross-reference table
  const xrefPos = pos;
  const numObjs = logoJpegBytes ? nextObj : 7;
  write(`xref\n0 ${numObjs}\n0000000000 65535 f \n`);
  for (let i = 1; i < numObjs; i++) {
    write(`${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${numObjs} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  // Combine all
  const total = objects.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of objects) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
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
    .replace(/–/g, "-")
    .replace(/\$/g, "\\$");
}

interface HiringData {
  employee_name: string;
  cedula: string;
  position: string;
  salary: number;
  start_date: string;
  benefits: string;
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
  motive: string; // "renuncia" | "despido" | "mutuo_acuerdo"
  motive_detail: string;
  company_name: string;
  company_rnc: string;
}

interface BankLetterData {
  employee_name: string;
  cedula: string;
  position: string;
  salary: number;
  start_date: string;
  company_name: string;
  company_rnc: string;
  bank_name: string;
  letter_date: string;
}

interface VacationData {
  employee_name: string;
  cedula: string;
  position: string;
  vacation_start: string;
  vacation_end: string;
  company_name: string;
  company_rnc: string;
  letter_date: string;
}

function generateHiringPdf(data: HiringData): Uint8Array {
  const salaryWords = numberToSpanish(data.salary);
  const biweekly = data.salary / 2;
  const biweeklyWords = numberToSpanish(biweekly);

  const lines: { text: string; x: number; y: number; size: number; bold?: boolean; maxWidth?: number }[] = [];
  let y = 720;
  const lm = 72; // left margin
  const mw = 468; // max width (612 - 72*2)

  // Title
  lines.push({ text: "CONTRATO DE TRABAJO", x: 220, y, size: 14, bold: true });
  y -= 40;

  // ENTRE paragraph
  const entreText = `ENTRE: ${data.company_name}, compañía comercial organizada de acuerdo a las leyes de la República Dominicana, con RNC No. ${data.company_rnc}, con RNL No. ${data.company_rnl}, con su domicilio social establecido en ${data.company_address}, debidamente representada en este acto por el señor ${data.representative_name}, ${data.representative_nationality}, mayor de edad, portador del ${data.representative_document} en su calidad de ${data.representative_title}; quien en lo que sigue del presente acto se denominará LA EMPRESA, y de la otra parte el señor ${data.employee_name}, dominicano, mayor de edad, portador de cédula # ${data.cedula} con su domicilio establecido en ${data.address || "República Dominicana"}, quien en lo que sigue del presente acto se denominará EL TRABAJADOR.`;
  lines.push({ text: entreText, x: lm, y, size: 11, maxWidth: mw });

  // Estimate lines used
  const entreLines = Math.ceil(entreText.length * 11 * 0.52 / mw);
  y -= entreLines * 15.4 + 20;

  // SE HA CONVENIDO
  lines.push({ text: "SE HA CONVENIDO Y PACTADO LO SIGUIENTE:", x: 160, y, size: 11, bold: true });
  y -= 30;

  // PRIMERO
  const primeroText = `PRIMERO: EL TRABAJADOR, laborará en calidad de ${data.position.toUpperCase()} en la empresa, a partir de la fecha de ${formatDateSpanish(data.start_date)}, con un salario de DOP ${formatCurrency(data.salary)} (${salaryWords} pesos) mensuales, totalizando RD$ ${formatCurrency(biweekly)} (${biweeklyWords} pesos) quincenales. Pagados por quincena.`;
  lines.push({ text: primeroText, x: lm, y, size: 11, maxWidth: mw });
  const primeroLines = Math.ceil(primeroText.length * 11 * 0.52 / mw);
  y -= primeroLines * 15.4 + 15;

  // SEGUNDO (benefits)
  if (data.benefits) {
    const segundoText = `SEGUNDO: ${data.benefits}`;
    lines.push({ text: segundoText, x: lm, y, size: 11, maxWidth: mw });
    const segundoLines = Math.ceil(segundoText.length * 11 * 0.52 / mw);
    y -= segundoLines * 15.4 + 15;
  }

  // TERCERO (trial period)
  if (data.trial_period_months > 0) {
    const terceroText = `${data.benefits ? "TERCERO" : "SEGUNDO"}: EL TRABAJADOR hará un periodo de prueba de ${data.trial_period_months} meses.`;
    lines.push({ text: terceroText, x: lm, y, size: 11, maxWidth: mw });
    y -= 30;
  }

  // Closing
  y -= 10;
  const closingText = `Hecho y firmado en tres (3) originales, uno para cada uno de las partes para los fines legales correspondientes. En ${data.company_address.split(",")[0]}, República Dominicana, ${formatDateLong(data.start_date)}.`;
  lines.push({ text: closingText, x: lm, y, size: 11, maxWidth: mw });
  const closingLines = Math.ceil(closingText.length * 11 * 0.52 / mw);
  y -= closingLines * 15.4 + 40;

  // Signature blocks
  const sigY = Math.max(y, 240);
  lines.push({ text: data.company_name, x: 80, y: sigY - 15, size: 10 });
  lines.push({ text: `RNC: ${data.company_rnc}`, x: 90, y: sigY - 28, size: 10 });
  lines.push({ text: data.employee_name, x: 370, y: sigY - 15, size: 10 });
  lines.push({ text: `Cédula: ${data.cedula}`, x: 370, y: sigY - 28, size: 10 });

  return buildPdf(lines, null);
}

function generateTerminationPdf(data: TerminationData): Uint8Array {
  const motiveMap: Record<string, string> = {
    renuncia: "renuncia voluntaria",
    despido: "despido",
    mutuo_acuerdo: "mutuo acuerdo",
  };
  const lines: { text: string; x: number; y: number; size: number; bold?: boolean; maxWidth?: number }[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  lines.push({ text: "CARTA DE TERMINACIÓN DE CONTRATO", x: 150, y, size: 14, bold: true });
  y -= 40;

  const dateText = formatDateSpanish(data.termination_date);
  lines.push({ text: `Fecha: ${dateText}`, x: lm, y, size: 11 });
  y -= 30;

  const bodyText = `Por medio de la presente, se hace constar que el señor/a ${data.employee_name}, portador/a de cédula No. ${data.cedula}, quien desempeñaba el cargo de ${data.position} en ${data.company_name} (RNC: ${data.company_rnc}), ha cesado sus labores a partir del ${dateText} por motivo de ${motiveMap[data.motive] || data.motive}.`;
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  if (data.motive_detail) {
    lines.push({ text: `Detalle: ${data.motive_detail}`, x: lm, y, size: 11, maxWidth: mw });
    const detailLines = Math.ceil(data.motive_detail.length * 11 * 0.52 / mw);
    y -= detailLines * 15.4 + 20;
  }

  lines.push({ text: "Se expide la presente para los fines correspondientes.", x: lm, y, size: 11 });
  y -= 40;

  lines.push({ text: "Atentamente,", x: lm, y, size: 11 });
  y -= 50;
  lines.push({ text: data.company_name, x: lm, y, size: 11, bold: true });
  y -= 15;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });

  return buildPdf(lines, null);
}

function generateBankLetterPdf(data: BankLetterData): Uint8Array {
  const lines: { text: string; x: number; y: number; size: number; bold?: boolean; maxWidth?: number }[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  lines.push({ text: "CARTA DE TRABAJO", x: 230, y, size: 14, bold: true });
  y -= 40;

  lines.push({ text: `Fecha: ${formatDateSpanish(data.letter_date)}`, x: lm, y, size: 11 });
  y -= 15;
  lines.push({ text: `A: ${data.bank_name}`, x: lm, y, size: 11 });
  y -= 30;

  const bodyText = `Por medio de la presente, hacemos constar que el señor/a ${data.employee_name}, portador/a de cédula No. ${data.cedula}, labora en nuestra empresa ${data.company_name} (RNC: ${data.company_rnc}) desde el ${formatDateSpanish(data.start_date)}, desempeñando el cargo de ${data.position}, con un salario mensual de RD$ ${formatCurrency(data.salary)} (${numberToSpanish(data.salary)} pesos).`;
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  lines.push({ text: "Se expide la presente a solicitud del interesado/a para los fines que estime conveniente.", x: lm, y, size: 11, maxWidth: mw });
  y -= 40;

  lines.push({ text: "Atentamente,", x: lm, y, size: 11 });
  y -= 50;
  lines.push({ text: data.company_name, x: lm, y, size: 11, bold: true });
  y -= 15;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });

  return buildPdf(lines, null);
}

function generateVacationPdf(data: VacationData): Uint8Array {
  const lines: { text: string; x: number; y: number; size: number; bold?: boolean; maxWidth?: number }[] = [];
  let y = 720;
  const lm = 72;
  const mw = 468;

  lines.push({ text: "AUTORIZACIÓN DE VACACIONES", x: 180, y, size: 14, bold: true });
  y -= 40;

  lines.push({ text: `Fecha: ${formatDateSpanish(data.letter_date)}`, x: lm, y, size: 11 });
  y -= 30;

  const bodyText = `Por medio de la presente, se autoriza al señor/a ${data.employee_name}, portador/a de cédula No. ${data.cedula}, quien desempeña el cargo de ${data.position} en ${data.company_name} (RNC: ${data.company_rnc}), a disfrutar de su período de vacaciones desde el ${formatDateSpanish(data.vacation_start)} hasta el ${formatDateSpanish(data.vacation_end)}.`;
  lines.push({ text: bodyText, x: lm, y, size: 11, maxWidth: mw });
  const bodyLines = Math.ceil(bodyText.length * 11 * 0.52 / mw);
  y -= bodyLines * 15.4 + 20;

  lines.push({ text: "Se expide la presente para los fines correspondientes.", x: lm, y, size: 11 });
  y -= 40;

  lines.push({ text: "Atentamente,", x: lm, y, size: 11 });
  y -= 50;
  lines.push({ text: data.company_name, x: lm, y, size: 11, bold: true });
  y -= 15;
  lines.push({ text: `RNC: ${data.company_rnc}`, x: lm, y, size: 10 });

  return buildPdf(lines, null);
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { letter_type, employee_id, ...letterData } = body;

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
        fileName = `${employee_id}/terminacion_${Date.now()}.pdf`;
        docName = `Carta de Terminación - ${letterData.employee_name}`;
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

    // Upload to storage
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error: uploadError } = await serviceClient.storage
      .from("employee-documents")
      .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: false });

    if (uploadError) {
      return new Response(JSON.stringify({ error: "Upload failed: " + uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      })
      .select("id")
      .single();

    if (dbError) {
      return new Response(JSON.stringify({ error: "DB insert failed: " + dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, document_id: docRecord.id, storage_path: fileName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
