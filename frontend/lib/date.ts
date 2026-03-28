/** 한국 시간 기준 오늘 날짜 YYYY-MM-DD */
export function todayDateStringKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
