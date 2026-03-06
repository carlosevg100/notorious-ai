export interface Firm {
  id: string
  name: string
  slug: string
  plan: string
  created_at: string
}

export interface Client {
  id: string
  firm_id: string
  name: string
  cnpj: string | null
  email: string | null
  type: string
  created_at: string
}

export interface Project {
  id: string
  firm_id: string
  client_id: string | null
  name: string
  numero_processo: string | null
  tipo: string
  fase: string
  vara: string | null
  comarca: string | null
  status: string
  created_at: string
  updated_at: string
  // joined
  client?: Client
  documents?: Document[]
  _document_count?: number
  _pending_count?: number
  _next_prazo?: string | null
}

export interface Document {
  id: string
  firm_id: string
  project_id: string
  name: string
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  processing_status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  processing_error: string | null
  processing_started_at: string | null
  processing_completed_at: string | null
  extracted_text: string | null
  extracted_data: ExtractedData | null
  created_at: string
  updated_at: string
  document_category?: string | null
  doc_source?: 'parte_autora' | 'cliente' | null
}

export interface ExtractedData {
  tipo_documento: string
  numero_processo: string | null
  vara: string | null
  comarca: string | null
  partes: {
    autor: string | null
    reu: string | null
    advogado_autor: string | null
    advogado_reu: string | null
  }
  causa_pedir: string
  pedidos: string[]
  fatos_relevantes: string[]
  teses_juridicas: string[]
  tutela_antecipada: {
    requerida: boolean
    fundamento: string | null
  }
  valor_causa: string | null
  prazos_identificados: {
    descricao: string
    data: string | null
    tipo: string
  }[]
  risco_estimado: 'baixo' | 'medio' | 'alto'
  risco_justificativa: string
  resumo_executivo: string
}

export interface Prazo {
  id: string
  firm_id: string
  project_id: string
  document_id: string | null
  descricao: string
  data_prazo: string
  tipo: string
  status: 'pendente' | 'cumprido' | 'vencido'
  dias_uteis_restantes: number | null
  created_at: string
}

export interface Peca {
  id: string
  firm_id: string
  project_id: string
  tipo: string
  conteudo: string
  modelo_ia: string
  versao: number
  created_at: string
}

export interface ChatMessage {
  id: string
  project_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
