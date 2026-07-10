import React, { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout, getAccessToken, setAccessToken } from "./lib/auth";
import { FonsabiEntry } from "./types";
import Dashboard from "./components/Dashboard";
import VerificationWorkspace from "./components/VerificationWorkspace";
import { 
  ShieldCheck, 
  Database, 
  LogOut, 
  PlusCircle, 
  HelpCircle, 
  FileSpreadsheet, 
  CheckCircle,
  FolderOpen,
  ArrowRight,
  Info
} from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // App States
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem("fonsabi_spreadsheet_id") || "1TM0x8VJ3zjALarMyFTkF4N78sl4yV5IQS72dC-2YvB4";
  });
  const [inputSpreadsheetId, setInputSpreadsheetId] = useState("");
  const [entries, setEntries] = useState<FonsabiEntry[]>([]);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FonsabiEntry | null>(null);
  const [isInitializingSheet, setIsInitializingSheet] = useState(false);
  const [isUpdatingSheet, setIsUpdatingSheet] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Initialize Auth on Mount
  useEffect(() => {
    // Check session cache for token to handle fast-reloads
    const cachedToken = sessionStorage.getItem("fonsabi_token");
    if (cachedToken) {
      setAccessToken(cachedToken);
      setToken(cachedToken);
    }

    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setToken(token);
        sessionStorage.setItem("fonsabi_token", token);
        setAuthInitialized(true);
      },
      () => {
        setUser(null);
        setToken(null);
        sessionStorage.removeItem("fonsabi_token");
        setAuthInitialized(true);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch entries from Express Server
  const fetchEntries = async (idToUse?: string) => {
    const targetId = idToUse || spreadsheetId;
    if (!targetId || !accessToken) return;

    setIsLoadingEntries(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/entries?spreadsheetId=${targetId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudieron recuperar los registros de la Hoja de Cálculo.");
      }

      setEntries(data.entries);
    } catch (err: any) {
      console.error("Fetch entries error:", err);
      setErrorMessage(err.message || "Error al conectar con la API de Google Sheets.");
    } finally {
      setIsLoadingEntries(false);
    }
  };

  // Fetch on spreadsheetId changes
  useEffect(() => {
    if (spreadsheetId && accessToken) {
      fetchEntries();
    } else {
      setEntries([]);
    }
  }, [spreadsheetId, accessToken]);

  // Handle Google Sign In
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setErrorMessage("");
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        sessionStorage.setItem("fonsabi_token", result.accessToken);
      }
    } catch (err: any) {
      console.error("Sign-in failure:", err);
      setErrorMessage(err.message || "Error en el inicio de sesión.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Log Out
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    sessionStorage.removeItem("fonsabi_token");
    setSelectedEntry(null);
    setEntries([]);
  };

  // Initialize Template Sheet
  const handleCreateTemplate = async () => {
    if (!accessToken) return;
    setIsInitializingSheet(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/initialize-sheet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo inicializar la Hoja plantilla.");
      }

      const newId = data.spreadsheetId;
      setSpreadsheetId(newId);
      localStorage.setItem("fonsabi_spreadsheet_id", newId);
      await fetchEntries(newId);
    } catch (err: any) {
      console.error("Create template error:", err);
      setErrorMessage(err.message || "Error al crear la plantilla en Drive.");
    } finally {
      setIsInitializingSheet(false);
    }
  };

  // Handle Sheet ID Link
  const handleLinkSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSpreadsheetId.trim()) return;

    // Support full URLs or direct IDs
    let parsedId = inputSpreadsheetId.trim();
    if (parsedId.includes("spreadsheets/d/")) {
      const match = parsedId.match(/\/d\/([^\/]+)/);
      if (match) parsedId = match[1];
    }

    setSpreadsheetId(parsedId);
    localStorage.setItem("fonsabi_spreadsheet_id", parsedId);
    setInputSpreadsheetId("");
  };

  // Disconnect Sheet
  const handleDisconnectSheet = () => {
    if (window.confirm("¿Desvincular la Hoja de Cálculo actual del panel?")) {
      setSpreadsheetId("");
      localStorage.removeItem("fonsabi_spreadsheet_id");
      setEntries([]);
      setSelectedEntry(null);
    }
  };

  // Authorize/Reject Action
  const handleAuthorizeEntry = async (no: string, estatus: "Autorizado" | "Rechazado", note?: string) => {
    if (!spreadsheetId || !accessToken) return;
    setIsUpdatingSheet(true);
    try {
      const response = await fetch("/api/authorize-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          spreadsheetId,
          entryNo: no,
          estatus,
          notaRechazo: note,
          userEmail: user?.email
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar registro de auditoría.");
      }

      // Update locally
      setEntries(prev => prev.map(e => e.no === no ? data.updatedEntry : e));
      if (selectedEntry && selectedEntry.no === no) {
        setSelectedEntry(data.updatedEntry);
      }
    } catch (err: any) {
      console.error("Authorize Error:", err);
      throw err;
    } finally {
      setIsUpdatingSheet(false);
    }
  };

  // Render Login Gate
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        {/* Dynamic background glowing shapes for glassmorphism */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] bg-indigo-400/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-[40%] right-[15%] w-[35%] h-[35%] bg-teal-400/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
          <div className="inline-flex p-3.5 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl text-white shadow-xl shadow-blue-500/15 border border-blue-400/20">
            <ShieldCheck size={36} />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            FONSABI <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Almacén</span>
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed font-medium">
            Plataforma Profesional de Verificación de Entradas de Insumos Médicos.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
          <div className="bg-white/45 backdrop-blur-lg py-8 px-4 shadow-[0_12px_40px_rgba(0,0,0,0.06)] border border-white/60 sm:rounded-3xl sm:px-10 space-y-6">
            <div className="space-y-4">
              <div className="flex gap-3 items-start text-xs text-slate-600 bg-white/50 p-4 rounded-xl border border-slate-200/50">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium text-slate-500">
                  Para ingresar, inicia sesión con tu cuenta institucional de Google. Esto otorgará permisos seguros para leer la Hoja de Control y registrar tus firmas de auditoría.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-red-500/10 text-xs text-red-700 font-bold rounded-xl border border-red-500/20">
                {errorMessage}
              </div>
            )}

            {/* Official GSI Styled Material Button */}
            <div className="flex justify-center">
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn || !authInitialized}
                className="gsi-material-button w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all duration-150 cursor-pointer"
              >
                <div className="gsi-material-button-icon shrink-0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block", width: "18px", height: "18px" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isLoggingIn ? "Conectando..." : "Iniciar Sesión con Google"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Core Application Layout
  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col justify-between font-sans">
      {/* Dynamic background glowing shapes for glassmorphism */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] bg-indigo-400/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-[40%] right-[15%] w-[35%] h-[35%] bg-teal-400/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full flex-1 flex flex-col relative z-10">
        {/* Universal Upper Navigation Bar - Beautiful Floating Glass Header */}
        <header className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-[0_4px_30px_rgba(0,0,0,0.03)] border-b border-slate-800/80 sticky top-0 z-50">
          {/* Left: Brand name */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setSelectedEntry(null)}>
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-extrabold text-lg shadow-lg shadow-blue-500/20 text-white border border-blue-400/20">
              F
            </div>
            <div>
              <h1 className="text-base font-bold leading-none tracking-tight flex items-center gap-2">
                FONSABI <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-400 font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">Almacén</span>
              </h1>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Verificación de Entradas de Insumos Médicos</p>
            </div>
          </div>

          {/* Right: Profile, status and disconnect */}
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Analista Activo</p>
              <p className="text-xs font-bold text-slate-100 mt-0.5">{user.displayName || "Analista"}</p>
            </div>
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Avatar" 
                className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 shadow-xs"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs">
                {(user.displayName || "A")[0]}
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-all duration-200 cursor-pointer border border-transparent hover:border-slate-700/50"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

      {/* Main Content Pane */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {/* Spreadsheet Link Step (only if sheet is not linked yet) */}
        {!spreadsheetId ? (
          <div className="max-w-2xl mx-auto bg-white/50 backdrop-blur-lg rounded-3xl border border-white/60 p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] space-y-6 mt-12">
            <div className="text-center space-y-3">
              <div className="inline-flex p-3 bg-blue-500/10 rounded-2xl text-blue-600 border border-blue-500/20">
                <FileSpreadsheet size={32} />
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Vincular Base de Datos (Google Sheets)</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                FONSABI utiliza Google Sheets para la persistencia de datos. Puedes vincular una hoja existente o generar una nueva plantilla con datos muestra.
              </p>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-red-500/10 text-xs text-red-700 font-bold rounded-xl border border-red-500/20">
                {errorMessage}
              </div>
            )}

            {/* Link input form */}
            <form onSubmit={handleLinkSheet} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Enlace o ID de la Hoja de Google Sheets
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={inputSpreadsheetId}
                    onChange={(e) => setInputSpreadsheetId(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200/80 bg-white/60 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-2xs placeholder-slate-400"
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg hover:shadow-blue-200 transition-all cursor-pointer shrink-0"
                  >
                    Vincular <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </form>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200/50"></div>
              <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">o crea una plantilla</span>
              <div className="flex-grow border-t border-slate-200/50"></div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCreateTemplate}
                disabled={isInitializingSheet}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusCircle size={16} />
                {isInitializingSheet ? "Creando en tu Drive..." : "Generar Nueva Hoja Plantilla FONSABI"}
              </button>
            </div>
          </div>
        ) : (
          /* Main Router: Dashboard vs Workspace */
          <div className="space-y-6">
            
            {/* Sheet Link Info Bar */}
            <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-green-400 shrink-0" />
                <span className="font-semibold">Hoja Vinculada:</span>
                <span className="font-mono text-slate-300 truncate max-w-sm" title={spreadsheetId}>
                  {spreadsheetId}
                </span>
              </div>
              <button
                onClick={handleDisconnectSheet}
                className="text-[10px] font-bold uppercase tracking-wider text-red-300 hover:text-red-100 border border-red-500/30 hover:border-red-500 px-2 py-1 rounded-md transition-colors cursor-pointer"
              >
                Desvincular Hoja
              </button>
            </div>

            {errorMessage && (
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-xs text-red-700 flex items-center justify-between">
                <span>{errorMessage}</span>
                <button 
                  onClick={() => fetchEntries()}
                  className="font-bold underline cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {!selectedEntry ? (
              <Dashboard
                entries={entries}
                spreadsheetId={spreadsheetId}
                onSelectEntry={(entry) => setSelectedEntry(entry)}
                onRefresh={() => fetchEntries()}
                isLoading={isLoadingEntries}
                onInitializeMock={handleCreateTemplate}
                isInitializing={isInitializingSheet}
              />
            ) : (
              <VerificationWorkspace
                entry={selectedEntry}
                spreadsheetId={spreadsheetId}
                onBack={() => {
                  setSelectedEntry(null);
                  fetchEntries(); // Refresh list to get updated status
                }}
                accessToken={accessToken}
                onAuthorize={handleAuthorizeEntry}
                isUpdating={isUpdatingSheet}
              />
            )}
          </div>
        )}
      </main>
      </div>

      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex flex-col sm:flex-row justify-between items-center shrink-0 text-[10px] text-slate-400 font-mono mt-auto gap-2">
        <div className="flex gap-4">
          <span>SESIÓN: ACTIVA</span>
          <span>BACKEND: ONLINE</span>
          <span>API GEMINI: 200 OK</span>
        </div>
        <div>ID Transacción: FONSABI-VERIFY-SECURE-2026</div>
      </footer>
    </div>
  );
}
