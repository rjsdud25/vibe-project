/** 팀 참가 비밀번호 규칙 (DB `invite_code`에 저장되는 값과 동일) */

export const TEAM_JOIN_PASSWORD_MIN_LEN = 4;
export const TEAM_JOIN_PASSWORD_MAX_LEN = 32;

export function normalizeTeamJoinPassword(raw: string): string {
  return raw.trim().toUpperCase();
}

/** 유효하면 `null`, 아니면 사용자에게 보여 줄 한국어 메시지 */
export function validateTeamJoinPassword(normalized: string): string | null {
  if (normalized.length < TEAM_JOIN_PASSWORD_MIN_LEN) {
    return `팀 비밀번호는 ${TEAM_JOIN_PASSWORD_MIN_LEN}자 이상이어야 합니다.`;
  }
  if (normalized.length > TEAM_JOIN_PASSWORD_MAX_LEN) {
    return `팀 비밀번호는 ${TEAM_JOIN_PASSWORD_MAX_LEN}자 이하여야 합니다.`;
  }
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return "팀 비밀번호는 영문과 숫자만 사용할 수 있습니다.";
  }
  return null;
}

/** 랜딩 폼 도움말·placeholder용 한 줄 설명 */
export function teamJoinPasswordRulesHint(): string {
  return `${TEAM_JOIN_PASSWORD_MIN_LEN}~${TEAM_JOIN_PASSWORD_MAX_LEN}자, 영문·숫자만 · 대소문자 구분 없음(저장 시 대문자)`;
}
