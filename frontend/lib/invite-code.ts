import { randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 6자리 초대 코드 (I, O, 0, 1 제외) */
export function generateInviteCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)]!;
  }
  return out;
}
