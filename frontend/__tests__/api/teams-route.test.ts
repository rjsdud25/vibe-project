import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/teams/route";
import { TEAM_NAME_MAX_LEN } from "@/lib/team-name";
import { TEAM_JOIN_PASSWORD_MIN_LEN } from "@/lib/team-join-password";

const createServerSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient,
}));

function chainGetResult(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result);
  const order = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ order });
  return { select, order, limit };
}

function chainInsertResult(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const selectAfterInsert = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select: selectAfterInsert });
  return { insert, selectAfterInsert, single };
}

function setupSupabaseMock(
  opts: {
    get?: { data: unknown; error: unknown };
    insert?: { data: unknown; error: unknown };
    /** insert 경로까지 도달하는 테스트용 로그인 사용자 */
    authUser?: { id: string };
  } = {}
) {
  const getChain = chainGetResult(
    opts.get ?? { data: [], error: null }
  );
  const insertChain = chainInsertResult(
    opts.insert ?? {
      data: {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Mock Team",
        invite_code: "ABCD",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      error: null,
    }
  );
  const getUser = vi.fn().mockResolvedValue(
    opts.authUser
      ? { data: { user: opts.authUser }, error: null }
      : { data: { user: null }, error: null }
  );
  createServerSupabaseClient.mockResolvedValue({
    from: vi.fn(() => ({
      select: (cols: string) => {
        if (cols === "id, name, created_at") {
          return getChain.select();
        }
        return insertChain.selectAfterInsert();
      },
      insert: insertChain.insert,
    })),
    auth: { getUser },
  });
  return { getChain, insertChain, getUser };
}

describe("app/api/teams/route — 보안·논리 이슈 기반 Red 시나리오", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 이슈 1: 인증·세션 검증 없이 GET으로 팀 목록(최대 200건)이 노출될 수 있음(무단 정보 노출).
   */
  it("GET: 세션·쿠키가 없을 때는 401로 거부되어야 한다", async () => {
    // Given
    // - Supabase가 팀 행을 돌려주어도, 라우트는 호출자 신원 검증 후에만 목록을 내려줘야 한다고 가정한다.
    setupSupabaseMock({
      get: { data: [{ id: "1", name: "Leaked", created_at: "" }], error: null },
    });

    // When
    // - 세션 쿠키·Authorization 헤더 없이 GET 핸들러를 호출한다.
    const res = await GET();

    // Then
    expect(res.status).toBe(401);
  });

  /**
   * 이슈 2: 인증 없이 POST로 팀을 생성할 수 있으면 무단 리소스 생성(남용·스팸)에 취약.
   */
  it("POST: 유효한 본문이어도 인증되지 않은 요청은 401이어야 한다", async () => {
    // Given
    // - BVA: 팀 이름 길이 = TEAM_NAME_MAX_LEN(상한), 비밀번호 길이 = TEAM_JOIN_PASSWORD_MIN_LEN(하한)인 유효 페이로드.
    setupSupabaseMock();
    const name = "a".repeat(TEAM_NAME_MAX_LEN);
    const joinPassword = "0".repeat(TEAM_JOIN_PASSWORD_MIN_LEN);
    const req = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, join_password: joinPassword }),
    });

    // When
    const res = await POST(req);

    // Then
    expect(res.status).toBe(401);
  });

  /**
   * 이슈 3: insert 실패 시 Supabase error.message를 그대로내면 스키마·내부 DB 정보가 유출될 수 있음.
   */
  it("POST: insert 실패 시 응답 error에 DB 내부 상세 문자열을 포함하지 않아야 한다", async () => {
    // Given
    // - Supabase가 스키마·객체 이름이 드러나는 message 를 돌려준다.
    const internalDetail =
      'relation "teams" does not exist — internal_schema_hint_7f3a';
    setupSupabaseMock({
      insert: { data: null, error: { message: internalDetail, code: "42P01" } },
      authUser: { id: "00000000-0000-0000-0000-000000000099" },
    });
    const req = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Team",
        join_password: "ABCD",
      }),
    });

    // When
    const res = await POST(req);
    const body = (await res.json()) as { error?: string };

    // Then
    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
    expect(body.error).not.toContain("internal_schema_hint_7f3a");
    expect(body.error).not.toContain("does not exist");
  });

  /**
   * 이슈 4: name / join_password가 문자열이 아닐 때 필드 단위 타입 오류로 계약을 명시하지 않으면,
   * 빈 값과 동일한 메시지로만 처리되어 클라이언트·감사 관점에서 혼동을 줄 수 있음.
   */
  it('POST: name이 문자열이 아니면 "문자열이어야 합니다" 류의 명시적 메시지를 반환해야 한다', async () => {
    // Given
    // - JSON 에서 name 이 숫자 타입인 비정상 페이로드.
    setupSupabaseMock();
    const req = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: 12345,
        join_password: "ABCD",
      }),
    });

    // When
    const res = await POST(req);
    const body = (await res.json()) as { error?: string };

    // Then
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/문자열/);
  });

  /**
   * 이슈 5: Content-Type이 application/json이 아닌 경우 API 계약 위반을 415로 구분하지 않으면
   * 클라이언트 오류와 구분하기 어렵고, 프록시/중간 캐시와의 상호운용에서 혼선이 생길 수 있음.
   * BVA: 본문은 유효 JSON 문자열이지만 Content-Type은 비(JSON) 값(경계: text/plain).
   */
  it("POST: Content-Type이 application/json이 아니면 415여야 한다(BVA: text/plain + 유효 JSON)", async () => {
    // Given
    // - BVA: 본문은 JSON.stringify 로 유효한 객체 문자열이나 Content-Type 은 text/plain.
    setupSupabaseMock();
    const req = new Request("http://localhost/api/teams", {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: JSON.stringify({ name: "T", join_password: "ABCD" }),
    });

    // When
    const res = await POST(req);

    // Then
    expect(res.status).toBe(415);
  });
});
