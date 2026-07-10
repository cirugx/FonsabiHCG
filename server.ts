import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Helper to create OAuth2 Client
function createOAuth2Client(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}

// Extract file ID from google drive URL
function extractDriveId(url: string): string | null {
  if (!url) return null;
  const regExp = /\/file\/d\/([^\/?#]+)/;
  const match = url.match(regExp);
  if (match) return match[1];
  
  const regExpId = /[?&]id=([^&]+)/;
  const matchId = url.match(regExpId);
  if (matchId) return matchId[1];

  // If it's just a clean alphanumeric key (google drive ID has 33-44 chars usually)
  if (url.length >= 25 && !url.includes("/") && !url.includes(".")) {
    return url;
  }
  return null;
}

// Download PDF safely
async function downloadPDF(url: string, accessToken?: string): Promise<Buffer> {
  if (!url) {
    throw new Error("No URL provided");
  }

  // Handle Google Drive files
  const driveId = extractDriveId(url);
  if (driveId && accessToken) {
    try {
      const drive = google.drive({ version: "v3", auth: createOAuth2Client(accessToken) });
      const driveResponse = await drive.files.get({
        fileId: driveId,
        alt: "media"
      }, { responseType: "arraybuffer" });
      
      return Buffer.from(driveResponse.data as ArrayBuffer);
    } catch (err: any) {
      console.error("Google Drive download failed, attempting direct fetch:", err.message);
    }
  }

  // Standard fetch for web URLs
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error descargando el PDF desde ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Helper to sanitize spreadsheet values to strings
function cellStr(val: any): string {
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

// Helper to dynamically fetch the title of the first sheet in a spreadsheet
async function getFirstSheetName(sheets: any, spreadsheetId: string): Promise<string> {
  try {
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const firstSheetTitle = spreadsheet.data.sheets?.[0]?.properties?.title;
    return firstSheetTitle || "Sheet1";
  } catch (err: any) {
    console.error("Error fetching first sheet title, fallback to Sheet1:", err.message);
    return "Sheet1";
  }
}

// Helper to normalise dates to ISO (YYYY-MM-DD)
function parseSheetDateToISO(dateStr: string): string {
  if (!dateStr) return "";
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  const matchYMD = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (matchYMD) {
    const year = matchYMD[1];
    const month = matchYMD[2].padStart(2, '0');
    const day = matchYMD[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return trimmed;
}

// Helper to clean numerical values (replace comma decimals and remove spaces)
function cleanNum(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/\s/g, "");
  let sanitized = str;
  if (str.includes(",") && str.includes(".")) {
    sanitized = str.replace(/,/g, "");
  } else if (str.includes(",")) {
    sanitized = str.replace(/,/g, ".");
  }
  const num = parseFloat(sanitized);
  return isNaN(num) ? 0 : num;
}

// Endpoints

// 1. Obtener y filtrar filas de Google Sheets
app.get("/api/entries", async (req, res) => {
  const authHeader = req.headers.authorization;
  const spreadsheetId = req.query.spreadsheetId as string;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Token de Google requerido." });
  }
  if (!spreadsheetId) {
    return res.status(400).json({ error: "Falta el ID de la hoja de cálculo (spreadsheetId)." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const oauth2Client = createOAuth2Client(token);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const sheetName = await getFirstSheetName(sheets, spreadsheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ1000`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.json({ entries: [], headers: [] });
    }

    const headers = rows[0].map(h => cellStr(h).trim());

    // Encontrar las posiciones de las columnas dinámicamente por su nombre exacto o variaciones
    const idxNo = headers.indexOf("No.");
    const idxCodigo = headers.indexOf("Código FONSABI");
    const idxDesc = headers.indexOf("Descripción");
    const idxEstatus = headers.indexOf("Estatus");
    const idxPdf = headers.indexOf("PDF");
    const idxLote = headers.indexOf("Lote");
    const idxFechaCad = headers.indexOf("Fecha de Caducidad");
    const idxCantidad = headers.indexOf("Cantidad ") !== -1 ? headers.indexOf("Cantidad ") : headers.indexOf("Cantidad Unitaria");
    const idxCosto = headers.indexOf("Costo por Unidad");
    const idxProveedor = headers.indexOf("Proveedor");
    const idxRemision = headers.indexOf("Remisión");
    const idxFechaAuth = headers.indexOf("Fecha Autorización");
    const idxUserAuth = headers.indexOf("Usuario Autorización");
    const idxNotaRechazo = headers.indexOf("Nota de Rechazo");

    const entries = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || idxNo === -1 || !cellStr(row[idxNo])) continue; // Skip empty rows or rows without No.

      entries.push({
        no: cellStr(row[idxNo]),
        codigoFonsabi: idxCodigo !== -1 ? cellStr(row[idxCodigo]) : "",
        descripcion: idxDesc !== -1 ? cellStr(row[idxDesc]) : "",
        estatus: (idxEstatus !== -1 ? cellStr(row[idxEstatus]) : "Sin autorizar") || "Sin autorizar",
        pdf: idxPdf !== -1 ? cellStr(row[idxPdf]) : "",
        lote: idxLote !== -1 ? cellStr(row[idxLote]) : "",
        fechaCaducidad: idxFechaCad !== -1 ? cellStr(row[idxFechaCad]) : "",
        cantidad: idxCantidad !== -1 ? cellStr(row[idxCantidad]) : "",
        costoUnidad: idxCosto !== -1 ? cellStr(row[idxCosto]) : "",
        proveedor: idxProveedor !== -1 ? cellStr(row[idxProveedor]) : "",
        remision: idxRemision !== -1 ? cellStr(row[idxRemision]) : "",
        fechaAutorizacion: idxFechaAuth !== -1 ? cellStr(row[idxFechaAuth]) : "",
        usuarioAutorizacion: idxUserAuth !== -1 ? cellStr(row[idxUserAuth]) : "",
        notaRechazo: idxNotaRechazo !== -1 ? cellStr(row[idxNotaRechazo]) : "",
      });
    }

    return res.json({ entries, headers });
  } catch (error: any) {
    console.error("Error al leer Google Sheets:", error);
    return res.status(500).json({ error: `Error de Google Sheets API: ${error.message}` });
  }
});

// 2. Crear / Inicializar una nueva Hoja de cálculo plantilla
app.post("/api/initialize-sheet", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Token requerido." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const oauth2Client = createOAuth2Client(token);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });

    // Create spreadsheet
    const createRes = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "FONSABI - Control de Entradas Médicas",
        },
      },
    });

    const spreadsheetId = createRes.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error("No se pudo obtener el ID de la hoja de cálculo creada.");
    }

    const initialRows = [
      [
        "No.",
        "Código FONSABI",
        "Descripción",
        "Estatus",
        "PDF",
        "Lote",
        "Fecha de Caducidad",
        "Cantidad",
        "Costo por Unidad",
        "Proveedor",
        "Remisión",
        "Fecha Autorización",
        "Usuario Autorización",
        "Nota de Rechazo"
      ],
      [
        "1",
        "FONS-3029",
        "Paracetamol 500mg - Caja c/20 tabletas",
        "Sin autorizar",
        "https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf",
        "LOT-9988X",
        "2028-12-31",
        "500",
        "2.50",
        "Distribuidora Médica del Norte",
        "REM-2026-001",
        "",
        "",
        ""
      ],
      [
        "2",
        "FONS-4581",
        "Jeringas Desechables 5ml - Caja c/100",
        "Sin autorizar",
        "https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf",
        "LOT-1122Y",
        "2027-06-30",
        "100",
        "12.00",
        "Medica Global SA",
        "REM-2026-002",
        "",
        "",
        ""
      ],
      [
        "3",
        "FONS-1024",
        "Gasas Estériles 10x10cm - Paquete c/100",
        "Autorizado",
        "https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf",
        "LOT-3344Z",
        "2029-01-15",
        "200",
        "8.15",
        "Abastos de Hospitales",
        "REM-2026-003",
        "2026-07-09",
        "supervisor@hospital.gob.mx",
        ""
      ]
    ];

    const sheetName = await getFirstSheetName(sheets, spreadsheetId);

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:N4`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: initialRows
      }
    });

    return res.json({ spreadsheetId, title: "FONSABI - Control de Entradas Médicas" });
  } catch (error: any) {
    console.error("Error al inicializar hoja de cálculo:", error);
    return res.status(500).json({ error: `No se pudo crear la hoja: ${error.message}` });
  }
});

// Helper structure for Amarre cruzado
interface AmarreResult {
  id: string;
  label: string;
  description: string;
  isMatch: boolean;
  details: string;
}

// Programmatic multi-document cross-checks (Amarre Cruzado)
function calculateAmarres(
  doc1?: any,
  doc2?: any,
  doc3?: any,
  doc4?: any,
  doc5?: any
): AmarreResult[] {
  const amarres: AmarreResult[] = [];
  const cleanText = (s?: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().trim();

  // 1. Amarre de Remisión (Nota de Entrada vs Remisión Comercial)
  if (doc1 && doc2) {
    const isMatch = cleanText(doc1.numeroRemisionCapturado) === cleanText(doc2.folioRemision) && doc1.numeroRemisionCapturado !== "";
    amarres.push({
      id: "remision",
      label: "Amarre de Remisión",
      description: "Verifica que el folio de remisión capturado en la Nota de Entrada (RB) coincida con el folio de la Remisión Comercial.",
      isMatch,
      details: isMatch 
        ? `Coincidencia exacta: El folio "${doc1.numeroRemisionCapturado}" en Nota de Entrada coincide con el folio "${doc2.folioRemision}" en la Remisión Comercial.`
        : `Discrepancia: El folio en Nota de Entrada es "${doc1.numeroRemisionCapturado}" pero en Remisión Comercial es "${doc2.folioRemision}".`
    });
  }

  // 2. Amarre de Lote (Trazabilidad en 4 documentos: 1, 2, 3, 4)
  if (doc1 && doc2 && doc3 && doc4) {
    const l1 = cleanText(doc1.numeroLote);
    const l2 = cleanText(doc2.lote);
    const l3 = cleanText(doc3.loteAsignado);
    const l4 = cleanText(doc4.numeroLoteAnalizado);
    const isMatch = l1 === l2 && l2 === l3 && l3 === l4 && l1 !== "";
    
    let details = "";
    if (isMatch) {
      details = `Coincidencia total de lote ("${doc1.numeroLote}") verificado en: Nota de Entrada, Remisión Comercial, Orden IMSS-BIENESTAR y Certificado de Análisis (CoA).`;
    } else {
      details = `Inconsistencia de lote detectada:\n` +
        `- Nota de Entrada: "${doc1.numeroLote || 'N/A'}"\n` +
        `- Remisión Comercial: "${doc2.lote || 'N/A'}"\n` +
        `- Orden IMSS: "${doc3.loteAsignado || 'N/A'}"\n` +
        `- Certificado CoA: "${doc4.numeroLoteAnalizado || 'N/A'}"`;
    }

    amarres.push({
      id: "lote",
      label: "Amarre de Lote",
      description: "Valida la trazabilidad del lote de fabricación en los 4 documentos críticos.",
      isMatch,
      details
    });
  }

  // 3. Amarre de Caducidad (Sincronía de vida útil en 4 documentos: 1, 2, 3, 4)
  if (doc1 && doc2 && doc3 && doc4) {
    const c1 = parseSheetDateToISO(doc1.fechaCaducidad);
    const c2 = parseSheetDateToISO(doc2.fechaCaducidad);
    const c3 = parseSheetDateToISO(doc3.fechaCaducidad);
    const c4 = parseSheetDateToISO(doc4.fechaCaducidad);
    const isMatch = c1 === c2 && c2 === c3 && c3 === c4 && c1 !== "";
    
    let details = "";
    if (isMatch) {
      details = `Coincidencia de fecha de caducidad ("${c1}") en los 4 documentos (Nota de Entrada, Remisión Comercial, Orden IMSS-BIENESTAR y Certificado CoA).`;
    } else {
      details = `Inconsistencia de fecha de caducidad:\n` +
        `- Nota de Entrada: "${doc1.fechaCaducidad || 'N/A'}" (${c1})\n` +
        `- Remisión Comercial: "${doc2.fechaCaducidad || 'N/A'}" (${c2})\n` +
        `- Orden IMSS: "${doc3.fechaCaducidad || 'N/A'}" (${c3})\n` +
        `- Certificado CoA: "${doc4.fechaCaducidad || 'N/A'}" (${c4})`;
    }

    amarres.push({
      id: "caducidad",
      label: "Amarre de Caducidad",
      description: "Asegura la consistencia de la vida útil del medicamento comparando las caducidades impresas.",
      isMatch,
      details
    });
  }

  // 4. Amarre de Registro Sanitario (COFEPRIS vs Remisión Comercial)
  if (doc2 && doc5) {
    const regNum = (doc5.numeroRegistroSanitario || "").trim();
    const remisionText = doc2.registroSanitarioTexto || "";
    const cleanReg = cleanText(regNum);
    const cleanRemText = cleanText(remisionText);
    const isMatch = cleanReg !== "" && (cleanRemText.includes(cleanReg) || cleanReg.includes(cleanRemText) || remisionText.includes(regNum) || regNum.includes(remisionText));
    
    amarres.push({
      id: "registro",
      label: "Amarre de Registro Sanitario",
      description: "Verifica que el número de Registro Sanitario COFEPRIS esté debidamente impreso y referenciado en la Remisión Comercial del proveedor.",
      isMatch,
      details: isMatch
        ? `Aprobado: El Registro Sanitario "${regNum}" está referenciado de forma válida en la Remisión Comercial.`
        : `Discrepancia: El Registro Sanitario COFEPRIS oficial es "${regNum}", pero en la Remisión se lee: "${remisionText || 'Ninguna referencia'}"`
    });
  }

  // 5. Amarre de Forma Farmacéutica (COFEPRIS vs CoA vs Nota de Entrada)
  if (doc1 && doc4 && doc5) {
    const f5 = (doc5.formaFarmaceuticaAutorizada || "").toLowerCase().trim();
    const f4 = (doc4.formaFarmaceutica || "").toLowerCase().trim();
    const desc = (doc1.descripcionArticulo || "").toLowerCase().trim();
    
    const isMatch = f5 !== "" && (desc.includes(f5) || f4.includes(f5) || f5.includes(f4));
    amarres.push({
      id: "forma",
      label: "Amarre de Forma Farmacéutica",
      description: "Coteja que la forma farmacéutica autorizada por COFEPRIS coincida con la analizada en el CoA y con la descripción de entrada.",
      isMatch,
      details: isMatch
        ? `Coincidencia de forma farmacéutica: "${doc5.formaFarmaceuticaAutorizada}" (COFEPRIS) es consistente con el CoA ("${doc4.formaFarmaceutica}") y la descripción.`
        : `Inconsistencia: COFEPRIS autoriza "${doc5.formaFarmaceuticaAutorizada || 'N/A'}", CoA reporta "${doc4.formaFarmaceutica || 'N/A'}" y la descripción de entrada de almacén es "${doc1.descripcionArticulo || 'N/A'}"`
    });
  }

  // 6. Amarre Cronológico (CoA <= IMSS && CoA <= Remisión)
  if (doc2 && doc3 && doc4) {
    const fFabricacion = parseSheetDateToISO(doc4.fechaFabricacionElaboracion);
    const fExpedicion = parseSheetDateToISO(doc3.fechaExpedicion);
    const fEmision = parseSheetDateToISO(doc2.fechaEmision);
    
    const dFabricacion = new Date(fFabricacion);
    const dExpedicion = new Date(fExpedicion);
    const dEmision = new Date(fEmision);
    
    const isValid = !isNaN(dFabricacion.getTime()) && !isNaN(dExpedicion.getTime()) && !isNaN(dEmision.getTime());
    const isMatch = isValid ? (dFabricacion <= dExpedicion && dFabricacion <= dEmision) : false;
    
    let details = "";
    if (isValid) {
      if (isMatch) {
        details = `Validación cronológica de manufactura exitosa: La fecha de fabricación en CoA (${fFabricacion}) es previa a la orden IMSS-BIENESTAR (${fExpedicion}) y a la remisión del proveedor (${fEmision}).`;
      } else {
        details = `Incoherencia cronológica: La fecha de fabricación en el Certificado CoA (${fFabricacion}) es posterior a la orden de expedición (${fExpedicion}) o a la remisión (${fEmision}). Lógica de tiempo inválida.`;
      }
    } else {
      details = `No se pudo evaluar cronológicamente debido a formatos de fecha inválidos (CoA: "${doc4.fechaFabricacionElaboracion}", Orden: "${doc3.fechaExpedicion}", Remisión: "${doc2.fechaEmision}").`;
    }

    amarres.push({
      id: "cronologia",
      label: "Amarre Cronológico",
      description: "Valida la lógica de tiempos: un medicamento no puede ser despachado o distribuido antes de su fecha de fabricación.",
      isMatch,
      details
    });
  }

  return amarres;
}

// Simulated High-Fidelity Report Generator for Mock/Fallback Testing
function generateSimulatedReport(entryNo: string, targetEntry: any) {
  const isEntry1 = String(entryNo) === "1";
  const isEntry2 = String(entryNo) === "2";

  const segmentation = [
    { documentType: "Nota de Entrada (RB)", startPage: 1, endPage: 1, confidence: "Alta" },
    { documentType: "Remisión Comercial", startPage: 2, endPage: 2, confidence: "Alta" },
    { documentType: "Orden IMSS-BIENESTAR", startPage: 3, endPage: 3, confidence: "Alta" },
    { documentType: "Certificado de Análisis (CoA)", startPage: 4, endPage: 4, confidence: "Alta" },
    { documentType: "Registro Sanitario COFEPRIS", startPage: 5, endPage: 5, confidence: "Alta" }
  ];

  // Document 1: Nota de Entrada de Almacén (RB)
  const doc1 = {
    numeroNota: isEntry1 ? "NE-10294" : (isEntry2 ? "NE-10295" : "NE-10296"),
    fechaRecepcion: "2026-07-09",
    codigoFonsabi: targetEntry.codigoFonsabi || "FONS-3029",
    descripcionArticulo: targetEntry.descripcion || "Insumo Médico",
    cantidadRecibida: cleanNum(targetEntry.cantidad) || 500,
    numeroLote: targetEntry.lote || "LOT-9988X",
    fechaCaducidad: targetEntry.fechaCaducidad || "2028-12-31",
    nombreProveedor: targetEntry.proveedor || "Distribuidora Médica del Norte",
    numeroRemisionCapturado: targetEntry.remision || "REM-2026-001"
  };

  // Document 2: Remisión Comercial
  // Introduce a lote discrepancy in entry 1
  const doc2 = {
    folioRemision: targetEntry.remision || "REM-2026-001",
    fechaEmision: "2026-07-08",
    nombreProveedor: targetEntry.proveedor || "Distribuidora Médica del Norte",
    rfcProveedor: isEntry1 ? "DMN-880915-K45" : "MGS-951120-J12",
    direccionProveedor: isEntry1 ? "Av. Constitución 400, Monterrey, NL" : "Calzada de Tlalpan 1200, CDMX",
    lote: isEntry1 ? "LOT-9988M" : (targetEntry.lote || "LOT-1122Y"), // Mismatch for Entry 1
    fechaCaducidad: targetEntry.fechaCaducidad || "2028-12-31",
    cantidad: isEntry2 ? 80 : (cleanNum(targetEntry.cantidad) || 500), // Mismatch for Entry 2
    costoUnidad: cleanNum(targetEntry.costoUnidad) || 2.50,
    registroSanitarioTexto: isEntry1 
      ? "Medicamento autorizado por COFEPRIS con registro sanitario 412M2018 SSA" 
      : "Insumo médico con registro regulatorio SSA 085C2021"
  };

  // Document 3: Orden IMSS-BIENESTAR
  const doc3 = {
    folioOrden: isEntry1 ? "ORD-IMSS-2026-88" : "ORD-IMSS-2026-102",
    fechaExpedicion: "2026-07-05",
    claveArticulo: targetEntry.codigoFonsabi || "FONS-3029",
    descripcionArticulo: targetEntry.descripcion || "Insumo Médico",
    cantidadSolicitada: cleanNum(targetEntry.cantidad) || 500,
    cantidadAutorizada: cleanNum(targetEntry.cantidad) || 500,
    loteAsignado: targetEntry.lote || "LOT-9988X",
    fechaCaducidad: targetEntry.fechaCaducidad || "2028-12-31"
  };

  // Document 4: Certificado de Análisis (CoA)
  const doc4 = {
    numeroCertificado: isEntry1 ? "COA-PAR-2026-553" : "COA-JER-2026-12",
    nombreFabricante: isEntry1 ? "Laboratorios Monterrey S.A." : "Plásticos Médicos del Bajío",
    nombreProducto: targetEntry.descripcion?.split("-")[0].trim() || "Insumo Médico",
    numeroLoteAnalizado: targetEntry.lote || "LOT-9988X",
    fechaFabricacionElaboracion: "2026-01-15",
    fechaCaducidad: targetEntry.fechaCaducidad || "2028-12-31",
    formaFarmaceutica: isEntry1 ? "Tabletas" : "Jeringa estéril",
    resultadoAnalisis: "Cumple especificaciones"
  };

  // Document 5: Registro Sanitario COFEPRIS
  const doc5 = {
    numeroRegistroSanitario: isEntry1 ? "412M2018 SSA" : "085C2021",
    titularRegistro: isEntry1 ? "Laboratorios Monterrey S.A." : "Importaciones Médicas S.A.",
    nombreMedicamento: targetEntry.descripcion?.split("-")[0].trim() || "Insumo Médico",
    formaFarmaceuticaAutorizada: isEntry1 ? "Tabletas" : "Jeringa estéril",
    fechaVigencia: "2029-05-15",
    estatusVigencia: "Vigente"
  };

  const amarres = calculateAmarres(doc1, doc2, doc3, doc4, doc5);

  const cleanText = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const provMatch = String(targetEntry.proveedor).toLowerCase().includes(doc2.nombreProveedor.toLowerCase()) || doc2.nombreProveedor.toLowerCase().includes(String(targetEntry.proveedor).toLowerCase());
  const remisionMatch = cleanText(targetEntry.remision) === cleanText(doc2.folioRemision);

  const comparisons = {
    lote: {
      sheetValue: targetEntry.lote,
      pdfValue: doc2.lote,
      isMatch: targetEntry.lote.toLowerCase() === doc2.lote.toLowerCase(),
      field: "lote",
      label: "Número de Lote"
    },
    fechaCaducidad: {
      sheetValue: targetEntry.fechaCaducidad,
      pdfValue: doc2.fechaCaducidad,
      isMatch: targetEntry.fechaCaducidad === doc2.fechaCaducidad,
      field: "fechaCaducidad",
      label: "Fecha de Caducidad"
    },
    cantidad: {
      sheetValue: targetEntry.cantidad,
      pdfValue: String(doc2.cantidad),
      isMatch: Number(targetEntry.cantidad) === Number(doc2.cantidad),
      field: "cantidad",
      label: "Cantidad (Unidades)"
    },
    costoUnidad: {
      sheetValue: targetEntry.costoUnidad,
      pdfValue: String(doc2.costoUnidad),
      isMatch: Math.abs(Number(targetEntry.costoUnidad) - Number(doc2.costoUnidad)) < 0.01,
      field: "costoUnidad",
      label: "Costo Unitario"
    },
    proveedor: {
      sheetValue: targetEntry.proveedor,
      pdfValue: doc2.nombreProveedor,
      isMatch: provMatch,
      field: "proveedor",
      label: "Proveedor"
    },
    remision: {
      sheetValue: targetEntry.remision,
      pdfValue: doc2.folioRemision,
      isMatch: remisionMatch,
      field: "remision",
      label: "Folio de Remisión / Factura"
    }
  };

  const matchedCount = Object.values(comparisons).filter((c: any) => c.isMatch).length;
  const passedAmarres = amarres.filter(a => a.isMatch).length;
  const matchPercentage = Math.round(((matchedCount + passedAmarres) / (6 + amarres.length)) * 100);

  let observaciones = "ANÁLISIS COMPLETO DEL EXPEDIENTE (MODO SIMULADO): ";
  if (matchPercentage === 100) {
    observaciones += "Todas las piezas documentales del expediente (RB, Remisión Comercial, Orden IMSS-BIENESTAR, Certificado CoA y Registro COFEPRIS) cruzaron de forma exitosa y coinciden con la información del sistema.";
  } else {
    observaciones += `Se identificaron discrepancias críticas en el expediente. `;
    const failedAmarres = amarres.filter(a => !a.isMatch);
    if (failedAmarres.length > 0) {
      observaciones += `Alertas de Amarre Cruzado: ${failedAmarres.map(a => a.label).join(", ")}. `;
    }
    if (!comparisons.lote.isMatch) {
      observaciones += `El lote en remisión física (${comparisons.lote.pdfValue}) no coincide con el del sistema (${comparisons.lote.sheetValue}). `;
    }
    if (!comparisons.cantidad.isMatch) {
      observaciones += `La cantidad física en la remisión (${comparisons.cantidad.pdfValue}) difiere del sistema (${comparisons.cantidad.sheetValue}). `;
    }
  }

  return {
    entryId: String(entryNo),
    matchPercentage,
    comparisons,
    observaciones,
    extractedRaw: doc2,
    isMock: true,
    segmentation,
    doc1,
    doc2,
    doc3,
    doc4,
    doc5,
    amarres
  };
}

// 3. Verificar PDF con Gemini (Procesamiento de Expediente Multi-Documento)
app.post("/api/verify-pdf", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { entryNo, pdfUrl, spreadsheetId, forceSimulate } = req.body;

  if (!entryNo) {
    return res.status(400).json({ error: "Falta el número de entrada (entryNo)." });
  }

  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

  // Let's get the record from spreadsheet to have something to compare with
  let targetEntry: any = null;

  if (spreadsheetId && token) {
    try {
      const oauth2Client = createOAuth2Client(token);
      const sheets = google.sheets({ version: "v4", auth: oauth2Client });
      const sheetName = await getFirstSheetName(sheets, spreadsheetId);
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A1:ZZ1000`,
      });
      const rows = response.data.values;
      if (rows && rows.length > 0) {
        const headers = rows[0].map(h => cellStr(h).trim());
        const idxNo = headers.indexOf("No.");
        const idxCodigo = headers.indexOf("Código FONSABI");
        const idxDesc = headers.indexOf("Descripción");
        const idxEstatus = headers.indexOf("Estatus");
        const idxPdf = headers.indexOf("PDF");
        const idxLote = headers.indexOf("Lote");
        const idxFechaCad = headers.indexOf("Fecha de Caducidad");
        const idxCantidad = headers.indexOf("Cantidad ") !== -1 ? headers.indexOf("Cantidad ") : headers.indexOf("Cantidad Unitaria");
        const idxCosto = headers.indexOf("Costo por Unidad");
        const idxProveedor = headers.indexOf("Proveedor");
        const idxRemision = headers.indexOf("Remisión");
        const idxNotaRechazo = headers.indexOf("Nota de Rechazo");

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row && idxNo !== -1 && cellStr(row[idxNo]) === String(entryNo)) {
            targetEntry = {
              no: cellStr(row[idxNo]),
              codigoFonsabi: idxCodigo !== -1 ? cellStr(row[idxCodigo]) : "",
              descripcion: idxDesc !== -1 ? cellStr(row[idxDesc]) : "",
              estatus: (idxEstatus !== -1 ? cellStr(row[idxEstatus]) : "Sin autorizar") || "Sin autorizar",
              pdf: idxPdf !== -1 ? cellStr(row[idxPdf]) : "",
              lote: idxLote !== -1 ? cellStr(row[idxLote]) : "",
              fechaCaducidad: idxFechaCad !== -1 ? cellStr(row[idxFechaCad]) : "",
              cantidad: idxCantidad !== -1 ? cellStr(row[idxCantidad]) : "",
              costoUnidad: idxCosto !== -1 ? cellStr(row[idxCosto]) : "",
              proveedor: idxProveedor !== -1 ? cellStr(row[idxProveedor]) : "",
              remision: idxRemision !== -1 ? cellStr(row[idxRemision]) : "",
              notaRechazo: idxNotaRechazo !== -1 ? cellStr(row[idxNotaRechazo]) : "",
            };
            break;
          }
        }
      }
    } catch (err) {
      console.error("No se pudo obtener el registro para comparación:", err);
    }
  }

  // Fallback in case Sheets was not accessible or sheet is empty
  if (!targetEntry) {
    targetEntry = {
      no: String(entryNo),
      codigoFonsabi: entryNo === "2" ? "FONS-4581" : "FONS-3029",
      descripcion: entryNo === "2" ? "Jeringas Desechables 5ml - Caja c/100" : "Paracetamol 500mg - Caja c/20 tabletas",
      estatus: "Sin autorizar",
      pdf: pdfUrl || "https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf",
      lote: entryNo === "2" ? "LOT-1122Y" : "LOT-9988X",
      fechaCaducidad: entryNo === "2" ? "2027-06-30" : "2028-12-31",
      cantidad: entryNo === "2" ? "100" : "500",
      costoUnidad: entryNo === "2" ? "12.00" : "2.50",
      proveedor: entryNo === "2" ? "Medica Global SA" : "Distribuidora Médica del Norte",
      remision: entryNo === "2" ? "REM-2026-002" : "REM-2026-001"
    };
  }

  // Check if we should simulate (forceSimulate, missing API key, or standard dummy/sample PDF files)
  const geminiKey = process.env.GEMINI_API_KEY;
  const isMock = forceSimulate || !geminiKey || pdfUrl?.includes("dummy") || pdfUrl?.includes("sample.pdf");

  if (isMock) {
    console.log("Generando reporte de verificación simulado multi-documento para entrada No.", entryNo);
    const mockReport = generateSimulatedReport(String(entryNo), targetEntry);
    return res.json({ report: mockReport });
  }

  // REAL GEMINI MULTI-PHASE PIPELINE!
  try {
    console.log(`Iniciando análisis real multi-fase para entrada No. ${entryNo} con PDF: ${pdfUrl}`);
    const pdfBuffer = await downloadPDF(pdfUrl, token);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64")
      }
    };

    // ==========================================
    // FASE 1: Separador y Clasificador de Páginas
    // ==========================================
    console.log("Ejecutando Fase 1: Segmentación y clasificación de páginas...");
    const segmentationPrompt = `Analiza este expediente digital en PDF que contiene varios documentos médicos y administrativos escaneados. Tu tarea es identificar con precisión los rangos de páginas (rango de páginas inicial y final, 1-indexed) de cada uno de los siguientes 5 tipos de documentos si están presentes:
1. "Nota de Entrada (RB)": Nota de Entrada de Almacén o Recibo de Bienes
2. "Remisión Comercial": Remisión o factura comercial del proveedor
3. "Orden IMSS-BIENESTAR": Orden de remisión de IMSS-BIENESTAR
4. "Certificado de Análisis (CoA)": Certificado de análisis de control de calidad del fabricante
5. "Registro Sanitario COFEPRIS": Registro sanitario oficial de la COFEPRIS

Devuelve un objeto JSON con la estructura del esquema solicitado.`;

    const phase1Response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [pdfPart, segmentationPrompt],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            segmentation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  documentType: { 
                    type: Type.STRING, 
                    description: "Debe ser exactamente una de estas: 'Nota de Entrada (RB)', 'Remisión Comercial', 'Orden IMSS-BIENESTAR', 'Certificado de Análisis (CoA)', 'Registro Sanitario COFEPRIS'" 
                  },
                  startPage: { type: Type.INTEGER, description: "Página inicial, empezando en 1" },
                  endPage: { type: Type.INTEGER, description: "Página final, empezando en 1" },
                  confidence: { type: Type.STRING, description: "Nivel de confianza: Alta, Media, Baja" }
                },
                required: ["documentType", "startPage", "endPage", "confidence"]
              }
            }
          },
          required: ["segmentation"]
        }
      }
    });

    const phase1Text = phase1Response.text;
    if (!phase1Text) {
      throw new Error("No se pudo segmentar el PDF.");
    }

    const phase1Result = JSON.parse(phase1Text.trim());
    const segments: any[] = phase1Result.segmentation || [];
    console.log("Fase 1 completada con éxito. Segmentos encontrados:", segments);

    // ==========================================
    // FASE 2: Extracción Aislada de Documentos
    // ==========================================
    console.log("Iniciando Fase 2: Extracción aislada de contenido por documento...");

    // Document types we will try to extract
    let doc1: any = null; // Nota de Entrada (RB)
    let doc2: any = null; // Remisión Comercial
    let doc3: any = null; // Orden IMSS-BIENESTAR
    let doc4: any = null; // Certificado de Análisis (CoA)
    let doc5: any = null; // Registro Sanitario COFEPRIS

    // Parallel execution of document extraction using separate specialised prompts & schemas
    await Promise.all(segments.map(async (seg) => {
      try {
        const pageInstructions = `Del PDF proporcionado, concéntrate EXCLUSIVAMENTE en el rango de páginas de la ${seg.startPage} a la ${seg.endPage}, las cuales corresponden al documento de tipo: "${seg.documentType}". No utilices datos de otras páginas.`;

        if (seg.documentType === "Nota de Entrada (RB)") {
          console.log("Extrayendo Nota de Entrada...");
          const p = `${pageInstructions} Extrae la información estructurada de la Nota de Entrada de Almacén o Recibo de Bienes.`;
          const res = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, p],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  numeroNota: { type: Type.STRING, description: "Número de folio de la Nota o Recibo de entrada" },
                  fechaRecepcion: { type: Type.STRING, description: "Fecha de recepción física en formato YYYY-MM-DD" },
                  codigoFonsabi: { type: Type.STRING, description: "Código de artículo o clave de catálogo FONSABI" },
                  descripcionArticulo: { type: Type.STRING, description: "Descripción del artículo recibida" },
                  cantidadRecibida: { type: Type.INTEGER, description: "Cantidad de piezas físicas recibidas en almacén" },
                  numeroLote: { type: Type.STRING, description: "Número de lote de fabricación" },
                  fechaCaducidad: { type: Type.STRING, description: "Fecha de caducidad en formato YYYY-MM-DD" },
                  nombreProveedor: { type: Type.STRING, description: "Nombre comercial o razón social del proveedor" },
                  numeroRemisionCapturado: { type: Type.STRING, description: "Número de folio de remisión o factura comercial capturado" }
                },
                required: ["numeroNota", "fechaRecepcion", "codigoFonsabi", "descripcionArticulo", "cantidadRecibida", "numeroLote", "fechaCaducidad", "nombreProveedor", "numeroRemisionCapturado"]
              }
            }
          });
          if (res.text) doc1 = JSON.parse(res.text.trim());
        }

        else if (seg.documentType === "Remisión Comercial") {
          console.log("Extrayendo Remisión Comercial...");
          const p = `${pageInstructions} Extrae la información detallada de la Remisión o Factura Comercial del Proveedor.`;
          const res = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, p],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  folioRemision: { type: Type.STRING, description: "Número de folio o factura de remisión comercial" },
                  fechaEmision: { type: Type.STRING, description: "Fecha de emisión en formato YYYY-MM-DD" },
                  nombreProveedor: { type: Type.STRING, description: "Nombre legal del proveedor" },
                  rfcProveedor: { type: Type.STRING, description: "RFC del proveedor" },
                  direccionProveedor: { type: Type.STRING, description: "Dirección fiscal del emisor" },
                  lote: { type: Type.STRING, description: "Lote de fabricación de la partida del medicamento" },
                  fechaCaducidad: { type: Type.STRING, description: "Fecha de caducidad de la partida en formato YYYY-MM-DD" },
                  cantidad: { type: Type.INTEGER, description: "Cantidad total de piezas en esta partida" },
                  costoUnidad: { type: Type.NUMBER, description: "Costo unitario sin IVA" },
                  registroSanitarioTexto: { type: Type.STRING, description: "Número de registro sanitario o texto legal sobre COFEPRIS impreso en este documento" }
                },
                required: ["folioRemision", "fechaEmision", "nombreProveedor", "rfcProveedor", "direccionProveedor", "lote", "fechaCaducidad", "cantidad", "costoUnidad", "registroSanitarioTexto"]
              }
            }
          });
          if (res.text) doc2 = JSON.parse(res.text.trim());
        }

        else if (seg.documentType === "Orden IMSS-BIENESTAR") {
          console.log("Extrayendo Orden IMSS-BIENESTAR...");
          const p = `${pageInstructions} Extrae la información estructurada de la Orden de Remisión IMSS-BIENESTAR.`;
          const res = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, p],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  folioOrden: { type: Type.STRING, description: "Número de folio de la Orden IMSS-BIENESTAR" },
                  fechaExpedicion: { type: Type.STRING, description: "Fecha de expedición en formato YYYY-MM-DD" },
                  claveArticulo: { type: Type.STRING, description: "Clave técnica del artículo" },
                  descripcionArticulo: { type: Type.STRING, description: "Descripción completa" },
                  cantidadSolicitada: { type: Type.INTEGER, description: "Cantidad total solicitada" },
                  cantidadAutorizada: { type: Type.INTEGER, description: "Cantidad autorizada" },
                  loteAsignado: { type: Type.STRING, description: "Lote asignado oficialmente" },
                  fechaCaducidad: { type: Type.STRING, description: "Fecha de caducidad en formato YYYY-MM-DD" }
                },
                required: ["folioOrden", "fechaExpedicion", "claveArticulo", "descripcionArticulo", "cantidadSolicitada", "cantidadAutorizada", "loteAsignado", "fechaCaducidad"]
              }
            }
          });
          if (res.text) doc3 = JSON.parse(res.text.trim());
        }

        else if (seg.documentType === "Certificado de Análisis (CoA)") {
          console.log("Extrayendo Certificado de Análisis (CoA)...");
          const p = `${pageInstructions} Extrae la información detallada del Certificado de Análisis (CoA) de control de calidad del laboratorio.`;
          const res = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, p],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  numeroCertificado: { type: Type.STRING, description: "Folio o número de certificado de calidad" },
                  nombreFabricante: { type: Type.STRING, description: "Nombre del laboratorio fabricante" },
                  nombreProducto: { type: Type.STRING, description: "Nombre del producto químico o genérico" },
                  numeroLoteAnalizado: { type: Type.STRING, description: "Lote que fue analizado físicamente" },
                  fechaFabricacionElaboracion: { type: Type.STRING, description: "Fecha de fabricación en formato YYYY-MM-DD" },
                  fechaCaducidad: { type: Type.STRING, description: "Fecha de caducidad en formato YYYY-MM-DD" },
                  formaFarmaceutica: { type: Type.STRING, description: "Forma farmacéutica analizada" },
                  resultadoAnalisis: { type: Type.STRING, description: "Dictamen o resultado del análisis" }
                },
                required: ["numeroCertificado", "nombreFabricante", "nombreProducto", "numeroLoteAnalizado", "fechaFabricacionElaboracion", "fechaCaducidad", "formaFarmaceutica", "resultadoAnalisis"]
              }
            }
          });
          if (res.text) doc4 = JSON.parse(res.text.trim());
        }

        else if (seg.documentType === "Registro Sanitario COFEPRIS") {
          console.log("Extrayendo Registro Sanitario COFEPRIS...");
          const p = `${pageInstructions} Extrae los datos legales del documento de Registro Sanitario emitido por COFEPRIS.`;
          const res = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [pdfPart, p],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  numeroRegistroSanitario: { type: Type.STRING, description: "Número de Registro Sanitario COFEPRIS completo" },
                  titularRegistro: { type: Type.STRING, description: "Compañía o laboratorio titular del registro" },
                  nombreMedicamento: { type: Type.STRING, description: "Nombre oficial del medicamento" },
                  formaFarmaceuticaAutorizada: { type: Type.STRING, description: "Forma farmacéutica aprobada" },
                  fechaVigencia: { type: Type.STRING, description: "Fecha de vigencia oficial en formato YYYY-MM-DD" },
                  estatusVigencia: { type: Type.STRING, description: "Estatus (Vigente o Vencido)" }
                },
                required: ["numeroRegistroSanitario", "titularRegistro", "nombreMedicamento", "formaFarmaceuticaAutorizada", "fechaVigencia", "estatusVigencia"]
              }
            }
          });
          if (res.text) doc5 = JSON.parse(res.text.trim());
        }
      } catch (innerErr: any) {
        console.error(`Error extrayendo datos para segmento ${seg.documentType}:`, innerErr.message);
      }
    }));

    console.log("Fase 2 de extracción completada.");

    // ==========================================
    // EJECUCIÓN DE AMARRE CRUZADO PROGRAMÁTICO
    // ==========================================
    const amarres = calculateAmarres(doc1, doc2, doc3, doc4, doc5);

    // ==========================================
    // COMPARACIÓN CON EL SISTEMA (HOJA DE CÁLCULO)
    // ==========================================
    // We compare with doc2 (Remisión Comercial) and doc1 (Nota de Entrada) as they contain physical receipt data.
    const sanitizeStr = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    // 1. Lote
    const extractedLote = doc1?.numeroLote || doc2?.lote || "";
    const loteMatch = sanitizeStr(targetEntry.lote) === sanitizeStr(extractedLote);

    // 2. Caducidad
    const extractedCad = doc1?.fechaCaducidad || doc2?.fechaCaducidad || "";
    const sheetDate = parseSheetDateToISO(targetEntry.fechaCaducidad);
    const pdfDate = parseSheetDateToISO(extractedCad);
    const dateMatch = sheetDate === pdfDate && sheetDate !== "";

    // 3. Cantidad
    const extractedQty = doc1?.cantidadRecibida || doc2?.cantidad || 0;
    const sheetQty = cleanNum(targetEntry.cantidad);
    const pdfQty = cleanNum(extractedQty);
    const cantidadMatch = sheetQty === pdfQty;

    // 4. Costo Unitario
    const extractedCost = doc2?.costoUnidad || 0;
    const sheetCost = cleanNum(targetEntry.costoUnidad);
    const pdfCost = cleanNum(extractedCost);
    const costoMatch = Math.abs(sheetCost - pdfCost) < 0.01;

    // 5. Proveedor
    const extractedProv = doc1?.nombreProveedor || doc2?.nombreProveedor || "";
    const p1 = targetEntry.proveedor.toLowerCase();
    const p2 = extractedProv.toLowerCase();
    const proveedorMatch = p1.includes(p2) || p2.includes(p1) || (extractedProv !== "" && sanitizeStr(p1).slice(0, 10) === sanitizeStr(p2).slice(0, 10));

    // 6. Remisión
    const extractedRem = doc1?.numeroRemisionCapturado || doc2?.folioRemision || "";
    const remisionMatch = sanitizeStr(targetEntry.remision) === sanitizeStr(extractedRem) || targetEntry.remision.includes(extractedRem) || extractedRem.includes(targetEntry.remision);

    const comparisons: any = {
      lote: {
        sheetValue: targetEntry.lote,
        pdfValue: extractedLote,
        isMatch: loteMatch,
        field: "lote",
        label: "Número de Lote"
      },
      fechaCaducidad: {
        sheetValue: targetEntry.fechaCaducidad,
        pdfValue: extractedCad,
        isMatch: dateMatch,
        field: "fechaCaducidad",
        label: "Fecha de Caducidad"
      },
      cantidad: {
        sheetValue: targetEntry.cantidad,
        pdfValue: String(extractedQty),
        isMatch: cantidadMatch,
        field: "cantidad",
        label: "Cantidad (Unidades)"
      },
      costoUnidad: {
        sheetValue: targetEntry.costoUnidad,
        pdfValue: String(extractedCost),
        isMatch: costoMatch,
        field: "costoUnidad",
        label: "Costo Unitario"
      },
      proveedor: {
        sheetValue: targetEntry.proveedor,
        pdfValue: extractedProv,
        isMatch: proveedorMatch,
        field: "proveedor",
        label: "Proveedor"
      },
      remision: {
        sheetValue: targetEntry.remision,
        pdfValue: extractedRem,
        isMatch: remisionMatch,
        field: "remision",
        label: "Folio de Remisión / Factura"
      }
    };

    const matchedCount = Object.values(comparisons).filter((c: any) => c.isMatch).length;
    const passedAmarres = amarres.filter(a => a.isMatch).length;
    const matchPercentage = Math.round(((matchedCount + passedAmarres) / (6 + amarres.length)) * 100);

    let observaciones = "ANÁLISIS REAL COMPLETO DE EXPEDIENTE: ";
    if (matchPercentage === 100) {
      observaciones += "Todos los documentos analizados cruzaron de forma perfecta. El amarre cruzado programático es satisfactorio y los datos de recepción concuerdan con el sistema.";
    } else {
      observaciones += `Se detectaron inconsistencias de validación cruzada. `;
      const failed = amarres.filter(a => !a.isMatch);
      if (failed.length > 0) {
        observaciones += `Alertas encontradas: ${failed.map(f => f.label).join(", ")}. `;
      }
    }

    return res.json({
      report: {
        entryId: String(entryNo),
        matchPercentage,
        comparisons,
        observaciones,
        extractedRaw: doc2 || {}, // Backward compatibility
        isMock: false,
        segmentation: segments,
        doc1,
        doc2,
        doc3,
        doc4,
        doc5,
        amarres
      }
    });

  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    return res.status(500).json({ error: `Error en análisis de IA: ${error.message}` });
  }
});

// 4. Autorizar o rechazar entrada en Google Sheets
app.post("/api/authorize-entry", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { spreadsheetId, entryNo, estatus, userEmail, notaRechazo } = req.body;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Token de Google requerido." });
  }
  if (!spreadsheetId) {
    return res.status(400).json({ error: "Falta el ID de la hoja de cálculo (spreadsheetId)." });
  }
  if (!entryNo) {
    return res.status(400).json({ error: "Falta el número de entrada (entryNo)." });
  }
  if (!estatus || (estatus !== "Autorizado" && estatus !== "Rechazado")) {
    return res.status(400).json({ error: "Estatus inválido. Debe ser 'Autorizado' o 'Rechazado'." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const oauth2Client = createOAuth2Client(token);
    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    const sheetName = await getFirstSheetName(sheets, spreadsheetId);

    // 1. Get current sheet values to locate the row index and headers dynamically
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ1000`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "No se encontraron datos en la hoja." });
    }

    const headers = rows[0].map(h => cellStr(h).trim());
    const idxNo = headers.indexOf("No.");
    const idxEstatus = headers.indexOf("Estatus");
    const idxFechaAuth = headers.indexOf("Fecha Autorización");
    const idxUserAuth = headers.indexOf("Usuario Autorización");
    let idxNotaRechazo = headers.indexOf("Nota de Rechazo");

    if (idxNo === -1 || idxEstatus === -1) {
      return res.status(400).json({ error: "Estructura de hoja inválida. Falta columna 'No.' o 'Estatus'." });
    }

    // Handle dynamically creating the "Nota de Rechazo" header if missing
    if (idxNotaRechazo === -1) {
      idxNotaRechazo = headers.length;
      headers.push("Nota de Rechazo");
      // Update first row of sheet to include the new header column
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:ZZ1`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [headers]
        }
      });
    }

    let rowIndex = -1;
    let existingRow: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && cellStr(rows[i][idxNo]) === String(entryNo)) {
        rowIndex = i + 1; // 1-indexed row number in sheets
        existingRow = rows[i];
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: `No se encontró el registro con No. ${entryNo}` });
    }

    const todayDate = new Date().toISOString().split("T")[0];
    const updatedRow = [...existingRow];

    // Ensure the array has enough cells to reach the columns we want to edit
    const maxIdx = Math.max(
      idxEstatus, 
      idxFechaAuth !== -1 ? idxFechaAuth : 0, 
      idxUserAuth !== -1 ? idxUserAuth : 0,
      idxNotaRechazo !== -1 ? idxNotaRechazo : 0
    );
    while (updatedRow.length <= maxIdx) {
      updatedRow.push("");
    }

    // Modify strictly the correct cells
    updatedRow[idxEstatus] = estatus;
    if (idxFechaAuth !== -1) {
      updatedRow[idxFechaAuth] = estatus === "Autorizado" ? todayDate : "";
    }
    if (idxUserAuth !== -1) {
      updatedRow[idxUserAuth] = estatus === "Autorizado" ? (userEmail || "sistema@fonsabi.gob.mx") : "";
    }
    if (idxNotaRechazo !== -1) {
      updatedRow[idxNotaRechazo] = estatus === "Rechazado" ? (notaRechazo || "Rechazado por discrepancia de datos") : "";
    }

    // Guardar abriendo el rango hasta la columna ZZ para no recortar la fila
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}:ZZ${rowIndex}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [updatedRow]
      }
    });

    // Encontrar posiciones dinámicas para reconstruir el updatedEntry
    const idxCodigo = headers.indexOf("Código FONSABI");
    const idxDesc = headers.indexOf("Descripción");
    const idxPdf = headers.indexOf("PDF");
    const idxLote = headers.indexOf("Lote");
    const idxFechaCad = headers.indexOf("Fecha de Caducidad");
    const idxCantidad = headers.indexOf("Cantidad ") !== -1 ? headers.indexOf("Cantidad ") : headers.indexOf("Cantidad Unitaria");
    const idxCosto = headers.indexOf("Costo por Unidad");
    const idxProveedor = headers.indexOf("Proveedor");
    const idxRemision = headers.indexOf("Remisión");

    const updatedEntry = {
      no: cellStr(updatedRow[idxNo]),
      codigoFonsabi: idxCodigo !== -1 ? cellStr(updatedRow[idxCodigo]) : "",
      descripcion: idxDesc !== -1 ? cellStr(updatedRow[idxDesc]) : "",
      estatus: cellStr(updatedRow[idxEstatus]) as any,
      pdf: idxPdf !== -1 ? cellStr(updatedRow[idxPdf]) : "",
      lote: idxLote !== -1 ? cellStr(updatedRow[idxLote]) : "",
      fechaCaducidad: idxFechaCad !== -1 ? cellStr(updatedRow[idxFechaCad]) : "",
      cantidad: idxCantidad !== -1 ? cellStr(updatedRow[idxCantidad]) : "",
      costoUnidad: idxCosto !== -1 ? cellStr(updatedRow[idxCosto]) : "",
      proveedor: idxProveedor !== -1 ? cellStr(updatedRow[idxProveedor]) : "",
      remision: idxRemision !== -1 ? cellStr(updatedRow[idxRemision]) : "",
      fechaAutorizacion: idxFechaAuth !== -1 ? cellStr(updatedRow[idxFechaAuth]) : "",
      usuarioAutorizacion: idxUserAuth !== -1 ? cellStr(updatedRow[idxUserAuth]) : "",
      notaRechazo: idxNotaRechazo !== -1 ? cellStr(updatedRow[idxNotaRechazo]) : "",
    };

    return res.json({
      success: true,
      rowIndex,
      updatedEntry
    });

  } catch (error: any) {
    console.error("Error al actualizar Google Sheets:", error);
    return res.status(500).json({ error: `Error de Google Sheets API: ${error.message}` });
  }
});

// 5. Generar Oficio de Validación consolidado en Google Docs
app.post("/api/generate-oficio", async (req, res) => {
  const authHeader = req.headers.authorization;
  const { selectedEntries, templateId, userEmail } = req.body;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado. Token de Google requerido." });
  }
  if (!selectedEntries || !Array.isArray(selectedEntries) || selectedEntries.length === 0) {
    return res.status(400).json({ error: "Se requiere un arreglo de registros (selectedEntries)." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const oauth2Client = createOAuth2Client(token);
    const docs = google.docs({ version: "v1", auth: oauth2Client });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    let documentId: string;
    const todayDateStr = new Date().toISOString().split("T")[0];
    const docTitle = `Oficio de Validación Consolidado - FONSABI - ${todayDateStr}`;

    if (templateId) {
      const copyResponse = await drive.files.copy({
        fileId: templateId,
        requestBody: {
          name: docTitle
        }
      });
      documentId = copyResponse.data.id!;
    } else {
      const createResponse = await docs.documents.create({
        requestBody: {
          title: docTitle
        }
      });
      documentId = createResponse.data.documentId!;
    }

    // Build the consolidated table of approved inputs
    let tableText = "";
    tableText += "-------------------------------------------------------------------------------------------------------------------------\n";
    tableText += "No.  | Código FONSABI | Lote            | Cant. | Costo U. | Proveedor / Remisión / Descripción\n";
    tableText += "-------------------------------------------------------------------------------------------------------------------------\n";

    selectedEntries.forEach((entry: any) => {
      const no = String(entry.no || "").padEnd(4, ' ');
      const code = String(entry.codigoFonsabi || "").padEnd(14, ' ');
      const lote = String(entry.lote || "").padEnd(15, ' ');
      const cant = String(entry.cantidad || "").padEnd(5, ' ');
      const costo = `$${Number(entry.costoUnidad || 0).toFixed(2)}`.padEnd(8, ' ');
      const provStr = `${entry.proveedor || "N/A"} (REM: ${entry.remision || "N/A"}) - ${entry.descripcion || ""}`;
      tableText += `${no} | ${code} | ${lote} | ${cant} | ${costo} | ${provStr}\n`;
    });
    tableText += "-------------------------------------------------------------------------------------------------------------------------\n";

    const localTodayStr = new Date().toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    const bodyText = `OFICIO DE VALIDACIÓN Y CONSOLIDACIÓN DE INSUMOS MÉDICOS
FONSABI (Fondo de Salud para el Bienestar)

Fecha de emisión: ${localTodayStr}
Asunto: Acta de Recepción y Oficio de Validación de Insumos Médicos Aprobados

A QUIEN CORRESPONDA:

Por medio de la presente, la Dirección de Control de Insumos y Logística de FONSABI hace constar que se ha completado con éxito el dictamen de validación física, analítica y documental de las siguientes entradas de medicamentos e insumos médicos en el sistema de control del almacén. 

Tras haber realizado el proceso automatizado de cotejo inteligente (computación de discrepancias en lote, caducidad, cantidades e importes unitarios contra las remisiones en formato PDF firmadas por los proveedores), se confirma que los siguientes registros de insumos cumplen plenamente con las especificaciones técnicas y administrativas registradas en el sistema:

${tableText}

Resumen de Validación:
- Partidas consolidadas: ${selectedEntries.length}
- Estado del Dictamen: TOTALMENTE AUTORIZADO Y CONSOLIDADO
- Operador responsable: ${userEmail || "sistema@fonsabi.gob.mx"}

Este documento electrónico sirve como Oficio de Validación formal y constancia de recepción de conformidad de los bienes para su integración inmediata al inventario y posterior distribución en los centros de salud autorizados.

Atentamente,

___________________________________________
DIRECCIÓN DE CONTROL DE INSUMOS Y LOGÍSTICA
FONSABI - GOBIERNO DE MÉXICO
`;

    // Inyectar mediante batchUpdate (insertText) el cuerpo formal
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: {
                index: 1,
              },
              text: bodyText
            }
          }
        ]
      }
    });

    // Cambiar permisos a público lector para que se pueda abrir directamente
    try {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: "reader",
          type: "anyone"
        }
      });
    } catch (permError: any) {
      console.warn("No se pudieron otorgar permisos de lectura general al Oficio:", permError.message);
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return res.json({
      success: true,
      documentId,
      documentUrl
    });

  } catch (error: any) {
    console.error("Error al generar Oficio de Google Docs:", error);
    return res.status(500).json({ error: `Error de Google Docs/Drive API: ${error.message}` });
  }
});

// Vite server / production routing integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
