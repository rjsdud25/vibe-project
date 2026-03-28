/** 메뉴 이름 중복 비교용(클라이언트·API 공통) */
export function normalizeMenu(s: string): string {
  return s.trim().toLowerCase();
}
