export interface DashboardHojeDTO {
  total: number;
  limite: number;
  data: string;
}

export interface DashboardGraficoDTO {
  data: string;
  total: number;
}

export interface DashboardUsuarioDTO {
  id: string;
  limite_diario_mg: number;
  consentimento_lgpd_em: string | null;
  timezone: string;
}

export interface DashboardDTO {
  usuario: DashboardUsuarioDTO;
  hoje: DashboardHojeDTO;
  grafico: DashboardGraficoDTO[];
}
