---
name: 오늘의 메뉴 추천 — 개발 계획
overview: 직장인 팀을 위한 메뉴 투표 서비스를 3단계(초기 셋업 → 목업 → Supabase 연동)로 개발한다. 1단계 완료 전 2단계 진행 금지.
todos:
  - id: 0a
    content: 0-A. frontend/ 폴더에 Next.js 프로젝트 생성 (App Router, TypeScript, Tailwind CSS) + dev 서버 확인
    status: completed
  - id: 0b
    content: 0-B. 페이지 라우트 디렉터리 생성 (page, team/[teamId], session, history) + 공용 폴더 (lib, components, data, types)
    status: completed
  - id: 0c
    content: 0-C. 공통 설정 — layout.tsx, globals.css, types/index.ts (Team·Member·Session·Proposal·Vote), data/mockData.ts 작성
    status: completed
  - id: 1a
    content: 1-A. 랜딩 페이지 — 팀 생성 폼 + 팀 참가 폼 (목업 데이터로 이동) + 에러 처리
    status: completed
  - id: 1b
    content: 1-B. 팀 대시보드 — 팀 이름·초대 코드(복사)·팀원 목록 + 세션/이력 이동 버튼
    status: completed
  - id: 1c
    content: 1-C. 세션 제안 단계 — 메뉴 입력·중복 방지·제안 카드 목록·제안 현황·투표 시작 버튼
    status: completed
  - id: 1d
    content: 1-D. 세션 투표 단계 — 10분 카운트다운 타이머·메뉴 카드 투표·하이라이트·득표 수·자동 마감
    status: completed
  - id: 1e
    content: 1-E. 세션 결과 단계 — 선정 메뉴 강조·동점 랜덤 안내·전체 결과 바 차트·네비게이션 버튼
    status: completed
  - id: 1f
    content: 1-F. 이력 페이지 — 이력 목록(날짜·메뉴·득표)·세션 상세 페이지·돌아가기 버튼
    status: completed
  - id: 1g
    content: 1-G. 전체 플로우 점검 — 전체 경로 이동·뒤로 가기·반응형·사용자 최종 목업 승인
    status: completed
  - id: 2a
    content: 2-A. Supabase 연결 — @supabase/supabase-js 설치·.env.local·client.ts/server.ts·연결 테스트
    status: completed
  - id: 2b
    content: 2-B. DB 테이블 생성(MCP) — teams·members·sessions·proposals·votes + RLS + Realtime 활성화
    status: completed
  - id: 2c
    content: 2-C. API 팀 — POST /api/teams, POST /api/teams/join, GET /api/teams/[teamId]/members
    status: completed
  - id: 2d
    content: 2-D. API 세션 — GET /api/teams/[teamId]/sessions/today, GET /api/sessions/[sessionId]
    status: completed
  - id: 2e
    content: 2-E. API 제안 — POST·GET proposals, POST start-voting
    status: completed
  - id: 2f
    content: 2-F. API 투표 — POST·GET votes, POST finalize (동점 랜덤 처리 포함)
    status: completed
  - id: 2g
    content: 2-G. API 이력 — GET /api/teams/[teamId]/history (페이지네이션)
    status: completed
  - id: 2h
    content: 2-H. 프론트엔드 mockData → API 호출 교체 (랜딩·대시보드·세션·이력 전체)
    status: completed
  - id: 2i
    content: 2-I. Supabase Realtime 연동 — proposals INSERT·votes INSERT/UPDATE·sessions UPDATE 구독 + cleanup
    status: completed
  - id: 2j
    content: 2-J. 전체 통합 테스트 — E2E 흐름·예외 상황·반응형·코드 정리
    status: completed
isProject: true
---

# 오늘의 메뉴 추천 — 개발 계획 ([plan.md](http://plan.md))

> **중요 규칙**
>
> - 1단계(목업)가 **완전히 끝나고 사용자가 승인**하기 전에는 절대 2단계로 넘어가지 않는다.
> - 각 섹션이 끝나면 반드시 **멈추고** 사용자에게 다음 진행 여부를 확인한다.
> - 참조 문서: `spec.md` (서비스 명세), `api-spec.md` (API 명세)

---

## 0단계: 프로젝트 초기 셋업

