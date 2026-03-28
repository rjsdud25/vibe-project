/** 팀 이름 입력 규칙 (랜딩 등 클라이언트 검증용) */

export const TEAM_NAME_MAX_LEN = 40;

export function validateTeamName(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return "팀 이름을 입력해 주세요.";
  }
  if (t.length > TEAM_NAME_MAX_LEN) {
    return `팀 이름은 ${TEAM_NAME_MAX_LEN}자 이하여야 합니다.`;
  }
  return null;
}
