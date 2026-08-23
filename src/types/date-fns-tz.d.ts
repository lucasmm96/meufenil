declare module "date-fns-tz" {
  export function zonedTimeToUtc(
    date: string | Date,
    timeZone: string
  ): Date;

  export function utcToZonedTime(
    date: string | Date,
    timeZone: string
  ): Date;

  export function formatInTimeZone(
    date: string | Date,
    timeZone: string,
    formatStr: string,
    options?: {
      locale?: unknown;
      weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
      firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
      useAdditionalDayOfYearTokens?: boolean;
      useAdditionalWeekYearTokens?: boolean;
    }
  ): string;
}
