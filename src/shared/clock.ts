const LIMA_TIMEZONE = "America/Lima";
const LIMA_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", { timeZone: LIMA_TIMEZONE });

export const todayISO = (): string => LIMA_DATE_FORMATTER.format(new Date());

export const LIMA_TZ = LIMA_TIMEZONE;
