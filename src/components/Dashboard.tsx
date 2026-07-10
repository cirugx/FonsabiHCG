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
  Check,
  ChevronRight,
  TrendingUp,
  Percent,
  Layers,
  Inbox,
  Sparkles
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

  // Selection states for consolidated Oficio
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
        alert("Oficio de Entrada generado con éxito, pero no se recibió la dirección de acceso en Google Docs.");
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
    <div className="space-y-8 max-w-7xl mx-auto px-1 sm:px-0 pb-16">
      
      {/* 🏛️ Top Governmental Institutional Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0c1b15] via-[#102a1f] to-[#0d1d17] text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-emerald-900/35">
        <div className="absolute right-0 top-0 h-64 w-64 bg-radial-gradient from-emerald-500/15 to-transparent rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
        <div className="absolute left-1/4 bottom-0 h-48 w-48 bg-radial-gradient from-amber-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle Ornamental Grid Line overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:32px_32px] opacity-25" />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 z-10">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black tracking-widest text-[#d4af37] bg-amber-500/10 border border-[#d4af37]/35 px-3 py-1 rounded-md uppercase">
                GOBIERNO DE MÉXICO
              </span>
              <span className="text-[10px] font-black tracking-widest text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-md uppercase">
                IMSS-BIENESTAR • FONSABI
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3.5xl font-extrabold tracking-tight text-white leading-tight font-sans">
              Sistema Federal de Cotejo Documental
            </h1>
            
            <p className="text-xs sm:text-[13px] text-slate-300 max-w-3xl leading-relaxed">
              Consola institucional de verificación de remisiones e insumos médicos con inteligencia asistida. 
              Garantice la trazabilidad de los medicamentos autorizados por FONSABI, verifique certificados de lote y genere actas oficiales integradas con Google Docs de forma ágil y auditable.
            </p>
          </div>

          {spreadsheetId && (
            <div className="shrink-0 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl text-[11px] text-slate-200 max-w-sm shadow-xl hover:bg-white/15 transition-all duration-300">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-300 shrink-0 border border-emerald-400/20 mt-0.5 shadow-inner">
                  <Database size={16} />
                </div>
                <div className="space-y-1.5 truncate">
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-emerald-400">Canal de Sincronización Federal</span>
                  <span className="font-mono text-white text-xs truncate block max-w-[220px] bg-black/25 px-2 py-1 rounded border border-white/5">{spreadsheetId}</span>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-emerald-400 font-extrabold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Auditoría Activa del Repositorio
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 📊 Premium Glassmorphism Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric Box: Pendientes de Cotejar */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 shadow-xl hover:shadow-2xl hover:border-white/30 hover:bg-white/15 transition-all duration-300">
          {/* Subtle colored glow background */}
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Insumos Pendientes</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight font-sans">{metrics.pending}</h3>
                <span className="text-xs text-slate-500 font-medium">partidas</span>
              </div>
              
              <div className="inline-flex items-center gap-2 text-[10px] text-amber-800 font-bold bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                Requiere validación IA
              </div>
            </div>
            
            <div className="p-3.5 bg-amber-500/15 rounded-2xl text-amber-700 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 shadow-sm">
              <Clock size={20} className="animate-spin-slow" />
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-200/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>En espera de cotejo con PDF</span>
            <span className="font-bold font-mono text-slate-700">{Math.round((metrics.pending / (metrics.total || 1)) * 100)}% del total</span>
          </div>
        </div>

        {/* Metric Box: Aprobados */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 shadow-xl hover:shadow-2xl hover:border-white/30 hover:bg-white/15 transition-all duration-300">
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Autorizados Federales</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-extrabold text-emerald-800 tracking-tight font-sans">{metrics.approved}</h3>
                <span className="text-xs text-slate-500 font-medium">partidas</span>
              </div>
              
              <div className="inline-flex items-center gap-1.5 text-[10px] text-emerald-800 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                <CheckCircle2 size={12} className="text-emerald-600" />
                Validación Correcta
              </div>
            </div>
            
            <div className="p-3.5 bg-emerald-500/15 rounded-2xl text-emerald-700 border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tasa de aprobación del inventario</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <TrendingUp size={12} />
              {metrics.approvalRate}%
            </span>
          </div>
        </div>

        {/* Metric Box: Rechazados */}
        <div className="relative group overflow-hidden rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-6 shadow-xl hover:shadow-2xl hover:border-white/30 hover:bg-white/15 transition-all duration-300">
          <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-bl-full pointer-events-none" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">Desviaciones Detectadas</span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl font-extrabold text-rose-800 tracking-tight font-sans">{metrics.rejected}</h3>
                <span className="text-xs text-slate-500 font-medium">partidas</span>
              </div>
              
              <div className="inline-flex items-center gap-1.5 text-[10px] text-rose-800 font-bold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                <ShieldAlert size={12} className="text-rose-600" />
                Cotejo no aprobado
              </div>
            </div>
            
            <div className="p-3.5 bg-rose-500/15 rounded-2xl text-rose-700 border border-rose-500/20 group-hover:bg-rose-600 group-hover:text-white transition-all duration-300 shadow-sm">
              <XCircle size={20} />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/50 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Inconsistencias críticas</span>
            <span className="font-bold text-rose-700 font-mono">{Math.round((metrics.rejected / (metrics.total || 1)) * 100)}% de rechazo</span>
          </div>
        </div>

      </div>

      {/* 🔍 Control Center: Search, Filters & Quick Actions */}
      <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-5 shadow-xl flex flex-col xl:flex-row gap-5 items-center justify-between">
        
        {/* Modern Search bar */}
        <div className="relative w-full xl:w-[420px]">
          <Search className="absolute left-3.5 top-3.5 text-slate-400" size={15} />
          <input
            type="text"
            placeholder="Buscar medicamento, lote, clave o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-4 py-3 w-full rounded-xl border border-slate-200 bg-white/75 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-700 text-xs transition-all placeholder:text-slate-400 text-slate-800 shadow-sm font-medium"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")} 
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-700"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
          
          {/* Status Selection Filters styled with luxury glass */}
          <div className="flex bg-slate-900/10 p-1 rounded-xl border border-white/20 w-full sm:w-auto overflow-x-auto">
            {["Todos", "Sin autorizar", "Autorizado", "Rechazado"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[11px] font-black tracking-wide uppercase transition-all duration-150 cursor-pointer whitespace-nowrap ${
                  statusFilter === status
                    ? "bg-white text-emerald-900 shadow-md font-extrabold border border-slate-200/55"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {status === "Sin autorizar" ? "Pendientes" : status}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            
            {/* Refresh Button with Glassmorphism */}
            <button
              onClick={onRefresh}
              disabled={isLoading || !spreadsheetId}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/20 bg-white/40 hover:bg-white/60 text-xs font-black tracking-wide uppercase text-slate-800 disabled:opacity-50 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Actualizar
            </button>

            {spreadsheetId && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                referrerPolicy="no-referrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300/30 bg-emerald-850 text-white hover:bg-emerald-900 transition-all shadow-md text-xs font-black tracking-wide uppercase whitespace-nowrap active:scale-95"
              >
                <FileSpreadsheet size={13} />
                Ver Hoja
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 📄 Consolidated Oficio Document Generator floating banner */}
      <AnimatePresence>
        {selectedEntries.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            className="bg-gradient-to-r from-[#0c1b15] to-[#102d20] text-white p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5 shadow-2xl border border-emerald-700/30 relative overflow-hidden"
          >
            {/* Ambient gold corner accent */}
            <div className="absolute right-0 top-0 h-16 w-16 bg-[#d4af37]/10 rounded-bl-full pointer-events-none" />

            <div className="flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-[#d4af37]/25 text-[#f1c40f] flex items-center justify-center text-sm font-black font-mono border border-[#d4af37]/45 shadow-lg shadow-amber-500/10">
                {selectedEntries.length}
              </span>
              <div className="space-y-1">
                <p className="text-xs font-black tracking-widest uppercase text-[#d4af37]">Consolidación de Oficio de Almacén</p>
                <p className="text-[11px] sm:text-xs text-slate-300">
                  Ha seleccionado <span className="font-extrabold text-emerald-400">{selectedEntries.length} partidas de insumos médicos autorizadas</span>. ¿Desea consolidar y emitir el Acta de Entrada Oficial de Bienestar?
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0 relative z-10">
              <button
                onClick={() => setSelectedEntries([])}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerateOficio}
                disabled={selectedEntries.length < 2 || isGeneratingOficio}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-[#d4af37] hover:from-amber-600 hover:to-[#c59b27] disabled:opacity-50 text-slate-950 font-black tracking-widest uppercase text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/20 active:scale-95"
                title={selectedEntries.length < 2 ? "Seleccione al menos 2 registros autorizados para consolidar" : "Generar oficio en Google Docs"}
              >
                {isGeneratingOficio ? (
                  <>
                    <RefreshCw className="animate-spin" size={13} />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileText size={14} />
                    Generar Acta ({selectedEntries.length})
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {oficioError && (
        <div className="p-4.5 bg-rose-50 text-xs text-rose-800 font-bold rounded-xl border border-rose-200/60 flex justify-between items-center shadow-lg">
          <div className="flex items-center gap-2.5">
            <XCircle size={16} className="text-rose-500 shrink-0" />
            <span>{oficioError}</span>
          </div>
          <button onClick={() => setOficioError("")} className="text-rose-400 hover:text-rose-700 font-bold p-1">
            <X size={15} />
          </button>
        </div>
      )}

      {/* 🏢 Main Table Container styled with frosted glassmorphism */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl overflow-hidden">
        
        {isLoading ? (
          <div className="py-28 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border-4 border-slate-200 border-t-emerald-800 animate-spin" />
              <Database className="absolute text-emerald-800" size={18} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-slate-800 tracking-widest uppercase">Consultando Padrón FONSABI...</p>
              <p className="text-[10px] text-slate-500 font-medium">Sincronizando estado y firmas de auditoría gubernamental</p>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-20 text-center max-w-xl mx-auto flex flex-col items-center space-y-6">
            <div className="p-4.5 bg-emerald-500/10 rounded-2xl text-emerald-800 border border-emerald-500/20 shadow-inner">
              <Inbox size={36} />
            </div>
            <div className="space-y-2">
              <h4 className="text-base font-extrabold text-slate-900">Repositorio del Sistema Vacío</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                No se han encontrado registros de insumos médicos en la hoja del sistema actual. Inicialice los datos de demostración de IMSS-BIENESTAR para simular la auditoría federal.
              </p>
            </div>
            <button
              onClick={onInitializeMock}
              disabled={isInitializing}
              className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-800/15 flex items-center gap-2.5 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles size={14} />
              {isInitializing ? "Inicializando plantilla..." : "Inicializar Base de Datos de Ejemplo"}
            </button>
          </div>
        ) : (
          <div>
            
            {/* 🖥️ DESKTOP MASTER TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/[0.03] border-b border-slate-200/60 text-[10px] font-black text-slate-600 uppercase tracking-widest select-none">
                    <th className="py-4.5 px-4 text-center w-12 bg-white/10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleToggleSelectAll}
                        disabled={authorizedFiltered.length === 0}
                        className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/10 h-4.5 w-4.5 cursor-pointer accent-emerald-700 transition-all shadow-inner"
                        title="Seleccionar todo lo autorizado"
                      />
                    </th>
                    <th className="py-4.5 px-5 text-center w-16 text-slate-400 font-mono">ID</th>
                    <th className="py-4.5 px-6 min-w-[280px]">Especificación de Medicamento / Clave</th>
                    <th className="py-4.5 px-6">Lote & Caducidad</th>
                    <th className="py-4.5 px-6 text-right">Volumen & Costo</th>
                    <th className="py-4.5 px-6">Proveedor y Remisión</th>
                    <th className="py-4.5 px-6 text-center">Estatus Sanitario</th>
                    <th className="py-4.5 px-6 text-center">Acciones</th>
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
                            ? "bg-emerald-500/5 hover:bg-emerald-500/10" 
                            : "hover:bg-white/40"
                        }`}
                      >
                        {/* Selector para consolidación */}
                        <td className="py-4.5 px-4 text-center align-middle">
                          {isAuthorized ? (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(entry)}
                              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/10 h-4.5 w-4.5 cursor-pointer accent-emerald-700 transition-all shadow-sm"
                            />
                          ) : (
                            <div 
                              className="w-4.5 h-4.5 mx-auto rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] text-slate-300 font-black select-none" 
                              title="Requiere estatus 'Autorizado' para integrar en acta de entrada"
                            >
                              -
                            </div>
                          )}
                        </td>

                        {/* Partida ID */}
                        <td className="py-4.5 px-5 text-center align-middle">
                          <span className="inline-flex w-7.5 h-7.5 rounded-lg bg-slate-50 border border-slate-200 items-center justify-center font-mono text-xs font-bold text-slate-600 group-hover:bg-slate-100">
                            {entry.no}
                          </span>
                        </td>

                        {/* Medicamento y Clave */}
                        <td className="py-4.5 px-6 max-w-[340px] align-middle">
                          <div className="font-bold text-slate-900 leading-snug group-hover:text-emerald-900 transition-colors line-clamp-2">
                            {entry.descripcion}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[9px] font-mono font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest">
                              {entry.codigoFonsabi}
                            </span>
                          </div>
                        </td>

                        {/* Trazabilidad de Lote */}
                        <td className="py-4.5 px-6 align-middle">
                          <div>
                            <span className="text-[10px] font-mono font-black text-slate-700 bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                              LOTE: {entry.lote}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2 font-medium">
                            <Calendar size={11} className="shrink-0 text-slate-400" />
                            <span>CAD: {entry.fechaCaducidad}</span>
                          </div>
                        </td>

                        {/* Cantidad y Costo */}
                        <td className="py-4.5 px-6 text-right align-middle">
                          <div className="font-extrabold text-slate-900 text-sm tracking-tight font-mono">
                            {Number(entry.cantidad).toLocaleString()}{" "}
                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-0.5">Pzs</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-1 font-semibold">
                            ${Number(entry.costoUnidad).toFixed(2)} c/u
                          </div>
                        </td>

                        {/* Procedencia */}
                        <td className="py-4.5 px-6 max-w-[220px] align-middle">
                          <div className="font-semibold text-slate-800 truncate" title={entry.proveedor}>
                            {entry.proveedor}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-2 font-mono">
                            <span className="text-[9px] bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">
                              REM: #{entry.remision}
                            </span>
                          </div>
                        </td>

                        {/* Sanitary Status with Luxury badges */}
                        <td className="py-4.5 px-6 text-center align-middle">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                            isAuthorized 
                              ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/25" 
                              : isRejected
                              ? "bg-rose-500/10 text-rose-800 border-rose-500/25"
                              : "bg-amber-500/10 text-amber-800 border-amber-500/25"
                          }`}>
                            {isAuthorized && <CheckCircle2 size={11} className="text-emerald-700" />}
                            {isRejected && <ShieldAlert size={11} className="text-rose-700" />}
                            {(!entry.estatus || entry.estatus === "Sin autorizar") && (
                              <Clock size={11} className="text-amber-700 animate-spin-slow" />
                            )}
                            {entry.estatus || "Sin autorizar"}
                          </span>
                        </td>

                        {/* Acción para cotejo */}
                        <td className="py-4.5 px-6 text-center align-middle">
                          <button
                            onClick={() => onSelectEntry(entry)}
                            className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all duration-150 cursor-pointer ${
                              isAuthorized
                                ? "text-slate-700 bg-slate-50 hover:bg-slate-200/70 border border-slate-200/80 shadow-3xs"
                                : isRejected
                                ? "text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                                : "text-white bg-slate-900 hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/10"
                            }`}
                          >
                            {isAuthorized ? "Ver Ficha" : isRejected ? "Ver Nota" : "Cotejar"}
                            <ChevronRight size={13} className="group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 📱 MOBILE LIST VIEW: Responsive Card Stack */}
            <div className="md:hidden block p-4 space-y-4">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-100 flex justify-between items-center">
                <span>Partidas ({filteredEntries.length})</span>
                <span className="text-slate-500">Filtrado federal</span>
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
                        ? "bg-emerald-500/[0.04] border-emerald-500/35 shadow-md shadow-emerald-500/5" 
                        : "bg-white/60 border-white/40 shadow-sm hover:border-slate-300"
                    }`}
                  >
                    {/* Check, ID, and Status Badge */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        {isAuthorized ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(entry)}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500/10 h-4.5 w-4.5 cursor-pointer accent-emerald-700 shadow-sm"
                          />
                        ) : (
                          <div className="w-4.5 h-4.5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] text-slate-400 font-bold select-none">
                            -
                          </div>
                        )}
                        <span className="inline-flex w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 items-center justify-center font-mono text-xs font-black text-slate-500">
                          {entry.no}
                        </span>
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-xs ${
                        isAuthorized 
                          ? "bg-emerald-500/10 text-emerald-800 border-emerald-500/25" 
                          : isRejected
                          ? "bg-rose-500/10 text-rose-800 border-rose-500/25"
                          : "bg-amber-500/10 text-amber-800 border-amber-500/25"
                      }`}>
                        {isAuthorized && <CheckCircle2 size={10} className="text-emerald-700" />}
                        {isRejected && <ShieldAlert size={10} className="text-rose-700" />}
                        {(!entry.estatus || entry.estatus === "Sin autorizar") && (
                          <Clock size={10} className="text-amber-700 animate-spin-slow" />
                        )}
                        {entry.estatus || "Sin autorizar"}
                      </span>
                    </div>

                    {/* Drug Desc & Code */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-900 leading-snug">
                        {entry.descripcion}
                      </h4>
                      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                        CLAVE: {entry.codigoFonsabi}
                      </p>
                    </div>

                    {/* Meta Info Grid */}
                    <div className="grid grid-cols-2 gap-3.5 pt-3.5 border-t border-slate-100 text-[11px]">
                      
                      {/* Qty & Price */}
                      <div className="space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Cantidad de Insumo</span>
                        <p className="font-extrabold text-slate-950 font-mono text-xs">
                          {Number(entry.cantidad).toLocaleString()} <span className="text-[9px] text-slate-400 font-black">Pzs</span>
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono font-medium">${Number(entry.costoUnidad).toFixed(2)} c/u</p>
                      </div>

                      {/* Lote & CAD */}
                      <div className="space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Lote e Identificación</span>
                        <p className="font-black text-slate-700 font-mono text-[10px]">LOTE: {entry.lote}</p>
                        <p className="text-[9px] text-slate-400 flex items-center gap-1 font-mono font-medium">
                          <Calendar size={10} />
                          {entry.fechaCaducidad}
                        </p>
                      </div>

                      {/* Provider info */}
                      <div className="col-span-2 space-y-0.5">
                        <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Proveedor Sanitario</span>
                        <p className="font-bold text-slate-700 truncate text-[11px]">{entry.proveedor}</p>
                        <p className="text-[9px] text-slate-500 font-mono font-semibold">Remisión: #{entry.remision}</p>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-2">
                      <button
                        onClick={() => onSelectEntry(entry)}
                        className={`w-full flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 rounded-xl transition-all duration-150 cursor-pointer ${
                          isAuthorized
                            ? "text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200"
                            : isRejected
                            ? "text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                            : "text-white bg-slate-950 hover:bg-slate-900 shadow-md shadow-slate-950/10"
                        }`}
                      >
                        {isAuthorized ? "Ver Ficha Completa" : isRejected ? "Ver Nota de Rechazo" : "Iniciar Cotejo con IA"}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Zero state inside table filters */}
            {filteredEntries.length === 0 && (
              <div className="py-24 text-center text-slate-400 font-bold text-xs">
                No se encontraron registros que coincidan con los filtros gubernamentales seleccionados.
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
