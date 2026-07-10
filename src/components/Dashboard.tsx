import React, { useState, useMemo } from "react";
import { FonsabiEntry } from "../types";
import { motion, AnimatePresence } from "motion/react";
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
  Building2,
  DollarSign,
  Clock,
  UserCheck,
  ShieldAlert,
  X,
  ShieldCheck,
  FileText,
  SlidersHorizontal,
  Activity,
  Check
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
    
    const totalHandled = approved + rejected;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, pending, approved, rejected, approvalRate };
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
      
      {/* Top Governmental Institutional Accent & Watermark */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-800/20">
        <div className="absolute right-0 top-0 h-64 w-64 bg-radial-gradient from-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute left-1/4 bottom-0 h-48 w-48 bg-radial-gradient from-amber-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        {/* Fine Decorative Grid Line */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:24px_24px] opacity-10" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 z-10">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-md tracking-widest uppercase">
                IMSS-BIENESTAR
              </span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-0.5 rounded-md tracking-widest uppercase">
                COTEJO SANITARIO FEDERAL
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight font-sans">
              Sistema de Validación FONSABI
            </h1>
            
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Módulo oficial de verificación documental inteligente asistido por IA para insumos médicos del bienestar.
              Verifique actas, remisiones comerciales, órdenes de entrega y certificados de análisis con rigor gubernamental.
            </p>
          </div>

          {spreadsheetId && (
            <div className="shrink-0 bg-white/5 backdrop-blur-md border border-white/10 px-4 py-3.5 rounded-2xl text-[11px] text-slate-300 max-w-sm shadow-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 shrink-0 border border-emerald-500/20 mt-0.5">
                  <Database size={14} />
                </div>
                <div className="space-y-1 truncate">
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400">Repositorio del Sistema (Sheets)</span>
                  <span className="font-mono text-white truncate block max-w-[200px]">{spreadsheetId}</span>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Sincronización Federal Activa
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics Section: Precision-crafted Glassmorphic Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1: Pending */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/50 p-5 shadow-lg shadow-slate-100/40 hover:shadow-xl hover:border-slate-300 transition-all duration-300">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pendientes de Cotejar</p>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">{metrics.pending}</h3>
              <div className="inline-flex items-center gap-1.5 text-[9px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Requiere validación IA
              </div>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-700 border border-amber-200/30 group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
              <ClipboardList size={18} />
            </div>
          </div>
        </div>

        {/* Metric 2: Approved */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/50 p-5 shadow-lg shadow-slate-100/40 hover:shadow-xl hover:border-slate-300 transition-all duration-300">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Autorizados</p>
              <h3 className="text-3xl font-extrabold text-emerald-800 tracking-tight">{metrics.approved}</h3>
              <div className="inline-flex items-center gap-1.5 text-[9px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                <CheckCircle2 size={10} className="text-emerald-600" />
                Ingresos Aprobados
              </div>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-700 border border-emerald-200/30 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
              <CheckCircle2 size={18} />
            </div>
          </div>
        </div>

        {/* Metric 3: Rejected */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/70 backdrop-blur-md border border-slate-200/50 p-5 shadow-lg shadow-slate-100/40 hover:shadow-xl hover:border-slate-300 transition-all duration-300">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-rose-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Rechazados</p>
              <h3 className="text-3xl font-extrabold text-rose-800 tracking-tight">{metrics.rejected}</h3>
              <div className="inline-flex items-center gap-1.5 text-[9px] text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/50">
                <XCircle size={10} className="text-rose-600" />
                Desviaciones Detectadas
              </div>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-700 border border-rose-200/30 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300">
              <XCircle size={18} />
            </div>
          </div>
        </div>

        {/* Metric 4: Tasa de Autorización */}
        <div className="relative group overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 shadow-lg shadow-slate-950/20 text-white">
          <div className="absolute right-0 top-0 h-24 w-24 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tasa de Aprobación</p>
              <h3 className="text-3xl font-extrabold text-white tracking-tight">{metrics.approvalRate}%</h3>
              <div className="inline-flex items-center gap-1.5 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                <Activity size={10} className="text-amber-500" />
                Rendimiento de Insumos
              </div>
            </div>
            <div className="p-3 bg-white/5 rounded-xl text-amber-400 border border-white/10">
              <Clock size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel: Advanced Search & Filtering - Elegant Glass Banner */}
      <div className="bg-white/75 backdrop-blur-md border border-slate-200/60 rounded-2xl p-5 shadow-lg shadow-slate-100/50 flex flex-col xl:flex-row gap-5 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full xl:w-96">
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
          <input
            type="text"
            placeholder="Buscar por medicamento, lote, clave o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-700 text-xs transition-all placeholder:text-slate-400 text-slate-800 shadow-2xs font-medium"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
          
          {/* Status Pills */}
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/40 w-full sm:w-auto overflow-x-auto">
            {["Todos", "Sin autorizar", "Autorizado", "Rechazado"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-white text-emerald-800 shadow-xs border border-slate-200/50 font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={isLoading || !spreadsheetId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Actualizar
            </button>

            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs font-bold text-emerald-800 hover:bg-emerald-100/60 transition-all shadow-2xs whitespace-nowrap active:scale-95"
              >
                <ExternalLink size={13} />
                Abrir en Sheets
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Floating Consolidated Oficio Banner (Glassmorphic Gold/Teal) */}
      <AnimatePresence>
        {selectedEntries.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl border border-emerald-700/30"
          >
            <div className="flex items-center gap-4">
              <span className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-black font-mono border border-amber-500/30 shadow-lg shadow-amber-500/10">
                {selectedEntries.length}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-bold tracking-wide uppercase text-amber-500">Consolidación de Acta Oficial</p>
                <p className="text-[11px] text-slate-300">
                  Se han seleccionado <span className="font-bold text-emerald-400">{selectedEntries.length} partidas autorizadas</span>. ¿Desea emitir el Acta de Entrada formal en Google Docs?
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={() => setSelectedEntries([])}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10"
              >
                Cancelar Selección
              </button>
              <button
                onClick={handleGenerateOficio}
                disabled={selectedEntries.length < 2 || isGeneratingOficio}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 hover:text-black text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/25 active:scale-95"
                title={selectedEntries.length < 2 ? "Seleccione al menos 2 registros autorizados para consolidar" : "Generar acta en Google Docs"}
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
      </AnimatePresence>

      {oficioError && (
        <div className="p-4 bg-rose-50 text-xs text-rose-800 font-bold rounded-xl border border-rose-200/60 flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2">
            <XCircle size={15} className="text-rose-500" />
            <span>{oficioError}</span>
          </div>
          <button onClick={() => setOficioError("")} className="text-rose-400 hover:text-rose-700 font-bold p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Main Container Card (Glassmorphic Content Host) */}
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-xl overflow-hidden">
        
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-emerald-700 animate-spin" />
              <Database className="absolute text-emerald-700" size={16} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-bold text-slate-800 tracking-widest uppercase">Conectando con Registro Central...</p>
              <p className="text-[10px] text-slate-400 font-medium">Extrayendo datos de la Dirección General en tiempo real</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-16 text-center max-w-xl mx-auto flex flex-col items-center space-y-6">
            <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-800 border border-emerald-500/20 shadow-inner">
              <Database size={32} />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-extrabold text-slate-950">Sin Datos en Repositorio de Control</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                No se han encontrado registros de insumos médicos en la hoja configurada. Inicialice una base de datos muestra para validar el cotejo inteligente.
              </p>
            </div>
            <button
              onClick={onInitializeMock}
              disabled={isInitializing}
              className="px-5 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-800/10 flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <FileSpreadsheet size={15} />
              {isInitializing ? "Inicializando plantilla..." : "Inicializar Hoja FONSABI de Ejemplo"}
            </button>
          </div>
        ) : (
          <div>
            
            {/* DESKTOP TABLE VIEW: Pristine, clean, ultra-professional */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    <th className="py-4 px-4 text-center w-12 bg-slate-50/40">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        disabled={authorizedFiltered.length === 0}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/20 h-4 w-4 cursor-pointer accent-emerald-700 transition-all"
                        title="Seleccionar todos los autorizados"
                      />
                    </th>
                    <th className="py-4 px-5 text-center w-16 text-slate-400 font-mono">No.</th>
                    <th className="py-4 px-6 min-w-[280px]">Medicamento / Clave FONSABI</th>
                    <th className="py-4 px-6">Identificación (Lote y Caducidad)</th>
                    <th className="py-4 px-6 text-right">Cantidad y Costo</th>
                    <th className="py-4 px-6">Proveedor y Remisión</th>
                    <th className="py-4 px-6 text-center">Estatus</th>
                    <th className="py-4 px-6 text-center">Acción de Cotejo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 text-xs">
                  {filteredEntries.map((entry, index) => {
                    const isSelected = selectedEntries.some(e => e.no === entry.no);
                    const isAuthorized = entry.estatus === "Autorizado";
                    const isRejected = entry.estatus === "Rechazado";
                    
                    return (
                      <tr 
                        key={`${entry.no}-${index}`}
                        className={`group transition-all duration-150 ${
                          isSelected 
                            ? "bg-emerald-50/10 hover:bg-emerald-50/20" 
                            : "hover:bg-slate-50/40"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center align-middle">
                          {isAuthorized ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(entry)}
                              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/20 h-4 w-4 cursor-pointer accent-emerald-700 transition-all"
                            />
                          ) : (
                            <div 
                              className="w-4 h-4 mx-auto rounded bg-slate-100 border border-slate-200/60 cursor-not-allowed flex items-center justify-center text-[8px] text-slate-300 font-black" 
                              title="Únicamente registros autorizados se pueden consolidar en oficios"
                            >
                              -
                            </div>
                          )}
                        </td>

                        {/* Order Item # */}
                        <td className="py-4 px-5 text-center align-middle">
                          <span className="inline-flex w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/80 items-center justify-center font-mono text-xs font-bold text-slate-500 group-hover:bg-slate-100">
                            {entry.no}
                          </span>
                        </td>

                        {/* Desc & Key */}
                        <td className="py-4 px-6 max-w-[320px] align-middle">
                          <div className="font-semibold text-slate-900 leading-snug group-hover:text-emerald-800 transition-colors line-clamp-2">
                            {entry.descripcion}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[9px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                              CLAVE: {entry.codigoFonsabi}
                            </span>
                          </div>
                        </td>

                        {/* Batch & CAD */}
                        <td className="py-4 px-6 align-middle">
                          <div className="flex items-center">
                            <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                              LOTE: {entry.lote}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5">
                            <Calendar size={11} className="shrink-0 text-slate-400" />
                            <span className="font-semibold text-slate-500">CAD: {entry.fechaCaducidad}</span>
                          </div>
                        </td>

                        {/* Cost & Qty */}
                        <td className="py-4 px-6 text-right align-middle">
                          <div className="font-extrabold text-slate-950 text-sm tracking-tight">
                            {Number(entry.cantidad).toLocaleString()}{" "}
                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-0.5">Pzs</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1 font-medium">
                            ${Number(entry.costoUnidad).toFixed(2)} c/u
                          </div>
                        </td>

                        {/* Proveedor y Remisión */}
                        <td className="py-4 px-6 max-w-[220px] align-middle">
                          <div className="font-semibold text-slate-800 truncate" title={entry.proveedor}>
                            {entry.proveedor}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                            <span className="text-[9px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 font-medium">
                              REM: #{entry.remision}
                            </span>
                          </div>
                        </td>

                        {/* Clear Status badge with icon */}
                        <td className="py-4 px-6 text-center align-middle">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border shadow-2xs ${
                            isAuthorized 
                              ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30" 
                              : isRejected
                              ? "bg-rose-500/10 text-rose-800 border-rose-500/30"
                              : "bg-amber-500/10 text-amber-800 border-amber-500/30"
                          }`}>
                            {isAuthorized && <Check size={11} className="text-emerald-700 stroke-[3]" />}
                            {isRejected && <ShieldAlert size={11} className="text-rose-700" />}
                            {(!entry.estatus || entry.estatus === "Sin autorizar") && (
                              <Clock size={11} className="text-amber-700 animate-spin-slow" />
                            )}
                            {entry.estatus || "Sin autorizar"}
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-4 px-6 text-center align-middle">
                          <button
                            onClick={() => onSelectEntry(entry)}
                            className={`inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl transition-all duration-150 cursor-pointer ${
                              isAuthorized
                                ? "text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs"
                                : isRejected
                                ? "text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                                : "text-white bg-slate-900 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/10"
                            }`}
                          >
                            {isAuthorized ? "Ver Registro" : isRejected ? "Ver Nota" : "Verificar PDF"}
                            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE LIST VIEW: Breathtakingly beautiful responsive bento card stack */}
            <div className="md:hidden block p-4 space-y-4">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 flex justify-between items-center">
                <span>Partidas ({filteredEntries.length})</span>
                <span className="text-slate-500">Filtrado activo</span>
              </div>
              
              {filteredEntries.map((entry, index) => {
                const isSelected = selectedEntries.some(e => e.no === entry.no);
                const isAuthorized = entry.estatus === "Autorizado";
                const isRejected = entry.estatus === "Rechazado";

                return (
                  <div 
                    key={`mob-${entry.no}-${index}`}
                    className={`p-5 rounded-2xl border transition-all duration-200 space-y-4 ${
                      isSelected 
                        ? "bg-emerald-500/[0.04] border-emerald-500/40 shadow-md shadow-emerald-500/5" 
                        : "bg-white border-slate-200/70 hover:border-slate-300 shadow-xs"
                    }`}
                  >
                    {/* Header: Select, #, Status */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {isAuthorized ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(entry)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/20 h-4 w-4 cursor-pointer accent-emerald-700"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded bg-slate-100 border border-slate-200/50 flex items-center justify-center text-[8px] text-slate-400 font-bold">
                            -
                          </div>
                        )}
                        <span className="inline-flex w-6 h-6 rounded-lg bg-slate-50 border border-slate-200/60 items-center justify-center font-mono text-[11px] font-black text-slate-500">
                          {entry.no}
                        </span>
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wide border shadow-3xs ${
                        isAuthorized 
                          ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/30" 
                          : isRejected
                          ? "bg-rose-500/10 text-rose-800 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-800 border-amber-500/30"
                      }`}>
                        {isAuthorized && <Check size={9} className="text-emerald-700 stroke-[3]" />}
                        {isRejected && <ShieldAlert size={9} className="text-rose-700" />}
                        {(!entry.estatus || entry.estatus === "Sin autorizar") && (
                          <Clock size={9} className="text-amber-700 animate-spin-slow" />
                        )}
                        {entry.estatus || "Sin autorizar"}
                      </span>
                    </div>

                    {/* Drug Desc & Code */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">
                        {entry.descripcion}
                      </h4>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                        CLAVE: {entry.codigoFonsabi}
                      </p>
                    </div>

                    {/* Meta info block */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-[11px]">
                      
                      {/* Qty & Price */}
                      <div className="space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Cantidad</span>
                        <p className="font-extrabold text-slate-950 font-mono">
                          {Number(entry.cantidad).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold">Pzs</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">${Number(entry.costoUnidad).toFixed(2)} c/u</p>
                      </div>

                      {/* Batch & CAD */}
                      <div className="space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Identificación</span>
                        <p className="font-bold text-slate-700 font-mono text-[10px]">LOTE: {entry.lote}</p>
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar size={10} />
                          {entry.fechaCaducidad}
                        </p>
                      </div>

                      {/* Provider */}
                      <div className="col-span-2 space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Proveedor y Referencia</span>
                        <p className="font-bold text-slate-700 truncate">{entry.proveedor}</p>
                        <p className="text-[9px] text-slate-500 font-mono">Remisión: #{entry.remision}</p>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectEntry(entry)}
                        className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                          isAuthorized
                            ? "text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80"
                            : isRejected
                            ? "text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                            : "text-white bg-slate-950 hover:bg-slate-900 shadow-md shadow-slate-950/10"
                        }`}
                      >
                        {isAuthorized ? "Ver Registro Completo" : isRejected ? "Ver Nota de Rechazo" : "Iniciar Cotejo con IA"}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Zero state inside filters */}
            {filteredEntries.length === 0 && (
              <div className="py-20 text-center text-slate-400 font-bold text-xs">
                No se encontraron registros que coincidan con los filtros seleccionados.
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
