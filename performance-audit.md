# Next.js · Supabase 성능 감사 결과

> **스킬:** `nextjs-supabase-performance-audit`  
> **대상:** `frontend/` (Next.js App Router, Supabase 클라이언트·API Routes)  
> **일자:** 2026-03-28  
> **참고:** 본 문서는 **성능** 감사 기록입니다. 파일명은 요청에 따른 것이며, 내용은 보안이 아닙니다.

## 발견 사항 (Critical / High / Medium)

| 일련번호 | 심각도 | 파일 | 위치 | 문제 | 권고사항 |
|---|---|---|---|---|---|
| 1 | High | `frontend/components/session-flow.tsx` | Supabase Realtime `postgres_changes` 콜백 | 제안·투표·세션 변경마다 `loadProposals` / `loadVotes` / `loadSession`으로 전체 REST 재조회. 구독자·이벤트 수에 비례해 요청이 급증할 수 있음. | 디바운스·스로틀, Realtime 페이로드만으로 UI 갱신 가능 여부 검토, 또는 폴링 간격 조정. |
| 2 | High | `frontend/components/session-flow.tsx` | `handlePropose` 성공 후 `loadProposals` 호출 | 제안 POST 직후 수동 refetch와 Realtime INSERT 알림이 겹치면 동일 데이터에 대한 중복 페칭이 발생하기 쉬움. | 낙관적 UI + Realtime 한쪽으로 정리하거나, 짧은 디바운스로 합치기. |
| 3 | Medium | `frontend/components/session-flow.tsx` | 초기 마운트 `useEffect` (세션 로드 후 proposals → votes 순차) | `session.id` 확보 이후에도 제안·투표 로드가 순차면 물결(waterfall) 지연. | 투표 단계에서는 `Promise.all`로 `loadProposals`와 `loadVotes` 병렬 호출 검토. |
| 4 | Medium | `frontend/app/api/sessions/[sessionId]/votes/route.ts` 등 | GET 핸들러 내 다중 `await` 쿼리 | 세션 → 제안 → 투표 → 멤버 count 등 순차 Supabase 왕복으로 핸들러 지연·커넥션 사용 증가. | 뷰·RPC·단일 집계 쿼리로 묶거나 캐시 전략 검토. |
| 5 | Medium | `frontend/app/api/sessions/[sessionId]/proposals/route.ts`, `votes/route.ts`, `start-voting/route.ts` | `.select("*", { count: "exact", head: true })` | `head: true`로 행은 내려오지 않으나, 카운트 전용 의도는 `id` 등 최소 컬럼 명시가 더 명확함. | 예: `select("id", { count: "exact", head: true })`. |
| 6 | Medium | `frontend/components/landing-page.tsx`, `frontend/app/api/teams/route.ts` | 마운트 시 `GET /api/teams`, API `limit(200)` | 팀 수 증가 시 초기 페이로드·파싱 비용 증가. | 페이지네이션·검색·가상 스크롤, 서버 캐시·`revalidate`. |
| 7 | Medium | `frontend/components/session-flow.tsx`, `frontend/app/team/[teamId]/session/page.tsx` | `MenuProposalInspiration`·`TieBreakRoulette` 정적 import | 세션 페이지 진입 시 관련 청크가 항상 초기 번들에 포함될 수 있음. | `next/dynamic`으로 지연 로드. |
| 8 | Medium | `frontend/app/layout.tsx` | `Geist`, `Geist_Mono`, `Jua` 3종 `next/font` | `next/font`로 최적화되어 있으나 패밀리 수가 FCP·폰트 다운로드 비용에 기여. | 본문·디스플레이 역할에 맞게 폰트 수 축소 또는 사용 지점 한정. |
| 9 | Medium | `frontend/components/session-flow.tsx` | `handlePropose`의 `useCallback` 의존성 배열 | `menuInput`·`proposals`·`myProposal` 등으로 콜백 참조가 자주 바뀜. 하위 `memo` 자식이 있으면 연쇄 리렌더 여지. | ref·함수형 업데이트로 의존성 축소 검토. |

## 항목별 요약

### 이미지 / `next/image`

코드베이스에 `<img>`·`next/image` 사용이 없어 **이미지·이미지 CLS 이슈는 해당 없음**. 추후 이미지 추가 시 `next/image`와 크기·`sizes` 지정 권장.

### 폰트·CLS

`next/font/google` 사용으로 로딩 패턴은 양호한 편. 다만 위 표 8번과 같이 **폰트 패밀리 수**는 초기 로드 비용 요소.

### N+1 (HTTP·앱 계층)

목록 항목마다 별도 API를 반복 호출하는 전형적 N+1 패턴은 확인되지 않음. 병목 후보는 **Realtime + 전체 REST 재조회**(표 1–2)와 **단일 핸들러 내 순차 쿼리**(표 4).

### API `select` 패턴

대부분 필요 컬럼만 명시. `select("*")`는 **count + `head: true`** 구간에 한정되며 행 전송은 없음(표 5는 스타일·명시성 개선).

---

*본 문서는 코드 수정 없이 `nextjs-supabase-performance-audit` 스킬 절차에 따른 감사 기록입니다.*
