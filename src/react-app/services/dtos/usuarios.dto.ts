export interface UsuarioDTO {
  id: string;
  nome: string | null;
  email: string | null;
  role: string;
  limite_diario_mg: number;
  timezone: string;
  consentimento_lgpd_em: string | null;
  created_at: string;
  updated_at: string;
}
