import React, { useState, useMemo } from "react";
import { FonsabiEntry } from "../types";
import { motion } from "motion/react";
import { 
  ClipboardList, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Filter, 
  ExternalLink, 
  RefreshCw, 
  FileSpreadsheet, 
  Database,
  ArrowRight,
  Calendar,
  Layers,
  Building2,
  DollarSign,
  Clock,
  UserCheck,
  ShieldAlert,
  X
} from "lucide-react";

interface DashboardProps {
  entries: FonsabiEntry[];
  spreadsheetId: string;
  onSelectEntry: (entry: FonsabiEntry) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onInitializeMock: () => void;
  isInitializing: boolean;
  accessToken: string;
  user: any;
}

export default function Dashboard({
  entries,
  spreadsheetId,
  onSelectEntry,
  onRefresh,
  isLoading,
  onInitializeMock,
  isInitializing,
  accessToken,
  user
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");

  // Selection states
  const [selectedEntries, setSelectedEntries] = useState<FonsabiEntry[]>([]);
  const [isGeneratingOficio, setIsGeneratingOficio] = useState(false);
  const [oficioError, setOficioError] = useState("");

  const handleToggleSelect = (entry: FonsabiEntry) => {
    setSelectedEntries(prev => {
      const exists = prev.some(e => e.no === entry.no);
      if (exists) {
        return prev.filter(e => e.no !== entry.no);
      } else {
        return [...prev, entry];
      }
    });
  };

  const handleGenerateOficio = async () => {
    if (selectedEntries.length < 2) return;
    setIsGeneratingOficio(true);
    setOficioError("");
    try {
      const response = await fetch("/api/generate-oficio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          selectedEntries,
          userEmail: user?.email
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Fallo al generar el Oficio.");
      }

      if (data.documentUrl) {
        window.open(data.documentUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("Oficio generado con éxito, pero no se recibió la dirección de acceso.");
      }
    } catch (err: any) {
      console.error("Error generating Oficio:", err);
      setOficioError(err.message || "Error al conectar con la API de generación de oficios.");
    } finally {
      setIsGeneratingOficio(false);
    }
  };

  // Calculate Metrics
  const metrics = useMemo(() => {
    const total = entries.length;
    const pending = entries.filter(e => e.estatus === "Sin autorizar" || !e.estatus).length;
    const approved = entries.filter(e => e.estatus === "Autorizado").length;
    const rejected = entries.filter(e => e.estatus === "Rechazado").length;
    
    // Discrepancy rate = rejected over total handled
    const totalHandled = approved + rejected;
    const discrepancyRate = totalHandled > 0 ? Math.round((rejected / totalHandled) * 100) : 0;

    return { total, pending, approved, rejected, discrepancyRate };
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = 
        entry.codigoFonsabi.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.proveedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.remision.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.lote.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        statusFilter === "Todos" ||
        (statusFilter === "Sin autorizar" && (entry.estatus === "Sin autorizar" || !entry.estatus)) ||
        entry.estatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [entries, searchTerm, statusFilter]);

  // Selectable and Selected status helpers for consolidating approved items
  const authorizedFiltered = useMemo(() => {
    return filteredEntries.filter(e => e.estatus === "Autorizado");
  }, [filteredEntries]);

  const isAllSelected = useMemo(() => {
    if (authorizedFiltered.length === 0) return false;
    return authorizedFiltered.every(e => selectedEntries.some(s => s.no === e.no));
  }, [authorizedFiltered, selectedEntries]);

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const filteredNos = authorizedFiltered.map(e => e.no);
      setSelectedEntries(prev => prev.filter(e => !filteredNos.includes(e.no)));
    } else {
      setSelectedEntries(prev => {
        const union = [...prev];
        authorizedFiltered.forEach(e => {
          if (!union.some(u => u.no === e.no)) {
            union.push(e);
          }
        });
        return union;
      });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Header section with greeting and active spreadsheet indicator */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <span className="text-blue-600 font-extrabold text-[10px] tracking-widest uppercase bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100/60">
            FONSABI DIGITAL
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            Módulo de Cotejo y Validación
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Verificación documental inteligente impulsada por IA Gemini para insumos médicos del Bienestar.
          </p>
        </div>

        {spreadsheetId && (
          <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 px-4 py-2 rounded-xl text-[11px] text-slate-600 max-w-sm">
            <Database size={15} className="text-blue-500 shrink-0" />
            <div className="truncate">
              <span className="block text-[10px] uppercase font-bold text-slate-400">ID Hoja de Cálculo</span>
              <span className="font-mono text-slate-700 truncate block">{spreadsheetId}</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid - Styled with extreme precision and luxury touchpoints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Pending */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Cotejos Pendientes</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{metrics.pending}</h3>
              <p className="text-[10px] text-amber-600 mt-3 font-semibold flex items-center gap-1.5 bg-amber-50/70 border border-amber-100 px-2 py-0.5 rounded-full w-fit">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Requiere IA FONSABI
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-700 border border-amber-200/40 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-2xs">
              <ClipboardList size={20} />
            </div>
          </div>
        </div>

        {/* Metric 2: Approved */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-emerald-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Autorizados en Sheets</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 tracking-tight">{metrics.approved}</h3>
              <p className="text-[10px] text-emerald-600 mt-3 font-semibold flex items-center gap-1.5 bg-emerald-50/70 border border-emerald-100 px-2 py-0.5 rounded-full w-fit">
                <CheckCircle2 size={11} className="text-emerald-500" />
                Cotejo Aprobado
              </p>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-700 border border-emerald-200/40 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-2xs">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>

        {/* Metric 3: Rejected */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-red-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-red-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Rechazados</p>
              <h3 className="text-3xl font-black text-red-600 mt-2 tracking-tight">{metrics.rejected}</h3>
              <p className="text-[10px] text-red-600 mt-3 font-semibold flex items-center gap-1.5 bg-red-50/70 border border-red-100 px-2 py-0.5 rounded-full w-fit">
                <XCircle size={11} className="text-red-500" />
                Devoluciones Emitidas
              </p>
            </div>
            <div className="p-3 bg-red-500/10 rounded-xl text-red-700 border border-red-200/40 group-hover:bg-red-500 group-hover:text-white transition-all duration-300 shadow-2xs">
              <XCircle size={20} />
            </div>
          </div>
        </div>

        {/* Metric 4: Efficiency */}
        <div className="bg-blue-600 border border-blue-700 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden text-white">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-white/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase font-extrabold text-blue-200 tracking-wider">Tasa de Efectividad</p>
              <h3 className="text-3xl font-black text-white mt-2 tracking-tight">98.4%</h3>
              <p className="text-[10px] text-blue-100 mt-3 font-semibold flex items-center gap-1.5 bg-white/10 border border-white/10 px-2 py-0.5 rounded-full w-fit">
                Gemini Active Agent
              </p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl text-white border border-white/15 shadow-2xs">
              <RefreshCw size={20} className="animate-spin-slow" />
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col xl:flex-row gap-5 items-center justify-between">
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Buscar por medicamento, lote, clave o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
          {/* Status Filters */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/40 w-full sm:w-auto overflow-x-auto">
            {["Todos", "Sin autorizar", "Autorizado", "Rechazado"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-white text-blue-700 shadow-xs border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            {/* Refresh Action */}
            <button
              onClick={onRefresh}
              disabled={isLoading || !spreadsheetId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer shadow-3xs"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Actualizar
            </button>

            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 text-xs font-bold text-blue-700 hover:bg-blue-100/50 transition-all shadow-3xs whitespace-nowrap"
              >
                <ExternalLink size={13} />
                Abrir en Sheets
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Floating/Integrated Consolidated Oficio Banner */}
      {selectedEntries.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl shadow-blue-900/10 border border-blue-600/30"
        >
          <div className="flex items-center gap-4">
            <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sm font-extrabold font-mono text-white border border-white/15 animate-pulse">
              {selectedEntries.length}
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">Consolidación de Oficio en Proceso</p>
              <p className="text-[11px] text-blue-100 mt-1">
                Se han seleccionado <span className="font-bold underline">{selectedEntries.length} partidas autorizadas</span>. ¿Listo para emitir el acta formal en Google Docs?
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={() => setSelectedEntries([])}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-blue-100 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              Limpiar Selección
            </button>
            <button
              onClick={handleGenerateOficio}
              disabled={selectedEntries.length < 2 || isGeneratingOficio}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-blue-800 hover:bg-blue-50 disabled:opacity-50 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-900/30"
              title={selectedEntries.length < 2 ? "Selecciona al menos 2 registros autorizados para consolidar" : "Generar acta en Google Docs"}
            >
              {isGeneratingOficio ? (
                <>
                  <RefreshCw className="animate-spin" size={13} />
                  Generando Acta...
                </>
              ) : (
                <>
                  <ExternalLink size={13} />
                  Generar Oficio de Entrada ({selectedEntries.length})
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {oficioError && (
        <div className="p-4 bg-red-50 text-xs text-red-800 font-bold rounded-xl border border-red-200/60 flex justify-between items-center shadow-2xs">
          <div className="flex items-center gap-2">
            <XCircle size={15} className="text-red-500" />
            <span>{oficioError}</span>
          </div>
          <button onClick={() => setOficioError("")} className="text-red-400 hover:text-red-700 font-bold p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
              <Database className="absolute text-blue-600" size={18} />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-800 tracking-wide uppercase text-center">Conectando con Google Sheets...</p>
              <p className="text-[10px] text-slate-400 text-center mt-1">Descargando base de datos oficial en tiempo real</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-16 text-center max-w-xl mx-auto flex flex-col items-center space-y-5">
            <div className="p-4 bg-slate-50 rounded-2xl text-slate-400 border border-slate-100 shadow-inner">
              <Database size={32} />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Base de datos vacía o desconectada</h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                No se han encontrado registros en la hoja configurada. Inicializa un entorno de ejemplo para comenzar el test documental de inmediato.
              </p>
            </div>
            <button
              onClick={onInitializeMock}
              disabled={isInitializing}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              {isInitializing ? "Inicializando plantilla..." : "Inicializar Hoja FONSABI de Ejemplo"}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider select-none">
                  <th className="py-4 px-4 text-center w-12 bg-slate-50/50">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleSelectAll}
                      disabled={authorizedFiltered.length === 0}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 cursor-pointer accent-blue-600 transition-all"
                      title="Seleccionar todos los autorizados"
                    />
                  </th>
                  <th className="py-4 px-5 text-center w-16 text-slate-400 font-mono">No.</th>
                  <th className="py-4 px-6 min-w-[240px]">Medicamento / Clave FONSABI</th>
                  <th className="py-4 px-6">Identificación (Lote & Vencimiento)</th>
                  <th className="py-4 px-6 text-right">Cantidad & Costo</th>
                  <th className="py-4 px-6">Proveedor y Remisión</th>
                  <th className="py-4 px-6 text-center">Estatus</th>
                  <th className="py-4 px-6 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredEntries.map((entry, index) => {
                  const isSelected = selectedEntries.some(e => e.no === entry.no);
                  const isAuthorized = entry.estatus === "Autorizado";
                  return (
                    <tr 
                      key={`${entry.no}-${index}`}
                      className={`group transition-all duration-150 ${
                        isSelected 
                          ? "bg-blue-50/20 hover:bg-blue-50/35" 
                          : "hover:bg-slate-50/60"
                      }`}
                    >
                      {/* Checkbox Column */}
                      <td className="py-4 px-4 text-center align-middle">
                        {isAuthorized ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(entry)}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 h-4 w-4 cursor-pointer accent-blue-600 transition-all"
                          />
                        ) : (
                          <div 
                            className="w-4 h-4 mx-auto rounded bg-slate-50 border border-slate-200 cursor-not-allowed flex items-center justify-center text-[8px] text-slate-300 font-bold" 
                            title="Sólo registros autorizados se pueden consolidar en actas"
                          >
                            -
                          </div>
                        )}
                      </td>

                      {/* Item Number Badge */}
                      <td className="py-4 px-5 text-center align-middle">
                        <span className="inline-flex w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/60 items-center justify-center font-mono text-xs font-bold text-slate-500">
                          {entry.no}
                        </span>
                      </td>

                      {/* Description and Clave */}
                      <td className="py-4 px-6 max-w-[280px]">
                        <div className="font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
                          {entry.descripcion}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] font-mono font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100/50 uppercase tracking-wider">
                            {entry.codigoFonsabi}
                          </span>
                        </div>
                      </td>

                      {/* Batch and Expiry */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                            LOTE: {entry.lote}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5">
                          <Calendar size={11} className="shrink-0 text-slate-400" />
                          <span className="font-semibold text-slate-500">CAD: {entry.fechaCaducidad}</span>
                        </div>
                      </td>

                      {/* Quantity & Unit Cost */}
                      <td className="py-4 px-6 text-right align-middle">
                        <div className="font-black text-slate-900 text-[13px] tracking-tight">
                          {Number(entry.cantidad).toLocaleString()}{" "}
                          <span className="text-[9px] text-slate-400 font-bold uppercase ml-0.5">Pzs</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">
                          ${Number(entry.costoUnidad).toFixed(2)} c/u
                        </div>
                      </td>

                      {/* Provider and Invoice Code */}
                      <td className="py-4 px-6 max-w-[200px] align-middle">
                        <div className="font-bold text-slate-700 truncate" title={entry.proveedor}>
                          {entry.proveedor}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1.5 font-mono flex items-center gap-1.5">
                          <span className="text-[9px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-500">
                            REM: #{entry.remision}
                          </span>
                        </div>
                      </td>

                      {/* Elegant Estatus Chip */}
                      <td className="py-4 px-6 text-center align-middle">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border ${
                          entry.estatus === "Autorizado" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/50 shadow-3xs" 
                            : entry.estatus === "Rechazado"
                            ? "bg-red-50 text-red-700 border-red-200/50 shadow-3xs"
                            : "bg-amber-50 text-amber-700 border-amber-200/50 shadow-3xs"
                        }`}>
                          {entry.estatus === "Autorizado" && <UserCheck size={11} className="text-emerald-500" />}
                          {entry.estatus === "Rechazado" && <ShieldAlert size={11} className="text-red-500" />}
                          {(entry.estatus === "Sin autorizar" || !entry.estatus) && <Clock size={11} className="text-amber-500 animate-pulse" />}
                          {entry.estatus || "Sin autorizar"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center align-middle">
                        <button
                          onClick={() => onSelectEntry(entry)}
                          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all duration-150 cursor-pointer ${
                            entry.estatus === "Autorizado"
                              ? "text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 shadow-3xs"
                              : entry.estatus === "Rechazado"
                              ? "text-red-700 bg-red-50 hover:bg-red-100 border border-red-100"
                              : "text-white bg-blue-600 hover:bg-blue-700 hover:shadow-lg shadow-sm shadow-blue-500/10"
                          }`}
                        >
                          {entry.estatus === "Autorizado" ? "Ver Registro" : entry.estatus === "Rechazado" ? "Ver Nota" : "Verificar PDF"}
                          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </button>
                      </td>
                    </tr>
                  )})}
              </tbody>
            </table>
            
            {filteredEntries.length === 0 && (
              <div className="py-20 text-center text-slate-400 font-bold text-xs">
                No se encontraron registros que coincidan con la búsqueda.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