### 0-A. Next.js 프로젝트 생성

- `frontend/` 폴더 안에 Next.js 프로젝트 생성 (App Router, TypeScript, Tailwind CSS)
- 불필요한 보일러플레이트 정리 (기본 페이지 내용 비우기)
- `npm run dev`로 개발 서버 정상 실행 확인

### 0-B. 폴더 구조 잡기

- 페이지 라우트 디렉터리 생성
  - `app/page.tsx` (랜딩)
  - `app/team/[teamId]/page.tsx` (팀 대시보드)
  - `app/team/[teamId]/session/page.tsx` (오늘의 세션)
  - `app/team/[teamId]/session/[sessionId]/page.tsx` (세션 상세)
  - `app/team/[teamId]/history/page.tsx` (이력)
- 공용 폴더 생성
  - `lib/` — 유틸리티, Supabase 클라이언트 (2단계에서 사용)
  - `components/` — 공통 컴포넌트
  - `data/` — 목업 데이터 (`mockData.ts`)
  - `types/` — TypeScript 타입 정의

### 0-C. 공통 설정

- `app/layout.tsx` — 공통 레이아웃 (HTML 구조, 폰트, Tailwind)
- `app/globals.css` — Tailwind 기본 확인
- `types/index.ts` — 공통 타입 정의
  - `Team`, `Member`, `Session`, `Proposal`, `Vote` 인터페이스
- `data/mockData.ts` — 하드코딩 목업 데이터 작성
  - 팀 1개 (이름, 초대 코드)
  - 멤버 3~4명
  - 세션 여러 개 (proposing / voting / completed 각 1개)
  - 제안 메뉴 4~5개
  - 투표 데이터
  - 이력 데이터 (최근 7일치)

> **0단계 완료 → 사용자 확인 후 1단계 진행**

---

## 1단계: 목업 (Mock Data로 전체 플로우 구현)

> Supabase 연동 없이, `data/mockData.ts`의 하드코딩 데이터만 사용한다.
> 모든 화면을 클릭해서 전체 흐름을 확인할 수 있는 수준으로 구현한다.

### 섹션 1-A. 랜딩 페이지

- `app/page.tsx` UI 구현
- 팀 생성 폼
  - 팀 이름 입력 필드
  - "팀 만들기" 버튼
  - 버튼 클릭 시 → 목업 팀 데이터로 팀 대시보드 페이지(`/team/[teamId]`)로 이동
- 팀 참가 폼
  - 초대 코드 입력 필드
  - 닉네임 입력 필드
  - "참가하기" 버튼
  - 버튼 클릭 시 → 목업 데이터 기반 팀 대시보드 페이지로 이동
- 잘못된 초대 코드 입력 시 에러 메시지 표시
- 브라우저에서 화면 확인

> **섹션 1-A 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-B. 팀 대시보드

- `app/team/[teamId]/page.tsx` UI 구현
- 팀 이름 표시
- 초대 코드 표시 + 복사 버튼
  - 클릭 시 클립보드 복사 + "복사됨" 피드백
- 팀원 목록 표시 (목업 멤버 데이터)
  - 닉네임, 참가 시각
- "오늘의 메뉴 정하기" 버튼
  - 클릭 시 → 세션 페이지(`/team/[teamId]/session`)로 이동
- "메뉴 이력 보기" 버튼
  - 클릭 시 → 이력 페이지(`/team/[teamId]/history`)로 이동
- 브라우저에서 화면 확인

> **섹션 1-B 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-C. 세션 — 제안 단계 (proposing)

- `app/team/[teamId]/session/page.tsx` UI 구현
- 세션 상태에 따라 화면 분기 (`proposing` / `voting` / `completed`)
- 제안 단계 UI
  - 현재 날짜 + "제안 중" 상태 배지 표시
  - 메뉴 제안 입력 필드 + "제안하기" 버튼
  - 버튼 클릭 시 → 목업 제안 목록에 추가 (로컬 state)
  - 빈 문자열 제출 방지 (유효성 검사)
  - 중복 메뉴 제출 시 에러 메시지 표시
- 등록된 제안 목록을 카드 형태로 표시
  - 각 카드: 메뉴명 + 제안자 닉네임
