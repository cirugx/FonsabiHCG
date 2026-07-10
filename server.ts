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

// 3. Verificar PDF con Gemini
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
      codigoFonsabi: "FONS-3029",
      descripcion: "Paracetamol 500mg - Caja c/20 tabletas",
      estatus: "Sin autorizar",
      pdf: pdfUrl || "https://unec.edu.az/application/uploads/2014/12/pdf-sample.pdf",
      lote: "LOT-9988X",
      fechaCaducidad: "2028-12-31",
      cantidad: "500",
      costoUnidad: "2.50",
      proveedor: "Distribuidora Médica del Norte",
      remision: "REM-2026-001"
    };
  }

  // Check if we should simulate (e.g. forceSimulate or missing Gemini Key)
  const geminiKey = process.env.GEMINI_API_KEY;
  const isMock = forceSimulate || !geminiKey || pdfUrl?.includes("dummy") || pdfUrl?.includes("sample.pdf");

  if (isMock) {
    console.log("Generando reporte de verificación simulado...");
    // Let's build a deterministic simulation with some interesting discrepancies for test value
    const loteSimValue = entryNo === "1" ? "LOT-9988M" : targetEntry.lote; // Discrepancy on row 1!
    const cantidadSimValue = entryNo === "1" ? "500" : (entryNo === "2" ? "80" : targetEntry.cantidad); // Discrepancy on row 2!
    const remisionSimValue = targetEntry.remision;
    const proveedorSimValue = targetEntry.proveedor;
    const costoUnidadSimValue = targetEntry.costoUnidad;
    const fechaCaducidadSimValue = targetEntry.fechaCaducidad;

    const comps: any = {
      lote: {
        sheetValue: targetEntry.lote,
        pdfValue: loteSimValue,
        isMatch: targetEntry.lote.toLowerCase() === loteSimValue.toLowerCase(),
        field: "lote",
        label: "Número de Lote"
      },
      fechaCaducidad: {
        sheetValue: targetEntry.fechaCaducidad,
        pdfValue: fechaCaducidadSimValue,
        isMatch: targetEntry.fechaCaducidad === fechaCaducidadSimValue,
        field: "fechaCaducidad",
        label: "Fecha de Caducidad"
      },
      cantidad: {
        sheetValue: targetEntry.cantidad,
        pdfValue: cantidadSimValue,
        isMatch: Number(targetEntry.cantidad) === Number(cantidadSimValue),
        field: "cantidad",
        label: "Cantidad (Unidades)"
      },
      costoUnidad: {
        sheetValue: targetEntry.costoUnidad,
        pdfValue: costoUnidadSimValue,
        isMatch: Number(targetEntry.costoUnidad) === Number(costoUnidadSimValue),
        field: "costoUnidad",
        label: "Costo Unitario"
      },
      proveedor: {
        sheetValue: targetEntry.proveedor,
        pdfValue: proveedorSimValue,
        isMatch: targetEntry.proveedor.toLowerCase().includes(proveedorSimValue.toLowerCase()) || proveedorSimValue.toLowerCase().includes(targetEntry.proveedor.toLowerCase()),
        field: "proveedor",
        label: "Proveedor"
      },
      remision: {
        sheetValue: targetEntry.remision,
        pdfValue: remisionSimValue,
        isMatch: targetEntry.remision.toLowerCase() === remisionSimValue.toLowerCase(),
        field: "remision",
        label: "Folio de Remisión / Factura"
      }
    };

    const matchedCount = Object.values(comps).filter((c: any) => c.isMatch).length;
    const matchPercentage = Math.round((matchedCount / 6) * 100);

    let observaciones = "ANÁLISIS SIMULADO: ";
    if (matchPercentage === 100) {
      observaciones += "Todos los campos críticos del documento coinciden perfectamente con los datos del sistema. Listo para autorización.";
    } else {
      observaciones += `Se identificaron discrepancias críticas: ${
        !comps.lote.isMatch ? `El lote del PDF (${comps.lote.pdfValue}) no coincide con el del sistema (${comps.lote.sheetValue}). ` : ""
      }${
        !comps.cantidad.isMatch ? `La cantidad física en PDF (${comps.cantidad.pdfValue}) difiere del registro del sistema (${comps.cantidad.sheetValue}). ` : ""
      }Se recomienda revisión física o rechazo de entrada.`;
    }

    return res.json({
      report: {
        entryId: String(entryNo),
        matchPercentage,
        comparisons: comps,
        observaciones,
        extractedRaw: {
          lote: loteSimValue,
          fechaCaducidad: fechaCaducidadSimValue,
          cantidad: cantidadSimValue,
          costoUnidad: costoUnidadSimValue,
          proveedor: proveedorSimValue,
          remision: remisionSimValue
        },
        isMock: true
      }
    });
  }

  // Real Gemini API analysis!
  try {
    const pdfBuffer = await downloadPDF(pdfUrl, token);
    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const pdfPart = {
      inlineData: {
        mimeType: "application/pdf",
        data: pdfBuffer.toString("base64")
      }
    };

    const promptText = `Analiza este documento PDF (remisión, factura o nota de entrega médica) y extrae con precisión los siguientes campos requeridos:
- lote (Número de lote de fabricación de medicamentos/materiales)
- fechaCaducidad (Fecha de expiración/vencimiento en formato exacto YYYY-MM-DD. Si viene en formato MM/AA, adáptalo al último día del mes correspondiente, ej: 12/28 -> 2028-12-31)
- cantidad (La cantidad total entregada o recibida como un entero)
- costoUnidad (El costo unitario o precio por unidad del artículo, como número decimal)
- proveedor (Nombre legal o comercial de la empresa proveedora)
- remision (Número de folio de la remisión o factura)

Adicionalmente, describe en 'observaciones' brevemente qué tipo de documento es y si encontraste alguna nota importante en el texto.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [pdfPart, promptText],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lote: { type: Type.STRING, description: "Número de lote" },
            fechaCaducidad: { type: Type.STRING, description: "Fecha de caducidad en formato YYYY-MM-DD" },
            cantidad: { type: Type.INTEGER, description: "Cantidad total" },
            costoUnidad: { type: Type.NUMBER, description: "Costo por unidad" },
            proveedor: { type: Type.STRING, description: "Nombre del proveedor" },
            remision: { type: Type.STRING, description: "Folio de remisión o factura" },
            observaciones: { type: Type.STRING, description: "Notas u observaciones del análisis del documento" }
          },
          required: ["lote", "fechaCaducidad", "cantidad", "costoUnidad", "proveedor", "remision", "observaciones"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gemini no devolvió texto en el análisis.");
    }

    const extracted = JSON.parse(resultText.trim());

    // Run comparison logic
    const sanitizeStr = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const loteMatch = sanitizeStr(targetEntry.lote) === sanitizeStr(extracted.lote);
    const dateMatch = targetEntry.fechaCaducidad === extracted.fechaCaducidad;
    const cantidadMatch = Number(targetEntry.cantidad) === Number(extracted.cantidad);
    const costoMatch = Math.abs(Number(targetEntry.costoUnidad) - Number(extracted.costoUnidad)) < 0.01;
    
    // Proveedor loose match
    const p1 = targetEntry.proveedor.toLowerCase();
    const p2 = extracted.proveedor.toLowerCase();
    const proveedorMatch = p1.includes(p2) || p2.includes(p1) || sanitizeStr(p1).slice(0, 10) === sanitizeStr(p2).slice(0, 10);
    
    // Remisión loose match
    const remisionMatch = sanitizeStr(targetEntry.remision) === sanitizeStr(extracted.remision) || targetEntry.remision.includes(extracted.remision) || extracted.remision.includes(targetEntry.remision);

    const comps: any = {
      lote: {
        sheetValue: targetEntry.lote,
        pdfValue: extracted.lote,
        isMatch: loteMatch,
        field: "lote",
        label: "Número de Lote"
      },
      fechaCaducidad: {
        sheetValue: targetEntry.fechaCaducidad,
        pdfValue: extracted.fechaCaducidad,
        isMatch: dateMatch,
        field: "fechaCaducidad",
        label: "Fecha de Caducidad"
      },
      cantidad: {
        sheetValue: targetEntry.cantidad,
        pdfValue: String(extracted.cantidad),
        isMatch: cantidadMatch,
        field: "cantidad",
        label: "Cantidad (Unidades)"
      },
      costoUnidad: {
        sheetValue: targetEntry.costoUnidad,
        pdfValue: String(extracted.costoUnidad),
        isMatch: costoMatch,
        field: "costoUnidad",
        label: "Costo Unitario"
      },
      proveedor: {
        sheetValue: targetEntry.proveedor,
        pdfValue: extracted.proveedor,
        isMatch: proveedorMatch,
        field: "proveedor",
        label: "Proveedor"
      },
      remision: {
        sheetValue: targetEntry.remision,
        pdfValue: extracted.remision,
        isMatch: remisionMatch,
        field: "remision",
        label: "Folio de Remisión / Factura"
      }
    };

    const matchedCount = Object.values(comps).filter((c: any) => c.isMatch).length;
    const matchPercentage = Math.round((matchedCount / 6) * 100);

    return res.json({
      report: {
        entryId: String(entryNo),
        matchPercentage,
        comparisons: comps,
        observaciones: extracted.observaciones || "Análisis completado.",
        extractedRaw: extracted,
        isMock: false
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
  const { spreadsheetId, entryNo, estatus, userEmail } = req.body;

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

    if (idxNo === -1 || idxEstatus === -1) {
      return res.status(400).json({ error: "Estructura de hoja inválida. Falta columna 'No.' o 'Estatus'." });
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
    const maxIdx = Math.max(idxEstatus, idxFechaAuth !== -1 ? idxFechaAuth : 0, idxUserAuth !== -1 ? idxUserAuth : 0);
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
