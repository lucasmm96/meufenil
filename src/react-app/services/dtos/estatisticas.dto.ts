export type PeriodoEstatisticas = "semana" | "mes";

export interface EstatisticaRegistroDTO {
  data: string;
  total: number;
}

export interface EstatisticasDTO {
  registros: EstatisticaRegistroDTO[];
  totalConsumo: number;
  mediaConsumo: number;
  maiorConsumo: number;
}

export interface EstatisticasUsuarioDTO {
  id: string;
  timezone: string;
}
