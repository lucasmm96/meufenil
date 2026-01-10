export const logger = {
  error(message: string, error?: unknown) {
    // futura integração com Sentry
    console.error(`[ERROR] ${message}`, error);
  },

  warn(message: string, data?: unknown) {
    console.warn(`[WARN] ${message}`, data);
  },

  info(message: string, data?: unknown) {
    console.info(`[INFO] ${message}`, data);
  },
};
