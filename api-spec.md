# 오늘의 메뉴 추천 — API 명세 (api-spec.md)

이 문서는 프론트엔드와 백엔드(Supabase)가 **어떤 데이터를 주고받는지** 정리합니다.
모든 API는 Next.js App Router의 **Route Handler** (`app/api/.../route.ts`)로 구현합니다.

> 공통 사항
> - 응답 형식: **JSON**
> - 날짜/시간: **ISO 8601** (`2026-03-27T12:00:00Z`)
> - ID: **UUID** (`"550e8400-e29b-41d4-a716-446655440000"`)
> - 에러 응답: `{ "error": "에러 메시지" }` + 적절한 HTTP 상태 코드

---

## 1. 팀

### 1-1. 팀 생성

새 팀을 만들고 초대 코드를 받는다.

```
POST /api/teams
```

**요청 (Body)**

```json
{
  "name": "개발팀"
}
```

**응답 (201 Created)**

```json
{
  "id": "a1b2c3d4-...",
  "name": "개발팀",
  "invite_code": "X7K9M2",
  "created_at": "2026-03-27T01:00:00Z"
}
```

---

### 1-2. 초대 코드로 팀 참가

초대 코드를 입력하면 해당 팀에 멤버로 등록된다.

```
POST /api/teams/join
```

**요청 (Body)**

```json
{
  "invite_code": "X7K9M2",
  "nickname": "홍길동"
}
```

**응답 (201 Created)**

```json
{
  "member": {
    "id": "m1m2m3m4-...",
    "team_id": "a1b2c3d4-...",
    "nickname": "홍길동",
    "created_at": "2026-03-27T01:05:00Z"
  },
  "team": {
    "id": "a1b2c3d4-...",
    "name": "개발팀"
  }
}
```

**에러 예시 (404)**

```json
{
  "error": "존재하지 않는 초대 코드입니다."
}
```

---

### 1-3. 팀 멤버 목록 조회

```
GET /api/teams/{teamId}/members
```

**응답 (200 OK)**

```json
{
  "members": [
    { "id": "m1m2m3m4-...", "nickname": "홍길동", "created_at": "2026-03-27T01:05:00Z" },
    { "id": "m5m6m7m8-...", "nickname": "김영희", "created_at": "2026-03-27T01:06:00Z" }
  ]
}
```

---

## 2. 세션

### 2-1. 오늘의 세션 조회 (없으면 자동 생성)

팀의 오늘 날짜 세션을 가져온다. 아직 없으면 새로 만들어 준다.

```
GET /api/teams/{teamId}/sessions/today
```

**응답 (200 OK)**

```json
{
  "id": "s1s2s3s4-...",
  "team_id": "a1b2c3d4-...",
  "date": "2026-03-27",
  "status": "proposing",
  "vote_started_at": null,
  "decided_menu": null,
  "created_at": "2026-03-27T02:00:00Z"
}
```

> `status` 값: `"proposing"` → `"voting"` → `"completed"`

---

### 2-2. 특정 세션 상세 조회

이력에서 과거 세션을 눌렀을 때 사용.

```
GET /api/sessions/{sessionId}
```

**응답 (200 OK)**

```json
{
  "id": "s1s2s3s4-...",
  "team_id": "a1b2c3d4-...",
  "date": "2026-03-26",
  "status": "completed",
  "vote_started_at": "2026-03-26T03:10:00Z",
  "decided_menu": "김치찌개",
  "created_at": "2026-03-26T02:00:00Z",
  "proposals": [
    { "id": "p1...", "menu_name": "김치찌개", "nickname": "홍길동", "vote_count": 3 },
    { "id": "p2...", "menu_name": "초밥",     "nickname": "김영희", "vote_count": 1 }
  ]
}
```

---

## 3. 메뉴 제안

### 3-1. 메뉴 제안 등록

```
POST /api/sessions/{sessionId}/proposals
```

