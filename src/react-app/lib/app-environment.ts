import type { BackgroundJobEnvironment } from "@/react-app/services/dtos/background-jobs.dto";

const environmentFromEnv = import.meta.env.VITE_APP_ENVIRONMENT as string | undefined;

export const CURRENT_APP_ENVIRONMENT: BackgroundJobEnvironment =
  environmentFromEnv === "dev" || environmentFromEnv === "prod"
    ? environmentFromEnv
    : import.meta.env.DEV
      ? "dev"
      : "prod";
