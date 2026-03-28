/** 멤버 닉네임 입력 규칙 (랜딩 등 클라이언트 검증용) */

export const MEMBER_NICKNAME_MAX_LEN = 30;

/** 빈 문자열이면 `null`(호출부에서 기본값 처리), 유효하면 `null`, 아니면 메시지 */
export function validateMemberNickname(raw: string): string | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  if (t.length > MEMBER_NICKNAME_MAX_LEN) {
    return `닉네임은 ${MEMBER_NICKNAME_MAX_LEN}자 이하여야 합니다.`;
  }
  return null;
}
