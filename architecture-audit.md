# Next.js · TypeScript 아키텍처 점검 결과

> **스킬:** `nextjs-ts-architecture-audit`  
> **대상:** `frontend/` (Next.js App Router, TypeScript)  
> **일자:** 2026-03-28

## 발견 사항 (High / Medium / Low)

| 일련번호 | 우선순위 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
| 1 | High | `frontend/components/session-flow.tsx` | 파일 전체(약 837줄) | 단일 `SessionFlow`에 초기 로드·Realtime·타이머·제안/투표/마감·결과 UI까지 집중되어 **단일 책임·테스트·가독성** 부담이 큼. | 데이터/구독 훅 분리, 단계별 프레젠테이션 컴포넌트로 쪼개기. |
| 2 | High | `frontend/components/landing-page.tsx` | 파일 전체(약 788줄) | 팀 목록·참가·생성·폼 상태가 한 컴포넌트에 몰려 **50줄 기준을 크게 초과**하고 변경 영향 범위가 넓음. | 스텝/폼별 컴포넌트·공통 레이아웃 추출. |
| 3 | High | `frontend/app/api/sessions/[sessionId]/finalize/route.ts` | `POST` 핸들러(약 264줄) | 검증·집계·동점 처리·다중 테이블 삭제·응답 조립이 한 흐름에 연쇄되어 **SRP 위반** 및 회귀 위험이 큼. | 도메인 서비스 모듈로 분리, Route Handler는 얇게 유지. |
| 4 | High | `frontend/components/session-flow.tsx`, `frontend/app/api/sessions/[sessionId]/proposals/route.ts` | 각각 `normalizeMenu` | 메뉴 이름 정규화가 **클라이언트·서버에 이중 정의**되어 한쪽만 수정 시 불일치 가능. | `lib/menu-normalize.ts` 등 공통 모듈로 통일. |
| 5 | Medium | `frontend/app/api/**/route.ts` (다수) | JSON 본문 처리 | `request.json()` 후 `as Record<string, unknown>` 패턴이 **반복**됨. | 공통 `readJsonBody` 또는 스키마 검증(zod 등)으로 통일. |
| 6 | Medium | `frontend/app/api/**/route.ts` (다수) | Supabase 행 필드 접근 | `row.field as string` 등 **런타임 검증 없는 단언**이 반복되어 타입 안전성이 약함. | Supabase 생성 `Database` 타입 또는 테이블별 Row 인터페이스. |
| 7 | Medium | `frontend/lib/invite-code.ts` | 모듈 전체 | `generateTeamJoinPassword`가 **프로젝트 내 import되지 않음**. | 사용 계획 없으면 제거, 있으면 팀 생성 플로우에 연결. |
| 8 | Medium | `frontend/lib/server-origin.ts` | 모듈 전체 | `getServerOrigin`이 **호출처 없음**. | 서버 페칭에 쓸 계획이면 연결, 아니면 제거. |
| 9 | Low | `frontend/components/landing-page.tsx`, `frontend/components/team-dashboard.tsx` | `cardClass` / `btnPrimary` 등 | 유사 **카드·버튼 Tailwind** 상수가 파일마다 별도 존재. | 공유 UI 컴포넌트 또는 `cva`/클래스 유틸로 정리. |
| 10 | Low | `frontend/components/session-flow.tsx`, `frontend/components/team-dashboard.tsx` | 날짜 포맷 헬퍼 | `formatDisplayDate` vs `formatJoinedAt` 등 **Intl 포맷 분산**. | `lib/format-date.ts` 등으로 역할별 모음. |
| 11 | Low | API JSON vs React | 필드명 | `member_id`, `vote_started_at` 등 **snake_case**와 props **camelCase** 공존(도메인상 자연스러움). | README 등에 경계·매핑 규칙 한 줄 명시. |
| 12 | Low | `frontend/components/session-flow.tsx` 등 | props | `SessionFlow`는 `teamId`만 받고 하위는 주로 로컬 상태·훅 사용. | **과도한 props drilling은 현재 수준에서 문제 없음**(양호). |

## 항목별 요약

### 타입 (`any`, 느슨한 타입)

- `frontend/` 내 `.ts`/`.tsx`에서 **`any` 키워드 사용은 검색상 없음**.
- 대신 **`Record<string, unknown>` + 필드 수동 추출**과 Supabase 결과에 대한 **`as` 단언**이 널리 쓰임 → 표 5·6번과 같이 **구조적 타입 강화** 여지가 있음.

### 네이밍·파일 컨벤션

- 컴포넌트 파일은 **kebab-case**, export는 **PascalCase** 위주로 일관됨.
- REST 응답은 **snake_case**, `types/index.ts`의 도메인 타입도 API에 맞춰 snake_case 필드를 사용.

### 불필요한 의존성

- **npm 패키지**는 규모 대비 과하지 않음.
- **미사용 로컬 모듈:** 표 7·8번(`invite-code.ts`, `server-origin.ts`).

### props drilling

- 깊은 트리로 동일 props를 반복 전달하는 패턴은 **두드러지지 않음**(표 12번).

---

*본 문서는 코드 수정 없이 `nextjs-ts-architecture-audit` 스킬 절차에 따른 점검 기록입니다.*