**요청 (Body)**

```json
{
  "member_id": "m1m2m3m4-...",
  "menu_name": "김치찌개"
}
```

**응답 (201 Created)**

```json
{
  "id": "p1p2p3p4-...",
  "session_id": "s1s2s3s4-...",
  "member_id": "m1m2m3m4-...",
  "menu_name": "김치찌개",
  "created_at": "2026-03-27T02:05:00Z"
}
```

**에러 예시 (409 Conflict)**

```json
{
  "error": "이미 같은 메뉴가 제안되어 있습니다."
}
```

---

### 3-2. 제안 목록 조회

현재 세션에 등록된 메뉴 제안 전체를 가져온다.

```
GET /api/sessions/{sessionId}/proposals
```

**응답 (200 OK)**

```json
{
  "proposals": [
    {
      "id": "p1p2p3p4-...",
      "menu_name": "김치찌개",
      "member_id": "m1m2m3m4-...",
      "nickname": "홍길동",
      "created_at": "2026-03-27T02:05:00Z"
    },
    {
      "id": "p5p6p7p8-...",
      "menu_name": "초밥",
      "member_id": "m5m6m7m8-...",
      "nickname": "김영희",
      "created_at": "2026-03-27T02:06:00Z"
    }
  ],
  "all_proposed": false
}
```

> `all_proposed`가 `true`이면 모든 팀원이 제안을 완료했다는 뜻 → 투표 전환 가능

---

### 3-3. 제안 마감 → 투표 시작

모든 팀원이 제안을 완료했을 때 호출. 세션 상태를 `voting`으로 바꾸고 타이머를 시작한다.

```
POST /api/sessions/{sessionId}/start-voting
```

**요청 (Body)** — 없음

**응답 (200 OK)**

```json
{
  "session_id": "s1s2s3s4-...",
  "status": "voting",
  "vote_started_at": "2026-03-27T02:10:00Z",
  "vote_ends_at": "2026-03-27T02:20:00Z"
}
```

> `vote_ends_at`은 `vote_started_at + 10분`으로 계산해서 내려준다.
> 프론트엔드는 이 값을 기준으로 카운트다운을 표시한다.

---

## 4. 투표

### 4-1. 투표하기 (1인 1표)

```
POST /api/sessions/{sessionId}/votes
```

**요청 (Body)**

```json
{
  "member_id": "m1m2m3m4-...",
  "proposal_id": "p5p6p7p8-..."
}
```

**응답 (201 Created)** — 첫 투표

```json
{
  "id": "v1v2v3v4-...",
  "session_id": "s1s2s3s4-...",
  "member_id": "m1m2m3m4-...",
  "proposal_id": "p5p6p7p8-...",
  "created_at": "2026-03-27T02:12:00Z"
}
```

**응답 (200 OK)** — 투표 변경 (기존 투표를 덮어쓴 경우)

```json
{
  "id": "v1v2v3v4-...",
  "session_id": "s1s2s3s4-...",
  "member_id": "m1m2m3m4-...",
  "proposal_id": "p1p2p3p4-...",
  "updated": true
}
```

**에러 예시 (403 Forbidden)**

```json
{
  "error": "투표가 이미 마감되었습니다."
}
```

---

### 4-2. 투표 현황 조회

각 메뉴가 현재 몇 표를 받았는지 확인한다.

```
GET /api/sessions/{sessionId}/votes
```

**응답 (200 OK)**

```json
{
  "results": [
    { "proposal_id": "p1...", "menu_name": "김치찌개", "vote_count": 3 },
    { "proposal_id": "p5...", "menu_name": "초밥",     "vote_count": 1 }
  ],
  "total_members": 5,
  "voted_count": 4,
  "all_voted": false
}
```

> `all_voted`가 `true`이면 전원 투표 완료 → 바로 마감 가능

---

### 4-3. 투표 마감 → 결과 확정

