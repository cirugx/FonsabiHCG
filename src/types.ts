export interface FonsabiEntry {
  no: string;
  codigoFonsabi: string;
  descripcion: string;
  estatus: 'Sin autorizar' | 'Autorizado' | 'Rechazado';
  pdf: string;
  lote: string;
  fechaCaducidad: string;
  cantidad: string;
  costoUnidad: string;
  proveedor: string;
  remision: string;
  fechaAutorizacion?: string;
  usuarioAutorizacion?: string;
  notaRechazo?: string;
}

export interface VerificationResult {
  sheetValue: string;
  pdfValue: string;
  isMatch: boolean;
  field: string;
  label: string;
}

export interface VerificationReport {
  entryId: string;
  matchPercentage: number;
  comparisons: {
    lote: VerificationResult;
    fechaCaducidad: VerificationResult;
    cantidad: VerificationResult;
    costoUnidad: VerificationResult;
    proveedor: VerificationResult;
    remision: VerificationResult;
  };
  observaciones: string;
  extractedRaw: any;
  isMock: boolean;
}
