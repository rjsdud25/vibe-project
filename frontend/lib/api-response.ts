import { NextResponse } from "next/server";

export function jsonError(
  message: string,
  status: number,
  extras?: Record<string, unknown>
) {
  return NextResponse.json(
    extras ? { error: message, ...extras } : { error: message },
    { status }
  );
}
