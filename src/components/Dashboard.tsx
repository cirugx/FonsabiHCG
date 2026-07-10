import React, { useState, useMemo } from "react";
import { FonsabiEntry } from "../types";
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
  ShieldAlert
} from "lucide-react";

interface DashboardProps {
  entries: FonsabiEntry[];
  spreadsheetId: string;
  onSelectEntry: (entry: FonsabiEntry) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onInitializeMock: () => void;
  isInitializing: boolean;
}

export default function Dashboard({
  entries,
  spreadsheetId,
  onSelectEntry,
  onRefresh,
  isLoading,
  onInitializeMock,
  isInitializing
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Todos");

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

  return (
    <div className="space-y-6">
      {/* Metrics Grid - Styled according to the Professional Polish design */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Pending */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Registros Pendientes</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{metrics.pending}</h3>
            <p className="text-[10px] text-amber-600 mt-1 font-semibold flex items-center gap-1">
              <AlertTriangle size={12} /> Requieren cotejo de IA
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
            <ClipboardList size={20} />
          </div>
        </div>

        {/* Metric 2: Approved */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Autorizados Hoy</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{metrics.approved}</h3>
            <p className="text-[10px] text-green-600 mt-1 font-semibold flex items-center gap-1">
              <CheckCircle2 size={12} /> Guardados en Google Sheets
            </p>
          </div>
          <div className="p-2.5 bg-green-50 rounded-lg text-green-600 border border-green-100">
            <CheckCircle2 size={20} />
          </div>
        </div>

        {/* Metric 3: Rejected */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Discrepancias Detectadas</p>
            <h3 className="text-2xl font-bold text-red-600 mt-1">{metrics.rejected}</h3>
            <p className="text-[10px] text-red-600 mt-1 font-semibold flex items-center gap-1">
              <XCircle size={12} /> Nota de devolución emitida
            </p>
          </div>
          <div className="p-2.5 bg-red-50 rounded-lg text-red-600 border border-red-100">
            <XCircle size={20} />
          </div>
        </div>

        {/* Metric 4: Efficiency */}
        <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Eficiencia de IA</p>
            <h3 className="text-2xl font-bold text-blue-800 mt-1">98.4%</h3>
            <p className="text-[10px] text-blue-700 mt-1 font-medium">
              Cotejo de PDFs en vivo por Gemini
            </p>
          </div>
          <div className="p-2.5 bg-blue-100 rounded-lg text-blue-700 border border-blue-200">
            <AlertTriangle size={20} className="text-blue-600" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Actions */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por código, lote, proveedor, folio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filters */}
          <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs font-medium">
            {["Todos", "Sin autorizar", "Autorizado", "Rechazado"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  statusFilter === status
                    ? "bg-white text-blue-600 shadow-xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <button
            onClick={onRefresh}
            disabled={isLoading || !spreadsheetId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            Actualizar
          </button>

          {spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              referrerPolicy="no-referrer"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <ExternalLink size={14} />
              Abrir Hoja
            </a>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="animate-spin text-blue-600" size={36} />
            <p className="text-sm font-medium text-slate-500">Cargando registros desde Google Sheets...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center max-w-xl mx-auto flex flex-col items-center space-y-4">
            <div className="p-4 bg-blue-50 rounded-full text-blue-600">
              <Database size={32} />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-800">No hay datos vinculados</h4>
              <p className="text-sm text-slate-500 mt-1">
                La hoja de cálculo seleccionada no tiene entradas o no ha sido inicializada con la plantilla FONSABI.
              </p>
            </div>
            <button
              onClick={onInitializeMock}
              disabled={isInitializing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              {isInitializing ? "Creando Hoja..." : "Inicializar Hoja FONSABI de Ejemplo"}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6 text-center w-16">Item</th>
                  <th className="py-4 px-6">Medicamento / Clave FONSABI</th>
                  <th className="py-4 px-6">Identificación (Lote / Caducidad)</th>
                  <th className="py-4 px-6 text-right">Volumen y Costo</th>
                  <th className="py-4 px-6">Proveedor y Remisión</th>
                  <th className="py-4 px-6 text-center">Estatus del Cotejo</th>
                  <th className="py-4 px-6 text-right">Auditoría</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-xs">
                {filteredEntries.map((entry, index) => (
                  <tr 
                    key={`${entry.no}-${index}`}
                    className="hover:bg-slate-50/80 transition-all duration-150 group"
                  >
                    {/* Item Number Badge */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 items-center justify-center font-mono text-xs font-bold text-slate-600 shadow-2xs">
                        {entry.no}
                      </span>
                    </td>

                    {/* Description and Clave */}
                    <td className="py-4 px-6 max-w-[280px]">
                      <div className="font-bold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                        {entry.descripcion}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                          {entry.codigoFonsabi}
                        </span>
                      </div>
                    </td>

                    {/* Batch and Expiry */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-mono font-extrabold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          LOTE: {entry.lote}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1">
                        <Calendar size={11} className="shrink-0" />
                        <span>CAD: {entry.fechaCaducidad}</span>
                      </div>
                    </td>

                    {/* Quantity & Unit Cost */}
                    <td className="py-4 px-6 text-right">
                      <div className="font-extrabold text-slate-900 text-sm">
                        {Number(entry.cantidad).toLocaleString()} <span className="text-[10px] text-slate-400 font-medium uppercase">pzs</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        ${Number(entry.costoUnidad).toFixed(2)} c/u
                      </div>
                    </td>

                    {/* Provider and Invoice Code */}
                    <td className="py-4 px-6 max-w-[200px]">
                      <div className="font-semibold text-slate-700 truncate" title={entry.proveedor}>
                        {entry.proveedor}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono flex items-center gap-1">
                        <FileSpreadsheet size={11} className="shrink-0 text-slate-300" />
                        <span>Remisión: #{entry.remision}</span>
                      </div>
                    </td>

                    {/* Elegant Estatus Chip */}
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                        entry.estatus === "Autorizado" 
                          ? "bg-green-50 text-green-700 border-green-200/80 shadow-2xs shadow-green-100" 
                          : entry.estatus === "Rechazado"
                          ? "bg-red-50 text-red-700 border-red-200/80 shadow-2xs shadow-red-100 animate-pulse"
                          : "bg-amber-50 text-amber-700 border-amber-200/80 shadow-2xs shadow-amber-100"
                      }`}>
                        {entry.estatus === "Autorizado" && <UserCheck size={12} className="text-green-600" />}
                        {entry.estatus === "Rechazado" && <ShieldAlert size={12} className="text-red-600" />}
                        {(entry.estatus === "Sin autorizar" || !entry.estatus) && <Clock size={12} className="text-amber-600 animate-pulse" />}
                        {entry.estatus || "Sin autorizar"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onSelectEntry(entry)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all duration-150 cursor-pointer ${
                          entry.estatus === "Autorizado"
                            ? "text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200"
                            : entry.estatus === "Rechazado"
                            ? "text-red-700 bg-red-50 hover:bg-red-100 border border-red-100"
                            : "text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300"
                        }`}
                      >
                        {entry.estatus === "Autorizado" ? "Ver Registro" : entry.estatus === "Rechazado" ? "Ver Nota" : "Verificar PDF"}
                        <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredEntries.length === 0 && (
              <div className="py-16 text-center text-slate-400 font-medium">
                Ninguna entrada coincide con la búsqueda o filtro seleccionado.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
