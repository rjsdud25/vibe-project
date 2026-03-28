# OWASP 부분 영역 보안 감사 결과

**대상:** `frontend/` (Next.js App Router, Supabase)  
**기준:** SQL 인젝션 · 세션/식별자 · 에러 유출 · Bcrypt(참가 코드·비밀번호)  
**일자:** 2026-03-28

## 의존성 요약

- **DB/클라이언트:** `@supabase/supabase-js`, `@supabase/ssr` — Raw SQL·ORM·`bcrypt`/`bcryptjs` 패키지 **없음**.
- **저장소 내 SQL 마이그레이션:** 없음 → **RLS·DB 함수·정책은 Supabase 대시보드 또는 별도 저장소에서 확인 필요.**

## Bcrypt

- 애플리케이션에 **bcrypt 미사용** (의도적으로 도입되지 않음).
- 팀 참가 코드는 DB 컬럼 `invite_code`에 **평문(대문자 정규화)** 으로 저장되고, API에서 **`===` 문자열 비교**로 검증됨 (`join`, `verify-join`, 팀 생성 시 insert).

## 발견 사항 (Critical / High / Medium)

| 일련번호 | 심각도 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
| 1 | High | `frontend/lib/member-storage.ts` | 타입 `TeamMeta`, `setTeamMeta` (대략 4–17행) | 팀 참가 비밀번호 `join_password`를 **sessionStorage**에 JSON으로 저장. XSS 발생 시 **평문 유출** 가능. | 비밀은 브라우저 저장소에 두지 않기. HttpOnly·Secure 쿠키 + 서버 검증, 또는 짧은 수명 토큰만 저장 등으로 축소. |
| 2 | High | `frontend/app/api/teams/join/route.ts`, `verify-join/route.ts`, `teams/route.ts` | 예: join 42–43행, verify-join 39–40행, teams POST insert 55–57행 | `invite_code` **평문 저장·평문 비교**. DB 유출 시 전체 팀 입장 코드 노출. | 참가 코드는 **해시만 저장**(예: bcrypt cost ≥ 12 또는 적절한 KDF)하고 `compare`로 검증. 또는 서버 측 비밀과 HMAC 등 설계(제품 요구에 맞게 선택). |
| 3 | Medium | `frontend/app/api/**/*.ts` (다수), `frontend/app/api/health/supabase/route.ts` | 예: `jsonError(sErr.message, 500)`, health 10–11행 | Supabase/Postgres **`error.message`를 클라이언트에 그대로 반환**. 스키마·제약·내부 구조 단서 유출 가능. | 프로덕션에서는 **고정 메시지**(예: "처리 중 오류")와 **내부 로그**로 분리. `error.code`만 매핑해 사용자 메시지로 변환하는 패턴 권장. |
| 4 | Medium | `frontend/app/api/sessions/[sessionId]/proposals/route.ts`, `votes/route.ts`, `teams/.../members/[memberId]/route.ts`, `finalize/route.ts` | 예: proposals POST `member_id` 본문, members DELETE `actor_member_id`, finalize `member_id` | **서버 발급·서명 세션 없이** 요청 본문의 `member_id` / `actor_member_id`만으로 행위 권한을 판단. UUID가 유출·추측되면 **다른 멤버 행위 위조** 가능(앱이 “비밀 링크” 모델이어도 위험은 남음). | 멤버별 **서버 발급 토큰**(짧은 만료·팀/세션에 바인딩) 또는 Supabase Auth 등으로 호출자와 `member_id`를 **암호학적으로 결합**. |
| 5 | Medium | `frontend/app/api/sessions/[sessionId]/start-voting/route.ts` | POST 핸들러 전체(예: 6–73행) | **멤버 식별·비밀 없이** `sessionId`만으로 투표 단계 전환 가능. 세션 ID를 아는 주체가 임의로 투표 시작 가능. | 최소한 팀 멤버임을 입증하는 토큰 또는 “제안 단계를 연 멤버만” 등 **권한 검증** 추가. RLS로 보완 가능하나, API 계약만으로는 부족할 수 있음. |
| 6 | Medium | `frontend/app/api/teams/route.ts` | GET 10–22행 | **무인증으로 팀 목록**(id, name 등) 조회. `invite_code` 최소 길이 4·영숫자(`team-join-password.ts`)와 결합 시 **팀 단위 무차별 시도**에 유리. | 공개 필요 최소 필드만 노출, 속도 제한, 더 긴 코드 또는 서버 측 가입 플로우 강화. |

## SQL 인젝션 (코드베이스)

- 앱 코드에서 **`rpc()`·raw SQL 문자열 조립** 사용 **없음**. Supabase 클라이언트의 `.from().select().eq()` 등 **파라미터화된** 호출만 확인됨 → **해당 영역에서는 양호**로 판단.
- DB 측 커스텀 함수·뷰·RLS는 **저장소에 스키마 없음**으로 본 문서에서 검증 불가.

## 에러·스택 (Next 설정)

- `frontend/next.config.ts`에 스택 노출을 켜는 특이 설정 **없음**. 다만 **API 응답 본문의 `error.message`** 유출은 위 표 3번과 동일 이슈.

## 정보성 요약

- **서버 Supabase 클라이언트:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 사용(`lib/supabase/server.ts`). 실제 데이터 노출·쓰기 범위는 **RLS**에 크게 의존하므로, 대시보드 정책 점검을 권장.
- **클라이언트 UI:** `frontend/components/session-flow.tsx` 등에서 API 오류 시 `e.message` 표시 가능 — 서버가 상세 메시지를 주면 **연쇄 유출** 가능(표 3과 함께 정리).

---

*본 문서는 코드 수정 없이 OWASP 부분 영역 스킬 절차에 따른 감사 기록입니다.*
