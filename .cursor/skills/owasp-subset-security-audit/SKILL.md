---
name: owasp-subset-security-audit
description: >-
  Runs OWASP-oriented security audits on application code for (1) SQL injection
  and unsafe query construction, (2) session and token safety (expiry, replay,
  binding), (3) error and stack trace disclosure to clients, and (4) bcrypt
  usage (cost factor at least 12, no plaintext password comparison). Produces a
  Korean markdown table with Critical / High / Medium only. Use when the user
  asks for OWASP, 보안 감사, SQL 인젝션, 세션 관리, 에러 유출, bcrypt 점검, or a
  security architect-style review without implementing fixes unless explicitly
  requested.
---

# OWASP 부분 영역 보안 감사 (SQL·세션·에러·Bcrypt)

## 역할

시니어 보안 아키텍트 관점에서, 아래 네 가지만 집중해 코드·설정을 검토한다. **사용자가 코드 수정을 요청하지 않으면 리포트만 작성**한다.

## 검토 항목 (필수)

### 1. SQL 인젝션

- Raw SQL 문자열 연결, 템플릿 리터럴로 쿼리 조립, ORM의 비바인딩 실행 경로 확인.
- Supabase/PostgREST: `.from().select().eq()` 등은 일반적으로 파라미터화됨. `rpc()` 인자, Edge Function, 마이그레이션 SQL은 별도 확인.

### 2. 세션 관리

- 서버가 발급·검증하는 세션/토큰 존재 여부, 만료·갱신, 재사용·고정 완화 여부.
- 클라이언트만 `member_id`·UUID 등을 신뢰하는 패턴(IDOR/스푸핑) 여부.
- `sessionStorage`/`localStorage`에 비밀·참가 코드 평문 보관 여부(XSS 시 유출).

### 3. 에러 메시지 정보 유출

- API가 `error.message`, DB/Postgres/Supabase 원문을 클라이언트에 그대로 반환하는지.
- 클라이언트 UI에 `e.message` 등으로 서버 상세를 노출하는지.
- 프로덕션에서 스택 트레이스 노출 가능 경로(`next.config`, 글로벌 에러 핸들러).

### 4. Bcrypt 규칙

- `bcrypt.hash` / `bcrypt.compare` 사용 여부, **cost(salt rounds) ≥ 12** 준수.
- 비밀번호·참가 코드 등 **평문 저장·평문 문자열 비교(`===`) 금지** 여부.
- 패키지에 `bcrypt`/`bcryptjs`가 없으면 “미사용”으로 명시하고, 평문 비교가 있으면 별도 항목으로 기록.

## 심각도

| 등급 | 기준 요약 |
|------|-----------|
| **Critical** | 즉시 악용 가능한 인증 우회·광범위 데이터 유출·원격 코드 실행 등 |
| **High** | 실질적 침해 가능성이 큼(평문 시크릿, 무인증 행위 위조, 심각한 유출) |
| **Medium** | 조건부 악용·정보 유출·심화 시 High로 이어질 수 있는 설계 결함 |

(정보성·양호만 해당하면 표에 넣지 않고 서술로 한 줄 요약 가능.)

## 출력 형식 (필수)

사용자가 다른 형식을 지정하지 않으면 아래 표를 사용한다. **일련번호는 실제 발견 항목만** 채운다.

```markdown
| 일련번호 | 심각도 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
| 1 | High | `path/to/file.ts` | 대략적 라인·함수 | … | … |
```

## 작업 절차

1. `package.json`에서 DB/ORM/bcrypt 관련 의존성 확인.
2. `grep` 또는 검색: `queryRaw`, `` `.from(` ``, `rpc(`, `bcrypt`, `password`, `jsonError`, `error.message`, `stack`, `sessionStorage`.
3. API Route Handlers(`app/api/**/route.ts`)의 오류 응답 패턴 일괄 확인.
4. 인증·식별자가 요청 본문/헤더에서 어떻게 신뢰되는지 추적.
5. 저장소에 SQL 마이그레이션이 있으면 RLS·함수 정의까지 검토; 없으면 “DB 정책은 대시보드/별도 저장소 확인 필요”를 명시.

## 추가 자료 (선택)

같은 폴더에 `reference.md`를 두어 OWASP Top 10 매핑 예시를 넣을 수 있다. 기본적으로는 이 `SKILL.md`만 읽어도 동작하도록 유지한다.