- 팀원 제안 현황 표시 ("3/4명 제안 완료")
- 모든 팀원 제안 완료 시 → "투표 시작" 버튼 활성화
  - 버튼 클릭 시 → 화면이 투표 단계로 전환
- 브라우저에서 화면 확인

> **섹션 1-C 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-D. 세션 — 투표 단계 (voting)

- 투표 단계 UI (같은 세션 페이지, 상태 분기)
- 카운트다운 타이머 컴포넌트
  - 10:00에서 시작하여 00:00까지 감소
  - MM:SS 형식 표시
  - 1분 이하일 때 빨간색으로 색상 변경
  - 0초 도달 시 자동으로 결과 단계로 전환
- 메뉴 카드 목록 (제안된 메뉴들)
  - 각 카드에 "투표" 버튼 표시
  - 카드 클릭/버튼 클릭 시 → 해당 메뉴에 투표 (로컬 state)
  - 현재 선택한 카드 하이라이트 처리
  - 다른 카드 클릭 시 → 투표 변경 (이전 하이라이트 해제)
- 각 메뉴의 현재 득표 수 표시
- 투표 현황 표시 ("4/5명 투표 완료")
- 전원 투표 완료 시 → 자동으로 결과 단계로 전환
- 브라우저에서 화면 확인 (타이머 동작 포함)

> **섹션 1-D 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-E. 세션 — 결과 단계 (completed)

- 결과 단계 UI (같은 세션 페이지, 상태 분기)
- 선정된 메뉴 크게 강조 표시 (이름 + 축하 UI)
- 동점 랜덤 선정인 경우 "동점 → 랜덤 선정" 안내 문구
- 전체 투표 결과 요약
  - 각 메뉴: 순위 + 메뉴명 + 득표 수
  - 바 차트 또는 프로그레스 바 형태로 시각화
- "팀 대시보드로 돌아가기" 버튼
- "이력 보기" 버튼
- 브라우저에서 화면 확인

> **섹션 1-E 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-F. 이력 페이지

- `app/team/[teamId]/history/page.tsx` UI 구현
- 이력 목록 표시 (목업 데이터)
  - 각 행: 날짜 · 선정 메뉴 · 득표 수 / 전체 인원
  - 테이블 또는 카드 리스트 형태
- 각 행 클릭 시 → 세션 상세 페이지(`/team/[teamId]/session/[sessionId]`)로 이동
- `app/team/[teamId]/session/[sessionId]/page.tsx` UI 구현
  - 해당 날짜의 전체 제안 목록 + 투표 결과 표시
  - "목록으로 돌아가기" 버튼
- 브라우저에서 화면 확인

> **섹션 1-F 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 1-G. 전체 플로우 점검

- 전체 경로 이동 확인: 랜딩 → 팀 대시보드 → 세션(제안→투표→결과) → 이력 → 이력 상세
- 뒤로 가기 / 네비게이션 정상 동작
- 반응형 확인 (모바일 화면에서도 깨지지 않는지)
- 사용자에게 최종 목업 승인 요청

> **1단계 전체 완료 + 사용자 승인 → 그제서야 2단계 진행**

---

## 2단계: 실제 구현 (Supabase 연동)

> 1단계 목업 플로우 검증이 **완료된 후에만** 시작한다.
> `mockData.ts`를 Supabase API 호출로 교체한다.
> Supabase 작업은 **Supabase MCP**를 사용한다.
> Supabase 프로젝트 이름: **vibe-tutorial**

### 섹션 2-A. Supabase 프로젝트 연결

- `@supabase/supabase-js` 패키지 설치 (`frontend/`)
- `.env.local` 파일 생성
  - `NEXT_PUBLIC_SUPABASE_URL` 설정
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정
- Supabase 클라이언트 유틸 생성
  - `lib/supabase/client.ts` — 브라우저용 클라이언트
  - `lib/supabase/server.ts` — 서버(Route Handler)용 클라이언트
- 연결 테스트 (간단한 쿼리로 응답 확인)

> **섹션 2-A 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-B. 데이터베이스 테이블 생성 (Supabase MCP)

- `teams` 테이블 생성
  - id (uuid, PK, default gen_random_uuid())
  - name (text, NOT NULL)
  - invite_code (text, UNIQUE, NOT NULL)
  - created_at (timestamptz, default now())