타이머가 끝나거나 전원 투표가 완료되면 호출. 최다 득표 메뉴를 선정한다.

```
POST /api/sessions/{sessionId}/finalize
```

**요청 (Body)** — 없음

**응답 (200 OK)**

```json
{
  "session_id": "s1s2s3s4-...",
  "status": "completed",
  "decided_menu": "김치찌개",
  "is_tie_broken": false,
  "results": [
    { "menu_name": "김치찌개", "vote_count": 3, "rank": 1 },
    { "menu_name": "초밥",     "vote_count": 1, "rank": 2 }
  ]
}
```

> `is_tie_broken`이 `true`이면 동점이 있었고 랜덤으로 선정된 것.

---

## 5. 메뉴 이력

### 5-1. 최근 메뉴 결정 이력 조회

```
GET /api/teams/{teamId}/history?page=1&limit=10
```

**응답 (200 OK)**

```json
{
  "history": [
    {
      "session_id": "s1s2s3s4-...",
      "date": "2026-03-27",
      "decided_menu": "김치찌개",
      "vote_count": 3,
      "total_members": 5
    },
    {
      "session_id": "sAbCdEf0-...",
      "date": "2026-03-26",
      "decided_menu": "비빔밥",
      "vote_count": 4,
      "total_members": 5
    }
  ],
  "page": 1,
  "limit": 10,
  "has_next": true
}
```

---

## 6. 실시간 (Supabase Realtime)

API 호출과 별도로, 프론트엔드는 **Supabase Realtime**을 구독하여 화면을 자동 갱신한다.

| 구독 대상 테이블 | 이벤트 | 화면 반영 |
|------------------|--------|-----------|
| `proposals` | INSERT | 새 메뉴 제안이 카드로 추가됨 |
| `votes` | INSERT / UPDATE | 각 메뉴의 득표 수가 실시간 변경 |
| `sessions` | UPDATE | 세션 상태 변경 (proposing → voting → completed) 감지 |

### 구독 예시 (프론트엔드 코드 형태)

```typescript
supabase
  .channel('session-proposals')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'proposals',
      filter: `session_id=eq.${sessionId}`,
    },
    (payload) => {
      // payload.new → 새로 등록된 제안 데이터
      // 제안 목록에 추가
    }
  )
  .subscribe()
```

---

## 7. API 경로 요약

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/teams` | 팀 생성 |
| POST | `/api/teams/join` | 초대 코드로 팀 참가 |
| GET | `/api/teams/{teamId}/members` | 팀 멤버 목록 |
| GET | `/api/teams/{teamId}/sessions/today` | 오늘의 세션 조회/생성 |
| GET | `/api/teams/{teamId}/history` | 메뉴 결정 이력 |
| GET | `/api/sessions/{sessionId}` | 세션 상세 (이력 상세) |
| POST | `/api/sessions/{sessionId}/proposals` | 메뉴 제안 등록 |
| GET | `/api/sessions/{sessionId}/proposals` | 제안 목록 조회 |
| POST | `/api/sessions/{sessionId}/start-voting` | 투표 시작 |
| POST | `/api/sessions/{sessionId}/votes` | 투표하기 |
| GET | `/api/sessions/{sessionId}/votes` | 투표 현황 조회 |
| POST | `/api/sessions/{sessionId}/finalize` | 투표 마감·결과 확정 |

---

## 8. 에러 코드 정리

| HTTP 상태 | 의미 | 예시 |
|-----------|------|------|
| 400 | 잘못된 요청 | 필수 필드 누락, 빈 메뉴명 |
| 403 | 권한 없음 / 허용되지 않음 | 마감된 투표에 투표 시도 |
| 404 | 리소스 없음 | 존재하지 않는 초대 코드, 세션 ID |
| 409 | 충돌 | 이미 존재하는 메뉴 제안, 중복 팀 참가 |
| 500 | 서버 오류 | DB 연결 실패 등 |
