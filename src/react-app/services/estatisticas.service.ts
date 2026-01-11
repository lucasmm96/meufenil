import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  EstatisticasDTO,
  EstatisticaRegistroDTO,
  PeriodoEstatisticas,
  EstatisticasUsuarioDTO,
} from "./dtos/estatisticas.dto";

export async function getEstatisticas(
  usuarioId: string,
  periodo: PeriodoEstatisticas
): Promise<EstatisticasDTO> {
  // 1️⃣ Buscar usuário (timezone)
  const { data: usuario, error: usuarioError } = await supabase
    .from("usuarios")
    .select("id, timezone")
    .eq("id", usuarioId)
    .single<EstatisticasUsuarioDTO>();

  if (usuarioError || !usuario) {
    throw new AppError(
      "ESTATISTICAS_USUARIO_ERROR",
      "Erro ao carregar dados do usuário",
      usuarioError
    );
  }

  // 2️⃣ Calcular data inicial conforme período
  const dias = periodo === "semana" ? 7 : 30;
  const dataInicio = formatInTimeZone(
    subDays(new Date(), dias - 1),
    usuario.timezone,
    "yyyy-MM-dd"
  );

  // 3️⃣ Buscar registros
  const { data: registrosDB, error: registrosError } = await supabase
    .from("registros")
    .select("data, fenil_mg")
    .eq("usuario_id", usuarioId)
    .gte("data", dataInicio);

  if (registrosError || !registrosDB) {
    throw new AppError(
      "ESTATISTICAS_REGISTROS_ERROR",
      "Erro ao buscar registros",
      registrosError
    );
  }

  // 4️⃣ Agregar consumo por dia
  const mapa: Record<string, number> = {};

  registrosDB.forEach((r) => {
    mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
  });

  const registros: EstatisticaRegistroDTO[] = Object.keys(mapa)
    .sort()
    .map((data) => ({
      data,
      total: mapa[data],
    }));

  // 5️⃣ Métricas consolidadas
  const totalConsumo = registros.reduce((sum, r) => sum + r.total, 0);
  const mediaConsumo =
    registros.length > 0 ? totalConsumo / registros.length : 0;
  const maiorConsumo =
    registros.length > 0
      ? Math.max(...registros.map((r) => r.total))
      : 0;

  return {
    registros,
    totalConsumo,
    mediaConsumo,
    maiorConsumo,
  };
}
