import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export async function logout(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AppError(
      "AUTH_LOGOUT_ERROR",
      "Erro ao encerrar sessão",
      error,
    );
  }
}