- `members` 테이블 생성
  - id (uuid, PK, default gen_random_uuid())
  - team_id (uuid, FK → teams.id, ON DELETE CASCADE)
  - nickname (text, NOT NULL)
  - user_id (uuid, nullable)
  - created_at (timestamptz, default now())
- `sessions` 테이블 생성
  - id (uuid, PK, default gen_random_uuid())
  - team_id (uuid, FK → teams.id, ON DELETE CASCADE)
  - date (date, NOT NULL)
  - status (text, NOT NULL, default 'proposing')
  - vote_started_at (timestamptz, nullable)
  - decided_menu (text, nullable)
  - created_at (timestamptz, default now())
  - UNIQUE (team_id, date)
- `proposals` 테이블 생성
  - id (uuid, PK, default gen_random_uuid())
  - session_id (uuid, FK → sessions.id, ON DELETE CASCADE)
  - member_id (uuid, FK → members.id, ON DELETE CASCADE)
  - menu_name (text, NOT NULL)
  - created_at (timestamptz, default now())
  - UNIQUE (session_id, menu_name)
- `votes` 테이블 생성
  - id (uuid, PK, default gen_random_uuid())
  - session_id (uuid, FK → sessions.id, ON DELETE CASCADE)
  - member_id (uuid, FK → members.id, ON DELETE CASCADE)
  - proposal_id (uuid, FK → proposals.id, ON DELETE CASCADE)
  - created_at (timestamptz, default now())
  - UNIQUE (session_id, member_id)
- RLS 활성화 (모든 테이블)
- RLS 정책 설정 (anon 키로 CRUD 가능하도록 MVP용 정책)
- Supabase Realtime 활성화 (proposals, votes, sessions)
- MCP `list_tables`로 전체 테이블 생성 확인

> **섹션 2-B 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-C. API — 팀 생성 · 참가 · 멤버 조회

- `app/api/teams/route.ts` — POST 팀 생성
  - 6자리 초대 코드 자동 생성 로직
  - Supabase에 teams INSERT
  - 생성된 팀 데이터 응답 (201)
- `app/api/teams/join/route.ts` — POST 팀 참가
  - invite_code로 팀 조회
  - 없으면 404 에러 응답
  - members INSERT
  - member + team 데이터 응답 (201)
- `app/api/teams/[teamId]/members/route.ts` — GET 멤버 목록
  - team_id로 members SELECT
  - 멤버 배열 응답 (200)
- 각 API 동작 확인

> **섹션 2-C 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-D. API — 세션 조회 · 생성

- `app/api/teams/[teamId]/sessions/today/route.ts` — GET 오늘의 세션
  - team_id + 오늘 날짜로 sessions SELECT
  - 없으면 자동 INSERT (status: 'proposing')
  - 세션 데이터 응답 (200)
- `app/api/sessions/[sessionId]/route.ts` — GET 세션 상세
  - session_id로 sessions SELECT
  - proposals + votes 집계 JOIN
  - 세션 + 제안 목록 + 득표 수 응답 (200)
- 각 API 동작 확인

> **섹션 2-D 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-E. API — 메뉴 제안 등록 · 조회 · 투표 시작

- `app/api/sessions/[sessionId]/proposals/route.ts` — POST 제안 등록
  - 세션 상태가 'proposing'인지 검증 (아니면 403)
  - 중복 메뉴 검사 (있으면 409)
  - proposals INSERT
  - 생성된 제안 응답 (201)
- `app/api/sessions/[sessionId]/proposals/route.ts` — GET 제안 목록
  - session_id로 proposals SELECT (+ member nickname JOIN)
  - all_proposed 계산 (제안한 멤버 수 vs 전체 멤버 수)
  - 제안 배열 + all_proposed 응답 (200)
- `app/api/sessions/[sessionId]/start-voting/route.ts` — POST 투표 시작
  - 세션 상태가 'proposing'인지 검증
  - 제안이 1개 이상인지 검증
  - sessions UPDATE (status → 'voting', vote_started_at → now())
  - vote_ends_at 계산 (vote_started_at + 10분)
  - 응답 (200)
- 각 API 동작 확인

> **섹션 2-E 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-F. API — 투표 · 현황 조회 · 결과 확정

