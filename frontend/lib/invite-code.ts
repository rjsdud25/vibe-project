import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 팀 참가용 6자리 비밀번호 (DB `invite_code` 컬럼에 저장, I/O/0/1 제외) */
export function generateTeamJoinPassword(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return out;
}
