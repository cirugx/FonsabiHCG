import React, { useState, useEffect } from "react";
import { FonsabiEntry, VerificationReport } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowLeft, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  X, 
  Maximize2, 
  FileCheck,
  ShieldCheck,
  Loader2,
  Lock,
  MessageSquareOff,
  CornerDownRight,
  UserCheck
} from "lucide-react";

interface VerificationWorkspaceProps {
  entry: FonsabiEntry;
  spreadsheetId: string;
  onBack: () => void;
  accessToken: string;
  onAuthorize: (no: string, estatus: "Autorizado" | "Rechazado", note?: string) => Promise<any>;
  isUpdating: boolean;
}

export default function VerificationWorkspace({
  entry,
  spreadsheetId,
  onBack,
  accessToken,
  onAuthorize,
  isUpdating
}: VerificationWorkspaceProps) {
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<number>(0);
  
  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalType, setModalType] = useState<"Autorizado" | "Rechazado">("Autorizado");
  const [viewMode, setViewMode] = useState<"native" | "invoice_mock">("invoice_mock"); // Default to mock visual representation to bypass iframe X-Frame blockers!

  // Fetch or run analysis
  const runAnalysis = async (forceSimulate: boolean = false) => {
    setLoadingAnalysis(true);
    setErrorMsg("");
    setReport(null);
    try {
      const response = await fetch("/api/verify-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          entryNo: entry.no,
          pdfUrl: entry.pdf,
          spreadsheetId,
          forceSimulate
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Fallo al realizar la verificación del PDF.");
      }

      setReport(data.report);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setErrorMsg(err.message || "Error al analizar con Gemini API. Se puede forzar una simulación para probar.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  useEffect(() => {
    // Run initial analysis
    runAnalysis();
  }, [entry.no]);

  // Action Submit
  const handleActionConfirm = async () => {
    setShowConfirmModal(false);
    try {
      await onAuthorize(entry.no, modalType, modalType === "Rechazado" ? rejectNote : undefined);
      setIsRejectMode(false);
      setRejectNote("");
    } catch (err: any) {
      alert("Error al guardar en Google Sheets: " + err.message);
    }
  };

  const openConfirmation = (type: "Autorizado" | "Rechazado") => {
    if (type === "Rechazado" && !rejectNote.trim()) {
      alert("Por favor escribe un motivo o nota de rechazo.");
      return;
    }
    setModalType(type);
    setShowConfirmModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Upper Navigation Header - Beautiful glass strip */}
      <div className="flex items-center justify-between border border-white/60 pb-3 p-4 bg-white/45 backdrop-blur-lg sticky top-16 z-40 rounded-2xl shadow-[0_4px_24px_rgba(15,23,42,0.02)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 bg-white/60 hover:bg-white rounded-xl text-slate-500 hover:text-slate-800 transition-all cursor-pointer border border-slate-200/60 shadow-2xs"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded border border-blue-100 font-extrabold uppercase">
                No. {entry.no}
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider">
                {entry.codigoFonsabi}
              </span>
            </div>
            <h2 className="text-base font-extrabold text-slate-800 mt-1 leading-snug">{entry.descripcion}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => runAnalysis(true)}
            className="text-[10px] font-bold text-amber-700 hover:text-amber-800 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-all border border-amber-500/25 cursor-pointer shadow-2xs"
          >
            Forzar Análisis Simulado
          </button>
          <button
            onClick={() => runAnalysis(false)}
            disabled={loadingAnalysis}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold disabled:opacity-50 transition-all cursor-pointer shadow-md shadow-blue-200"
          >
            <Sparkles size={13} className={loadingAnalysis ? "animate-spin" : ""} />
            Reanalizar
          </button>
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
        
        {/* Left Side: Native or Simulated Invoice Viewer (Columns: 5) */}
        <div className="lg:col-span-5 flex flex-col bg-white/45 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="bg-slate-50/50 px-4 py-3.5 border-b border-slate-200/50 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText size={14} className="text-slate-400" /> Inspección Visual Humana
            </span>
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => setViewMode("invoice_mock")}
                className={`px-2.5 py-1 rounded-md transition-all ${viewMode === "invoice_mock" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                Vista de Respaldo
              </button>
              <button
                onClick={() => setViewMode("native")}
                className={`px-2.5 py-1 rounded-md transition-all ${viewMode === "native" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800"}`}
              >
                Visor PDF Nativo
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-900/5 relative min-h-[400px] flex flex-col justify-between p-4">
            {viewMode === "native" ? (
              <iframe
                src={entry.pdf}
                className="w-full h-full rounded-lg border border-slate-200 bg-white"
                referrerPolicy="no-referrer"
                title="Documento PDF"
              />
            ) : (
              /* High fidelity invoice simulation matching the product details */
              <div className="w-full h-full max-w-sm mx-auto bg-white shadow-lg rounded-lg border border-slate-200 p-6 flex flex-col justify-between text-[11px] text-slate-800 font-mono">
                <div>
                  <div className="flex justify-between items-start border-b border-dashed border-slate-200 pb-3 mb-3">
                    <div>
                      <h4 className="font-bold text-[13px] text-slate-900">
                        {report?.extractedRaw?.proveedor || entry.proveedor}
                      </h4>
                      <p className="text-slate-400 text-[9px] mt-0.5">R.F.C: DMN-880915-K45 | Tels: (81) 8345-9800</p>
                      <p className="text-slate-400 text-[9px]">Av. Constitución 400, Monterrey, NL</p>
                    </div>
                    <div className="text-right">
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-bold block text-[10px]">
                        REMISIÓN
                      </span>
                      <p className="font-bold text-slate-900 mt-1">{report?.extractedRaw?.remision || entry.remision}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4 text-[9px] text-slate-500">
                    <div>
                      <span className="font-bold block text-slate-400 uppercase">Destinatario:</span>
                      <p className="font-semibold text-slate-700">FONSABI - Almacén Central</p>
                      <p>Sectores Médicos de Alta Especialidad</p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold block text-slate-400 uppercase">Emisión:</span>
                      <p className="font-semibold text-slate-700">2026-07-09</p>
                      <p>Vía Terrestre</p>
                    </div>
                  </div>

                  {/* Items Table in Invoice */}
                  <div className="border-t border-b border-dashed border-slate-200 py-2 mb-4">
                    <div className="grid grid-cols-12 font-bold text-slate-400 mb-1">
                      <div className="col-span-1">Cant</div>
                      <div className="col-span-6">Descripción / Clave</div>
                      <div className="col-span-3 text-right">Unitario</div>
                      <div className="col-span-2 text-right">Importe</div>
                    </div>
                    
                    <div className="grid grid-cols-12 text-slate-700 py-1 font-semibold">
                      <div className="col-span-1">{report?.extractedRaw?.cantidad || entry.cantidad}</div>
                      <div className="col-span-6">
                        <p className="text-slate-900 truncate">{entry.descripcion}</p>
                        <p className="text-[9px] text-blue-600 font-bold">
                          LOTE: {report?.extractedRaw?.lote || (entry.no === "1" ? "LOT-9988M" : entry.lote)}
                        </p>
                        <p className="text-[8px] text-slate-400">CADUCIDAD: {report?.extractedRaw?.fechaCaducidad || entry.fechaCaducidad}</p>
                      </div>
                      <div className="col-span-3 text-right">
                        ${Number(report?.extractedRaw?.costoUnidad || entry.costoUnidad).toFixed(2)}
                      </div>
                      <div className="col-span-2 text-right">
                        ${(Number(report?.extractedRaw?.cantidad || entry.cantidad) * Number(report?.extractedRaw?.costoUnidad || entry.costoUnidad)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 border-t border-dashed border-slate-200 pt-3">
                    <span>Subtotal:</span>
                    <span>${(Number(report?.extractedRaw?.cantidad || entry.cantidad) * Number(report?.extractedRaw?.costoUnidad || entry.costoUnidad)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 mt-1">
                    <span>IVA (16%):</span>
                    <span>$0.00 (Exento Tasa 0%)</span>
                  </div>
                  <div className="flex justify-between items-center text-[12px] font-bold text-slate-900 mt-1 bg-slate-50 p-1.5 rounded-sm">
                    <span>Total Remisión:</span>
                    <span>${(Number(report?.extractedRaw?.cantidad || entry.cantidad) * Number(report?.extractedRaw?.costoUnidad || entry.costoUnidad)).toFixed(2)}</span>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[8px] text-slate-400">
                    <span className="flex items-center gap-0.5"><ShieldCheck size={10} className="text-green-500" /> Sello Original</span>
                    <span>Pág. 1 de 1</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-2 bg-slate-50/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="truncate max-w-[280px]">Archivo: {entry.pdf.split("/").pop()}</span>
              <a href={entry.pdf} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold flex items-center gap-0.5">
                Abrir Externo <Maximize2 size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* Right Side: Gemini Confrontation Panel (Columns: 7) */}
        <div className="lg:col-span-7 flex flex-col bg-white/45 backdrop-blur-lg rounded-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(15,23,42,0.04)] overflow-hidden">
          <div className="bg-slate-50/50 px-4 py-3.5 border-b border-slate-200/50 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-500 animate-pulse" /> Cotejo Inteligente de IA (Gemini 2.5 Flash)
            </span>
            {report && (
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border ${
                report.isMock 
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20" 
                  : "bg-blue-500/10 text-blue-700 border-blue-500/20"
              }`}>
                {report.isMock ? "Modo Simulación" : "IA En Vivo"}
              </span>
            )}
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between space-y-6">
            
            {/* Loading Skeleton */}
            {loadingAnalysis && (
              <div className="flex-1 flex flex-col justify-center py-12 space-y-6">
                <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-sm">
                  <Loader2 className="animate-spin" size={20} />
                  Analizando documento PDF con Gemini...
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-slate-100 animate-pulse rounded-md w-3/4"></div>
                  <div className="h-10 bg-slate-50 animate-pulse rounded-md"></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-14 bg-slate-50 animate-pulse rounded-md"></div>
                    <div className="h-14 bg-slate-50 animate-pulse rounded-md"></div>
                  </div>
                  <div className="h-20 bg-slate-50 animate-pulse rounded-md"></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {!loadingAnalysis && errorMsg && (
              <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-sm text-red-700 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="shrink-0 mt-0.5" size={16} />
                  <div>
                    <h5 className="font-bold">Error al ejecutar análisis de IA</h5>
                    <p className="mt-1">{errorMsg}</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-red-200 flex gap-2">
                  <button
                    onClick={() => runAnalysis(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                  >
                    Usar Simulación de Respaldo
                  </button>
                  <button
                    onClick={() => runAnalysis(false)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold"
                  >
                    Reintentar Conexión Real
                  </button>
                </div>
              </div>
            )}

            {/* Verification Content */}
            {!loadingAnalysis && report && (
              <div className="space-y-6 flex-1">
                {/* Match Percentage circular widget */}
                <div className="bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 flex items-center justify-between shadow-[0_4px_24px_rgba(15,23,42,0.02)]">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800 tracking-tight uppercase">Dictamen General del Expediente</h4>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">Auditoría multi-fase y correlación de 5 documentos regulatorios</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-16 h-16 transform -rotate-90">
                        <circle cx="32" cy="32" r="28" className="stroke-current text-slate-200/60" strokeWidth="6" fill="transparent" />
                        <circle cx="32" cy="32" r="28" className={`stroke-current ${
                          report.matchPercentage === 100 
                            ? "text-emerald-500" 
                            : report.matchPercentage >= 70 
                            ? "text-amber-500" 
                            : "text-red-500"
                        }`} strokeWidth="6" fill="transparent" strokeDasharray={175.9} strokeDashoffset={175.9 - (175.9 * report.matchPercentage) / 100} />
                      </svg>
                      <span className="absolute text-sm font-extrabold text-slate-800">{report.matchPercentage}%</span>
                    </div>
                    <div>
                      <div className={`text-xs font-black tracking-wide ${
                        report.matchPercentage === 100 ? "text-emerald-600" : "text-amber-600"
                      }`}>
                        {report.matchPercentage === 100 ? "AUDITORÍA CONFORME" : "ALERTA DE DISCREPANCIA"}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold font-mono mt-0.5">
                        {report.matchPercentage === 100 ? "Cruce exitoso de lote/registro" : "Revisar alertas de amarre"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* FASE 1: Segmentación de Páginas */}
                {report.segmentation && report.segmentation.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-extrabold font-mono border border-blue-200">1</span>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fase 1: Segmentación de Páginas en PDF</h4>
                    </div>
                    <div className="bg-slate-50/50 rounded-xl border border-slate-200/40 p-3.5 grid grid-cols-2 md:grid-cols-5 gap-2.5">
                      {report.segmentation.map((seg, idx) => (
                        <div key={idx} className="bg-white/80 p-2.5 rounded-lg border border-slate-100 flex flex-col justify-between shadow-3xs">
                          <span className="text-[10px] font-extrabold text-slate-800 line-clamp-1">{seg.documentType}</span>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[9px] font-bold font-mono bg-blue-50 text-blue-600 border border-blue-100/60 px-1.5 py-0.5 rounded">
                              Pág. {seg.startPage}-{seg.endPage}
                            </span>
                            <span className="text-[8px] font-medium text-emerald-600 flex items-center gap-0.5 bg-emerald-50 border border-emerald-100/60 px-1 py-0.2 rounded">
                              {seg.confidence}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FASE 2: Fichas Técnicas por Documento (Isolated views) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-extrabold font-mono border border-indigo-200">2</span>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fase 2: Datos Extraídos por Tipo de Documento</h4>
                  </div>

                  {/* Tabs Selector */}
                  <div className="flex flex-wrap gap-1 bg-slate-100/85 p-1 rounded-xl text-[10px] font-bold border border-slate-200/40 animate-fade-in">
                    {[
                      { label: "Nota Entrada (RB)", isPresent: !!report.doc1 },
                      { label: "Remisión Comercial", isPresent: !!report.doc2 },
                      { label: "Orden IMSS", isPresent: !!report.doc3 },
                      { label: "Certificado CoA", isPresent: !!report.doc4 },
                      { label: "Registro COFEPRIS", isPresent: !!report.doc5 }
                    ].map((tab, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveDocTab(idx)}
                        className={`flex-1 py-2 px-2.5 rounded-lg transition-all text-center whitespace-nowrap cursor-pointer ${
                          activeDocTab === idx
                            ? "bg-white text-indigo-600 shadow-2xs border border-slate-200/20"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {tab.label}
                        {!tab.isPresent && <span className="ml-1 text-[8px] text-slate-400 font-normal italic">(vacío)</span>}
                      </button>
                    ))}
                  </div>

                  {/* Tab Panels */}
                  <div className="bg-white/60 rounded-2xl border border-white/60 p-4 min-h-[160px] shadow-3xs">
                    {activeDocTab === 0 && (
                      report.doc1 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="col-span-2 md:col-span-3 border-b border-dashed border-slate-100 pb-2 flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Recibo de Bienes (Nota de Entrada)</span>
                            <span className="text-[9px] font-mono text-slate-400">Folio: {report.doc1.numeroNota}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Recepción:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc1.fechaRecepcion}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Clave Fonsabi:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc1.codigoFonsabi}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Lote Recibido:</span>
                            <span className="font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{report.doc1.numeroLote}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Caducidad:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc1.fechaCaducidad}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cantidad Recibida:</span>
                            <span className="font-bold text-slate-800">{report.doc1.cantidadRecibida} piezas</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Remisión Comercial:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc1.numeroRemisionCapturado}</span>
                          </div>
                          <div className="col-span-2 md:col-span-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Descripción del Insumo:</span>
                            <span className="font-semibold text-slate-700">{report.doc1.descripcionArticulo}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs italic">Documento "Nota de Entrada" no fue encontrado en el PDF.</div>
                      )
                    )}

                    {activeDocTab === 1 && (
                      report.doc2 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="col-span-2 md:col-span-3 border-b border-dashed border-slate-100 pb-2 flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Remisión Comercial del Proveedor</span>
                            <span className="text-[9px] font-mono text-slate-400">Folio: {report.doc2.folioRemision}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Emisión:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc2.fechaEmision}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">RFC Proveedor:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc2.rfcProveedor}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Lote Comercial:</span>
                            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">{report.doc2.lote}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Caducidad:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc2.fechaCaducidad}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cantidad Facturada:</span>
                            <span className="font-bold text-slate-800">{report.doc2.cantidad} piezas</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Precio Unitario:</span>
                            <span className="font-bold text-emerald-700">${Number(report.doc2.costoUnidad).toFixed(2)}</span>
                          </div>
                          <div className="col-span-2 md:col-span-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Referencia de Registro Sanitario en Factura:</span>
                            <span className="font-semibold text-slate-700 italic">"{report.doc2.registroSanitarioTexto || "Ninguna"}"</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs italic">Documento "Remisión Comercial" no fue encontrado en el PDF.</div>
                      )
                    )}

                    {activeDocTab === 2 && (
                      report.doc3 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="col-span-2 md:col-span-3 border-b border-dashed border-slate-100 pb-2 flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Orden de Remisión IMSS-BIENESTAR</span>
                            <span className="text-[9px] font-mono text-slate-400">Folio: {report.doc3.folioOrden}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Expedición:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc3.fechaExpedicion}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Clave de Cuadro Básico:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc3.claveArticulo}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Lote Asignado:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc3.loteAsignado}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Caducidad:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc3.fechaCaducidad}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cantidad Solicitada:</span>
                            <span className="font-bold text-slate-800">{report.doc3.cantidadSolicitada} piezas</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cantidad Autorizada:</span>
                            <span className="font-bold text-slate-800">{report.doc3.cantidadAutorizada} piezas</span>
                          </div>
                          <div className="col-span-2 md:col-span-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Medicamento Solicitado:</span>
                            <span className="font-semibold text-slate-700">{report.doc3.descripcionArticulo}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs italic">Documento "Orden IMSS-BIENESTAR" no fue encontrado en el PDF.</div>
                      )
                    )}

                    {activeDocTab === 3 && (
                      report.doc4 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="col-span-2 md:col-span-3 border-b border-dashed border-slate-100 pb-2 flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Certificado de Análisis (CoA) de Control de Calidad</span>
                            <span className="text-[9px] font-mono text-slate-400">CoA: {report.doc4.numeroCertificado}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Laboratorio Fabricante:</span>
                            <span className="font-bold text-slate-800">{report.doc4.nombreFabricante}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Lote Analizado Físicamente:</span>
                            <span className="font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">{report.doc4.numeroLoteAnalizado}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Fabricación:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc4.fechaFabricacionElaboracion}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Caducidad:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc4.fechaCaducidad}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Forma Farmacéutica:</span>
                            <span className="font-bold text-slate-800">{report.doc4.formaFarmaceutica}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Dictamen Final:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded uppercase">{report.doc4.resultadoAnalisis}</span>
                          </div>
                          <div className="col-span-2 md:col-span-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            <span className="text-slate-400 block text-[10px]">Sustancia Analizada:</span>
                            <span className="font-semibold text-slate-700">{report.doc4.nombreProducto}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs italic">Documento "Certificado de Análisis (CoA)" no fue encontrado en el PDF.</div>
                      )
                    )}

                    {activeDocTab === 4 && (
                      report.doc5 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
                          <div className="col-span-2 md:col-span-3 border-b border-dashed border-slate-100 pb-2 flex justify-between items-center">
                            <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide">Registro Sanitario Oficial COFEPRIS</span>
                            <span className="text-[9px] font-mono text-slate-400">Reg: {report.doc5.numeroRegistroSanitario}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Titular de la Patente/Registro:</span>
                            <span className="font-bold text-slate-800">{report.doc5.titularRegistro}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Sustancia/Medicamento:</span>
                            <span className="font-bold text-slate-800">{report.doc5.nombreMedicamento}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Forma Farmacéutica Aprobada:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc5.formaFarmaceuticaAutorizada}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Fecha Vigencia:</span>
                            <span className="font-mono font-bold text-slate-800">{report.doc5.fechaVigencia}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Estado de Vigencia:</span>
                            <span className={`font-bold px-2 py-0.5 rounded uppercase ${
                              report.doc5.estatusVigencia.toLowerCase().includes("vigente")
                                ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                                : "text-red-700 bg-red-50 border border-red-100"
                            }`}>{report.doc5.estatusVigencia}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs italic">Documento "Registro Sanitario COFEPRIS" no fue encontrado en el PDF.</div>
                      )
                    )}
                  </div>
                </div>

                {/* AMARRE CRUZADO PROGRAMÁTICO */}
                {report.amarres && report.amarres.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold font-mono border border-emerald-200">3</span>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fase 3: Resultados de Amarre Cruzado (Garantía de Calidad)</h4>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {report.amarres.map((amarre) => (
                        <div
                          key={amarre.id}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col md:flex-row md:items-start justify-between gap-3.5 transition-all ${
                            amarre.isMatch
                              ? "bg-emerald-500/5 border-emerald-500/15"
                              : "bg-red-500/5 border-red-500/15"
                          }`}
                        >
                          <div className="space-y-1 md:max-w-xl">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-800">{amarre.label}</span>
                              <span className={`px-2 py-0.5 rounded-lg text-[8px] font-bold border uppercase tracking-wider ${
                                amarre.isMatch
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                  : "bg-red-500/10 text-red-700 border-red-500/20 font-black animate-pulse"
                              }`}>
                                {amarre.isMatch ? "Cumple (PASS)" : "Falla (ALERT)"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">{amarre.description}</p>
                            <p className="text-[11px] text-slate-600 font-medium pt-1 font-mono whitespace-pre-line">{amarre.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comparisons List (Top Level vs Sheets) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-extrabold font-mono border border-amber-200">4</span>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fase 4: Confrontación Física vs Base de Datos (Sistema)</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {Object.values(report.comparisons).map((comp: any) => (
                      <div 
                        key={comp.field}
                        className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between space-y-2 transition-all ${
                          comp.isMatch 
                            ? "bg-emerald-500/5 border-emerald-500/15" 
                            : "bg-red-500/5 border-red-500/15"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700">{comp.label}</span>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold border ${
                            comp.isMatch 
                              ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" 
                              : "bg-red-500/10 text-red-700 border-red-500/20"
                          }`}>
                            {comp.isMatch ? "Coincide" : "Discrepa"}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">En Sistema:</span>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100/80 px-1.5 py-0.5 rounded-md border border-slate-200/20">
                              {comp.field === "costoUnidad" ? `$${Number(comp.sheetValue).toFixed(2)}` : comp.sheetValue}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-400">En Documento:</span>
                            <span className={`font-mono font-bold px-1.5 py-0.5 rounded-md border ${
                              comp.isMatch 
                                ? "text-slate-800 bg-slate-100/80 border-slate-200/20" 
                                : "text-red-700 bg-red-500/10 border-red-500/20 font-extrabold"
                            }`}>
                              {comp.field === "costoUnidad" ? `$${Number(comp.pdfValue).toFixed(2)}` : comp.pdfValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IA Observations Box */}
                <div className="bg-blue-500/5 border border-blue-500/20 backdrop-blur-md rounded-2xl p-4 text-xs text-blue-900 shadow-2xs">
                  <div className="font-extrabold flex items-center gap-1.5 text-blue-800 uppercase tracking-wide text-[10px]">
                    <Sparkles size={14} className="text-blue-600" /> Observaciones y Notas de la IA
                  </div>
                  <p className="mt-2 leading-relaxed font-medium text-slate-600">
                    {report.observaciones}
                  </p>
                </div>

              </div>
            )}

            {/* Bottom Decision / Action Controls Inside Workspace */}
            {report && (
              <div className="pt-4 border-t border-slate-100">
                {entry.estatus === "Autorizado" ? (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100 text-xs text-green-800 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-green-900">
                      <UserCheck size={16} /> Registro Autorizado Exitosamente
                    </div>
                    <p>Esta entrada ya fue validada y guardada formalmente en Google Sheets.</p>
                    <div className="grid grid-cols-2 gap-4 mt-2 font-mono text-[10px]">
                      <div>
                        <span className="text-slate-400 block">Autorizado el:</span>
                        <span className="font-semibold">{entry.fechaAutorizacion || "Hoy"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Supervisor:</span>
                        <span className="font-semibold">{entry.usuarioAutorizacion || "Tú"}</span>
                      </div>
                    </div>
                  </div>
                ) : entry.estatus === "Rechazado" ? (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-100 text-xs text-red-800 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-red-900">
                      <X size={16} /> Entrada Rechazada por Discrepancia
                    </div>
                    <p>Se actualizó el estatus de la entrada a 'Rechazado' en la base de datos Google Sheets debido a inconsistencias de datos.</p>
                    {entry.notaRechazo && (
                      <div className="font-mono text-[10px] bg-white p-2 rounded-md border border-red-200 mt-2">
                        <span className="text-red-400 block font-bold">Motivo del Rechazo:</span>
                        <span className="text-slate-700 italic">"{entry.notaRechazo}"</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Active validation workflow actions */
                  <div className="space-y-4">
                    {isRejectMode ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-red-800">Generación de Nota de Devolución</label>
                          <button 
                            onClick={() => setIsRejectMode(false)}
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <textarea
                          placeholder="Describe con precisión la inconsistencia encontrada en el PDF para notificar al proveedor..."
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          className="w-full h-20 p-2 text-xs rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-red-500 text-slate-800 outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsRejectMode(false)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => openConfirmation("Rechazado")}
                            disabled={isUpdating}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                          >
                            Confirmar Rechazo y Firmar
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => setIsRejectMode(true)}
                          disabled={isUpdating}
                          className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 border border-red-200 hover:border-red-300 text-red-600 rounded-xl text-xs font-bold transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                        >
                          <X size={14} />
                          Rechazar por Discrepancia
                        </button>
                        <button
                          onClick={() => openConfirmation("Autorizado")}
                          disabled={isUpdating || report.matchPercentage < 50}
                          className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                        >
                          <FileCheck size={14} />
                          Autorizar Entrada Almacén
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Security Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${modalType === "Autorizado" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {modalType === "Autorizado" ? <ShieldCheck size={24} /> : <AlertCircle size={24} />}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-slate-800">
                      {modalType === "Autorizado" ? "Confirmar Autorización" : "Confirmar Rechazo"}
                    </h4>
                    <p className="text-xs text-slate-400">Cotejo de Almacén Médico FONSABI</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-2">
                  <p className="font-semibold text-slate-800">
                    Estás a punto de escribir en la Hoja de Control de Google Sheets:
                  </p>
                  <div className="font-mono text-[11px] space-y-1">
                    <div><span className="text-slate-400">Registro No:</span> {entry.no}</div>
                    <div><span className="text-slate-400">FONSABI Clave:</span> {entry.codigoFonsabi}</div>
                    <div><span className="text-slate-400">Articulo:</span> {entry.descripcion}</div>
                    <div>
                      <span className="text-slate-400">Estatus Nuevo:</span> 
                      <span className={`ml-1 font-bold ${modalType === "Autorizado" ? "text-green-600" : "text-red-600"}`}>
                        {modalType === "Autorizado" ? "AUTORIZADO" : "RECHAZADO"}
                      </span>
                    </div>
                    {modalType === "Rechazado" && rejectNote && (
                      <div className="bg-white p-2 rounded-lg border border-red-100 text-red-700 mt-2 text-[10px]">
                        <span className="font-bold block">Motivo de Rechazo:</span>
                        <span>"{rejectNote}"</span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  *Esta acción actualizará de forma definitiva el registro del sistema, registrando la fecha actual y tu firma digital de usuario.
                </p>
              </div>

              <div className="bg-slate-50 px-6 py-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleActionConfirm}
                  disabled={isUpdating}
                  className={`px-4 py-2 text-white rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    modalType === "Autorizado" 
                      ? "bg-green-600 hover:bg-green-700" 
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isUpdating ? "Firmando y Guardando..." : "Sí, Proceder con la Firma"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
