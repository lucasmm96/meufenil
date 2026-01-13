export interface UsuarioAdminDTO {
  id: string;
  nome: string;
  email: string;
  role: "user" | "admin";
  limite_diario_mg: number;
  created_at: string;
}

export interface EstatisticasAdminDTO {
  usuarios: number;
  registros: number;
  referencias: {
    total: number;
    globais: number;
    personalizadas: number;
  };
  armazenamento: {
    estimado_mb: number;
    limite_gratuito_mb: number;
    percentual_usado: number;
  };
}

export interface ResultadoImportacaoDTO {
  importados: number;
  erros: string[];
  total: number;
  houveAtualizacoes: boolean;
}
