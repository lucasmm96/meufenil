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
    options?: any
  ): string;
}