- `app/api/sessions/[sessionId]/votes/route.ts` — POST 투표하기
  - 세션 상태가 'voting'인지 검증 (아니면 403)
  - 투표 시간 만료 검증 (vote_started_at + 10분 초과 시 403)
  - 기존 투표 여부 확인 → UPSERT (첫 투표 201 / 변경 200)
- `app/api/sessions/[sessionId]/votes/route.ts` — GET 투표 현황
  - proposals별 vote_count 집계
  - total_members, voted_count, all_voted 계산
  - 응답 (200)
- `app/api/sessions/[sessionId]/finalize/route.ts` — POST 결과 확정
  - 세션 상태가 'voting'인지 검증
  - 최다 득표 메뉴 계산
  - 동점 처리 (랜덤 선정 + is_tie_broken 플래그)
  - sessions UPDATE (status → 'completed', decided_menu 저장)
  - 결과 응답 (200)
- 각 API 동작 확인

> **섹션 2-F 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-G. API — 이력 조회

- `app/api/teams/[teamId]/history/route.ts` — GET 이력 목록
  - team_id + status='completed'로 sessions SELECT
  - 날짜 내림차순 정렬
  - 페이지네이션 (page, limit 쿼리 파라미터)
  - has_next 계산
  - 응답 (200)
- API 동작 확인

> **섹션 2-G 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-H. 프론트엔드 — mockData를 API 호출로 교체

- 랜딩 페이지
  - 팀 생성 → `POST /api/teams` 호출로 교체
  - 팀 참가 → `POST /api/teams/join` 호출로 교체
- 팀 대시보드
  - 멤버 목록 → `GET /api/teams/[teamId]/members` 호출로 교체
- 세션 페이지 — 제안 단계
  - 세션 조회 → `GET /api/teams/[teamId]/sessions/today` 호출로 교체
  - 제안 등록 → `POST /api/sessions/[sessionId]/proposals` 호출로 교체
  - 제안 목록 → `GET /api/sessions/[sessionId]/proposals` 호출로 교체
  - 투표 시작 → `POST /api/sessions/[sessionId]/start-voting` 호출로 교체
- 세션 페이지 — 투표 단계
  - 투표 → `POST /api/sessions/[sessionId]/votes` 호출로 교체
  - 투표 현황 → `GET /api/sessions/[sessionId]/votes` 호출로 교체
  - 타이머 종료 시 → `POST /api/sessions/[sessionId]/finalize` 호출로 교체
- 세션 페이지 — 결과 단계
  - 결과 데이터 → finalize 응답 또는 세션 상세 API에서 표시
- 이력 페이지
  - 이력 목록 → `GET /api/teams/[teamId]/history` 호출로 교체
  - 이력 상세 → `GET /api/sessions/[sessionId]` 호출로 교체
- `data/mockData.ts` 더 이상 사용하지 않는 것 확인 (삭제 또는 보관)

> **섹션 2-H 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-I. Supabase Realtime 연동

- 제안 실시간 구독
  - proposals 테이블 INSERT 이벤트 구독
  - 새 제안 등록 시 제안 목록 자동 갱신
- 투표 실시간 구독
  - votes 테이블 INSERT / UPDATE 이벤트 구독
  - 투표 시 득표 수 자동 갱신
- 세션 상태 실시간 구독
  - sessions 테이블 UPDATE 이벤트 구독
  - proposing → voting → completed 전환 시 화면 자동 전환
- 컴포넌트 언마운트 시 구독 해제 (cleanup)
- 브라우저 두 개로 실시간 동작 확인

> **섹션 2-I 완료 → 멈추고 사용자에게 다음 진행 여부 확인**

### 섹션 2-J. 전체 통합 테스트 · 마무리

- 전체 흐름 E2E 확인: 팀 생성 → 참가 → 제안 → 투표 → 결과 → 이력
- 예외 상황 테스트
  - 중복 메뉴 제안 → 에러 메시지
  - 투표 마감 후 투표 시도 → 에러 메시지
  - 동점 → 랜덤 선정 표시
- 반응형 확인 (모바일)
- 불필요한 console.log 제거
- 코드 정리

> **2단계 전체 완료 → 사용자 최종 확인**

