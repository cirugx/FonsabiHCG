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

export interface DocumentSegment {
  documentType: string;
  startPage: number;
  endPage: number;
  confidence: string;
}

export interface Doc1NotaEntrada {
  numeroNota: string;
  fechaRecepcion: string;
  codigoFonsabi: string;
  descripcionArticulo: string;
  cantidadRecibida: number;
  numeroLote: string;
  fechaCaducidad: string;
  nombreProveedor: string;
  numeroRemisionCapturado: string;
}

export interface Doc2RemisionComercial {
  folioRemision: string;
  fechaEmision: string;
  nombreProveedor: string;
  rfcProveedor: string;
  direccionProveedor: string;
  lote: string;
  fechaCaducidad: string;
  cantidad: number;
  costoUnidad: number;
  registroSanitarioTexto: string;
}

export interface Doc3OrdenRemision {
  folioOrden: string;
  fechaExpedicion: string;
  claveArticulo: string;
  descripcionArticulo: string;
  cantidadSolicitada: number;
  cantidadAutorizada: number;
  loteAsignado: string;
  fechaCaducidad: string;
}

export interface Doc4CertificadoAnalisis {
  numeroCertificado: string;
  nombreFabricante: string;
  nombreProducto: string;
  numeroLoteAnalizado: string;
  fechaFabricacionElaboracion: string;
  fechaCaducidad: string;
  formaFarmaceutica: string;
  resultadoAnalisis: string;
}

export interface Doc5RegistroSanitario {
  numeroRegistroSanitario: string;
  titularRegistro: string;
  nombreMedicamento: string;
  formaFarmaceuticaAutorizada: string;
  fechaVigencia: string;
  estatusVigencia: string;
}

export interface AmarreResult {
  id: string;
  label: string;
  description: string;
  isMatch: boolean;
  details: string;
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
  
  // Document-by-document extractions
  segmentation?: DocumentSegment[];
  doc1?: Doc1NotaEntrada;
  doc2?: Doc2RemisionComercial;
  doc3?: Doc3OrdenRemision;
  doc4?: Doc4CertificadoAnalisis;
  doc5?: Doc5RegistroSanitario;
  
  // Crossed checks (Amarre Cruzado)
  amarres?: AmarreResult[];
}
