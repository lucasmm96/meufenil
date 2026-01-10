import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { formatInTimeZone } from "date-fns-tz";
import { subDays } from "date-fns";
import { DashboardDTO } from "./dtos/dashboard.dto";

export async function getDashboardData(userId: string): Promise<DashboardDTO> {
  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, limite_diario_mg, consentimento_lgpd_em, timezone")
    .eq("id", userId)
    .single();

  if (usuarioError || !usuario) {
    throw new AppError("DASHBOARD_USER_ERROR", "Erro ao carregar usuário", usuarioError);
  }

  const hojeStr = formatInTimeZone(new Date(), usuario.timezone, "yyyy-MM-dd");

  const { data: registrosHoje, error: hojeError } = await supabase
    .from("registros")
    .select("fenil_mg")
    .eq("usuario_id", userId)
    .eq("data", hojeStr);

  if (hojeError || !registrosHoje) {
    throw new AppError("DASHBOARD_TODAY_ERROR", "Erro ao carregar registros de hoje", hojeError);
  }

  const totalHoje =
    registrosHoje.reduce((acc, r) => acc + (r.fenil_mg ?? 0), 0);

  const inicio = formatInTimeZone(
    subDays(new Date(), 6),
    usuario.timezone,
    "yyyy-MM-dd"
  );

  const { data: registrosGrafico, error: graficoError } = await supabase
    .from("registros")
    .select("data, fenil_mg")
    .eq("usuario_id", userId)
    .gte("data", inicio);

  if (graficoError || !registrosGrafico) {
    throw new AppError("DASHBOARD_GRAPH_ERROR", "Erro ao carregar gráfico", graficoError);
  }

  const mapa: Record<string, number> = {};

  registrosGrafico.forEach((r) => {
    mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
  });

  const grafico = Object.keys(mapa)
    .sort()
    .map((data) => ({
      data,
      total: mapa[data],
    }));

  return {
    usuario,
    hoje: {
      total: totalHoje,
      limite: usuario.limite_diario_mg,
      data: hojeStr,
    },
    grafico,
  };
}

export async function updateConsentimentoLGPD(userId: string): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({ consentimento_lgpd_em: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    throw new AppError(
      "CONSENTIMENTO_ERROR",
      "Erro ao salvar consentimento LGPD",
      error
    );
  }
}
